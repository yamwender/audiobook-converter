# Audiobook Converter

Convert your PDF and EPUB files to audiobooks using AI-powered text-to-speech.

## Features

- 📚 Upload PDF and EPUB files
- 🎧 Convert to audiobooks using ElevenLabs API
- 📖 Library management for converted audiobooks
- 🎵 Built-in audio player
- 🌙 Beautiful dark-themed UI

## Setup

### Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   python -m pip install -r requirements.txt
   ```

3. Configure ElevenLabs API:
   - Get an API key from [ElevenLabs](https://elevenlabs.io)
   - Create a `.env` file in the backend directory
   - Add your API key:
     ```
     ELEVENLABS_API_KEY=your_api_key_here
     ```

4. Run the backend server:
   ```bash
   python main.py
   ```

The backend will be available at http://localhost:8000

### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

The frontend will be available at http://localhost:5173

## Usage

1. Open http://localhost:5173 in your browser
2. Drag and drop a PDF or EPUB file to the upload zone
3. Wait for the conversion to complete
4. Click the play button in the Library section to listen
5. The audio player will appear at the bottom of the screen

## Note

The current implementation converts the first 1000 characters for testing purposes. To convert full books, you'll need to implement text chunking in `backend/converter.py` to handle ElevenLabs API character limits.

## Tech Stack

**Backend:**
- FastAPI
- ElevenLabs API
- PyPDF2 (PDF text extraction)
- ebooklib (EPUB text extraction)

**Frontend:**
- React
- Vite
- TailwindCSS v4
- Axios
- Lucide React (icons)
