"""
30 Days of Voice Agents - FastAPI Backend Server
Complete implementation with all 6 days of features:
- Day 1: Basic FastAPI setup and static file serving
- Day 2: Murf TTS API integration
- Day 3: Frontend TTS playback support
- Day 4: Echo bot with audio recording
- Day 5: Audio file upload handling
- Day 6: AssemblyAI transcription integration
"""

import os
import uuid
import aiofiles
import requests
import assemblyai as aai
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Voice Agents API",
    description="Complete voice agents application with TTS, STT, and audio recording",
    version="1.0.0"
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(exist_ok=True)

# API Keys from environment
MURF_API_KEY = os.getenv("MURF_API_KEY")
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")

# Configure AssemblyAI
if ASSEMBLYAI_API_KEY:
    aai.settings.api_key = ASSEMBLYAI_API_KEY

# Pydantic models for request/response
class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = "en-US-davis"

class TTSResponse(BaseModel):
    success: bool
    audio_url: Optional[str] = None
    message: str

class UploadResponse(BaseModel):
    success: bool
    filename: str
    content_type: str
    size: int
    message: str

class TranscriptionResponse(BaseModel):
    success: bool
    transcription: Optional[str] = None
    message: str

# Mount static files (frontend)
frontend_path = Path(__file__).parent.parent / "frontend"
if frontend_path.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_path)), name="static")

# Routes

@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    """Day 1: Serve the main HTML page"""
    try:
        frontend_file = frontend_path / "index.html"
        if frontend_file.exists():
            async with aiofiles.open(frontend_file, mode='r', encoding='utf-8') as f:
                content = await f.read()
            return HTMLResponse(content=content)
        else:
            return HTMLResponse(content="""
            <!DOCTYPE html>
            <html>
            <head><title>Voice Agents</title></head>
            <body>
                <h1>Voice Agents Backend Running!</h1>
                <p>Frontend files not found. Please create the frontend directory.</p>
                <p>API Documentation: <a href="/docs">/docs</a></p>
            </body>
            </html>
            """)
    except Exception as e:
        return HTMLResponse(content=f"<h1>Error loading frontend: {str(e)}</h1>")

@app.post("/generate-audio", response_model=TTSResponse)
async def generate_audio(request: TTSRequest):
    """Day 2: Text-to-Speech using Murf API"""
    if not MURF_API_KEY:
        raise HTTPException(status_code=500, detail="Murf API key not configured")
    
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    try:
        # Murf API endpoint and headers
        murf_url = "https://api.murf.ai/v1/speech/generate"
        headers = {
            "Content-Type": "application/json",
            "api-key": MURF_API_KEY
        }
        
        # Request payload
        payload = {
            "text": request.text,
            "voiceId": request.voice_id
        }
        
        # Make request to Murf API
        response = requests.post(murf_url, json=payload, headers=headers, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            audio_url = result.get("audioFile")
            
            if audio_url:
                return TTSResponse(
                    success=True,
                    audio_url=audio_url,
                    message="Audio generated successfully"
                )
            else:
                raise HTTPException(status_code=500, detail="No audio URL returned from Murf API")
        else:
            error_detail = f"Murf API error: {response.status_code} - {response.text}"
            raise HTTPException(status_code=response.status_code, detail=error_detail)
            
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Network error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@app.post("/upload-audio", response_model=UploadResponse)
async def upload_audio(audio_file: UploadFile = File(...)):
    """Day 5: Handle audio file uploads"""
    
    # Validate file type
    allowed_types = [
        "audio/wav", "audio/mp3", "audio/mpeg", "audio/mp4", 
        "audio/webm", "audio/ogg", "audio/flac", "audio/aac"
    ]
    
    if audio_file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type: {audio_file.content_type}"
        )
    
    # Validate file size (max 50MB)
    max_size = 50 * 1024 * 1024  # 50MB
    content = await audio_file.read()
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")
    
    try:
        # Generate unique filename
        file_extension = Path(audio_file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = UPLOADS_DIR / unique_filename
        
        # Save file
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(content)
        
        return UploadResponse(
            success=True,
            filename=unique_filename,
            content_type=audio_file.content_type,
            size=len(content),
            message="File uploaded successfully"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.post("/transcribe-file", response_model=TranscriptionResponse)
async def transcribe_file(audio_file: UploadFile = File(...)):
    """Day 6: Transcribe audio using AssemblyAI"""
    
    if not ASSEMBLYAI_API_KEY:
        raise HTTPException(status_code=500, detail="AssemblyAI API key not configured")
    
    # Validate file type
    allowed_types = [
        "audio/wav", "audio/mp3", "audio/mpeg", "audio/mp4", 
        "audio/webm", "audio/ogg", "audio/flac", "audio/aac"
    ]
    
    if audio_file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type for transcription: {audio_file.content_type}"
        )
    
    try:
        # Save uploaded audio file to disk for AssemblyAI
        file_ext = Path(audio_file.filename).suffix or '.tmp'
        temp_path = UPLOADS_DIR / f"transcribe_{uuid.uuid4()}{file_ext}"
        try:
            async with aiofiles.open(temp_path, 'wb') as out_file:
                content = await audio_file.read()
                await out_file.write(content)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save file for transcription: {e}")

        # Create transcriber instance
        transcriber = aai.Transcriber()
        try:
            transcript = transcriber.transcribe(str(temp_path))
        except Exception as e:
            temp_path.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail=f"AssemblyAI error: {e}")

        temp_path.unlink(missing_ok=True)  # Clean up temp file

        if transcript.status == aai.TranscriptStatus.error:
            raise HTTPException(
                status_code=500, 
                detail=f"Transcription failed: {transcript.error if hasattr(transcript, 'error') else 'Unknown error'}"
            )

        return TranscriptionResponse(
            success=True,
            transcription=transcript.text,
            message="Transcription completed successfully"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "message": "Voice Agents API is running",
        "murf_api_configured": bool(MURF_API_KEY),
        "assemblyai_configured": bool(ASSEMBLYAI_API_KEY)
    }

@app.delete("/cleanup-uploads")
async def cleanup_uploads():
    """Clean up temporary upload files (optional maintenance endpoint)"""
    try:
        deleted_count = 0
        for file_path in UPLOADS_DIR.glob("*"):
            if file_path.is_file():
                file_path.unlink()
                deleted_count += 1
        
        return {
            "success": True,
            "message": f"Cleaned up {deleted_count} files",
            "deleted_count": deleted_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
