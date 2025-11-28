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

# Global progress tracking
conversion_progress = {}

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
    
    # Initialize progress tracking
    conversion_progress[output_filename] = {
        "status": "starting",
        "progress": 0,
        "total_chunks": 0,
        "current_chunk": 0,
        "message": "Initializing conversion..."
    }
    
    # Run conversion in background with all three voices
    background_tasks.add_task(
        convert_to_audiobook, 
        str(file_path), 
        str(output_path), 
        request.narrator_voice_id,
        request.dialogue_voice_id,
        request.emphasis_voice_id,
        conversion_progress,
        output_filename
    )
    
    return {"message": "Conversion started", "output_filename": output_filename}

@app.post("/preview")
async def generate_preview(request: ConversionRequest):
    """Generate a 30-second preview of the selected voices"""
    from converter import extract_text_from_pdf, extract_text_from_epub_with_chapters, text_to_speech_chunk
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
        
        # Take first ~300 characters for preview (about 20-30 seconds of audio)
        preview_text = full_text[:300].strip()
        
        if not preview_text:
            raise HTTPException(status_code=400, detail="No text found in file")
        
        # Generate simple preview with narrator voice only
        print(f"Generating preview: {len(preview_text)} characters")
        audio_bytes = text_to_speech_chunk(preview_text, request.narrator_voice_id)
        
        if not audio_bytes:
            raise HTTPException(status_code=500, detail="Failed to generate preview audio")
        
        # Return audio as streaming response
        from fastapi.responses import StreamingResponse
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/mpeg",
            headers={"Content-Disposition": f"inline; filename=preview.mp3"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Preview error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Preview generation failed: {str(e)}")

@app.get("/conversion-status/{filename}")
def get_conversion_status(filename: str):
    """Get the conversion progress for a specific file"""
    if filename in conversion_progress:
        return conversion_progress[filename]
    return {"status": "not_found", "progress": 0}

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
