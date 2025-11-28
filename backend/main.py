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
    voice_id: str = "21m00Tcm4TlvDq8ikWAM" # Default voice

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
    
    # Run conversion in background
    background_tasks.add_task(convert_to_audiobook, str(file_path), str(output_path), request.voice_id)
    
    return {"message": "Conversion started", "output_filename": output_filename}

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
