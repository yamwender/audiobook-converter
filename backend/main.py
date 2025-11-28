import os
import shutil
from typing import List
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn
from converter import convert_to_audiobook
from pathlib import Path

from fastapi.staticfiles import StaticFiles
from pathlib import Path

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
UPLOAD_DIR = Path("uploads")
AUDIO_DIR = Path("audiobooks")
UPLOAD_DIR.mkdir(exist_ok=True)
AUDIO_DIR.mkdir(exist_ok=True)

# Serve frontend static files
FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

class ConversionRequest(BaseModel):
    filename: str
    narrator_voice_id: str = "en-US-GuyNeural"  # Default narrator voice
    dialogue_voice_id: str = "en-US-JennyNeural"  # Default dialogue voice
    emphasis_voice_id: str = "en-US-DavisNeural"  # Default emphasis voice

@app.get("/")
def read_root():
    if FRONTEND_DIST.exists():
        return FileResponse(FRONTEND_DIST / "index.html")
    return {"message": "Audiobook Converter Backend is running"}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        file_path = UPLOAD_DIR / file.filename
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"filename": file.filename, "message": "File uploaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/convert")
async def start_conversion(request: ConversionRequest, background_tasks: BackgroundTasks):
    file_path = UPLOAD_DIR / request.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    output_filename = f"{file_path.stem}.mp3"
    output_path = AUDIO_DIR / output_filename
    
    # Run conversion in background with all three voices
    background_tasks.add_task(
        convert_to_audiobook, 
        str(file_path), 
        str(output_path), 
        request.narrator_voice_id,
        request.dialogue_voice_id,
        request.emphasis_voice_id
    )
    
    return {"message": "Conversion started", "output_filename": output_filename}

@app.post("/preview")
async def generate_preview(request: ConversionRequest):
    """Generate a 30-second preview of the selected voices"""
    from converter import extract_text_from_pdf, extract_text_from_epub_with_chapters, split_into_narrative_segments, text_to_speech_chunk
    import io
    
    file_path = UPLOAD_DIR / request.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Extract first portion of text (enough for ~30 seconds)
    try:
        if file_path.suffix.lower() == '.pdf':
            from converter import extract_text_from_pdf
            full_text = extract_text_from_pdf(str(file_path))
        elif file_path.suffix.lower() == '.epub':
            from converter import extract_text_from_epub_with_chapters
            full_text, _ = extract_text_from_epub_with_chapters(str(file_path))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
        
        # Take first ~500 characters for preview (about 30 seconds of audio)
        preview_text = full_text[:500]
        
        # Split into narrative segments
        segments = split_into_narrative_segments(preview_text)
        
        # Generate audio for each segment
        audio_chunks = []
        for segment in segments:
            # Detect emphasis (ALL CAPS, multiple exclamation marks)
            text = segment['text']
            is_emphasis = (
                (text.isupper() and len(text.split()) > 2) or  # ALL CAPS text
                ('!!' in text) or  # Multiple exclamation marks
                ('!!!' in text)
            )
            
            # Choose voice based on segment type and emphasis
            if is_emphasis:
                voice_to_use = request.emphasis_voice_id
            elif segment['type'] == 'dialogue':
                voice_to_use = request.dialogue_voice_id
            else:
                voice_to_use = request.narrator_voice_id
                
            audio_bytes = text_to_speech_chunk(segment['text'], voice_to_use)
            if audio_bytes:
                audio_chunks.append(audio_bytes)
        
        # Merge all chunks
        if not audio_chunks:
            raise HTTPException(status_code=500, detail="Failed to generate preview")
        
        preview_audio = b''.join(audio_chunks)
        
        # Return audio as streaming response
        from fastapi.responses import StreamingResponse
        return StreamingResponse(
            io.BytesIO(preview_audio),
            media_type="audio/mpeg",
            headers={"Content-Disposition": f"inline; filename=preview.mp3"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview generation failed: {str(e)}")

@app.get("/library")
def get_library():
    files = []
    for f in AUDIO_DIR.glob("*.mp3"):
        files.append({"filename": f.name, "path": str(f)})
    return files

@app.get("/audio/{filename}")
def get_audio(filename: str):
    file_path = AUDIO_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(file_path)

@app.get("/chapters/{filename}")
def get_chapters(filename: str):
    chapters_path = AUDIO_DIR / f"{Path(filename).stem}_chapters.json"
    
    if not chapters_path.exists():
        # Return empty chapters if no metadata found
        return {"title": filename, "chapters": []}
    
    try:
        import json
        with open(chapters_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/audiobook/{filename}")
def delete_audiobook(filename: str):
    audio_path = AUDIO_DIR / filename
    chapters_path = AUDIO_DIR / f"{Path(filename).stem}_chapters.json"
    
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audiobook not found")
    
    try:
        # Delete audio file
        audio_path.unlink()
        
        # Delete chapter metadata if exists
        if chapters_path.exists():
            chapters_path.unlink()
        
        return {"message": "Audiobook deleted successfully", "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import socket
    
    # Get local IP address
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        local_ip = s.getsockname()[0]
    except Exception:
        local_ip = '127.0.0.1'
    finally:
        s.close()
    
    print(f"\n{'='*60}")
    print(f"🎧 Audiobook Converter Backend")
    print(f"{'='*60}")
    print(f"Local:   http://localhost:8000")
    print(f"Network: http://{local_ip}:8000")
    print(f"{'='*60}\n")
    
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
