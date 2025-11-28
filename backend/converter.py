import os
import requests
from pathlib import Path
import PyPDF2
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
CHUNK_SIZE = 1024
MAX_CHARS_PER_REQUEST = 5000  # ElevenLabs limit for most voices

def extract_text_from_pdf(pdf_path):
    text = ""
    with open(pdf_path, 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        for page in reader.pages:
            text += page.extract_text() + "\n"
    return text

def extract_text_from_epub_with_chapters(epub_path):
    """Extract text and chapter structure from EPUB"""
    import json
    
    book = epub.read_epub(epub_path)
    text = ""
    chapters = []
    char_position = 0
    
    # Try to get TOC
    toc = book.toc
    chapter_map = {}
    
    # Map TOC items to their href
    def map_toc(toc_items, depth=0):
        for item in toc_items:
            if isinstance(item, tuple):
                map_toc(item, depth + 1)
            elif isinstance(item, epub.Link):
                # Get just the file part (remove anchors)
                href = item.href.split('#')[0]
                chapter_map[href] = item.title
            elif hasattr(item, 'title') and hasattr(item, 'href'):
                href = item.href.split('#')[0]
                chapter_map[href] = item.title
    
    if toc:
        map_toc(toc)
    
    # Extract text and track chapters
    for item in book.get_items():
        if item.get_type() == ebooklib.ITEM_DOCUMENT:
            # Get item ID/href
            item_name = item.get_name()
            
            # Check if this is a chapter start
            if item_name in chapter_map:
                chapters.append({
                    "title": chapter_map[item_name],
                    "char_position": char_position
                })
            
            # Extract text
            soup = BeautifulSoup(item.get_content(), 'html.parser')
            item_text = soup.get_text() + "\n"
            text += item_text
            char_position += len(item_text)
    
    return text, chapters

def extract_text_from_epub(epub_path):
    """Simple text extraction for backwards compatibility"""
    text, _ = extract_text_from_epub_with_chapters(epub_path)
    return text

def detect_chapters_from_text(text):
    """Detect chapters from text using pattern matching"""
    import re
    
    chapters = []
    lines = text.split('\n')
    char_position = 0
    
    # Common chapter patterns
    patterns = [
        r'^Chapter\s+(\d+|[IVXLCDM]+)[\s:.\-—]*(.*)$',  # Chapter 1, Chapter I
        r'^CHAPTER\s+(\d+|[IVXLCDM]+)[\s:.\-—]*(.*)$',  # CHAPTER 1
        r'^(\d+)[\s:.\-—]+(.+)$',  # 1. Chapter Title or 1 - Chapter Title
        r'^Part\s+(\d+|[IVXLCDM]+)[\s:.\-—]*(.*)$',  # Part 1
        r'^Book\s+(\d+|[IVXLCDM]+)[\s:.\-—]*(.*)$',  # Book 1
        r'^Prologue\s*(.*)$',  # Prologue
        r'^Epilogue\s*(.*)$',  # Epilogue
    ]
    
    for i, line in enumerate(lines):
        line = line.strip()
        
        # Skip empty lines or very short lines
        if len(line) < 3:
            char_position += len(lines[i]) + 1
            continue
        
        # Check if this line matches any chapter pattern
        for pattern in patterns:
            match = re.match(pattern, line, re.IGNORECASE)
            if match:
                # Extract chapter number and title
                if 'prologue' in line.lower():
                    title = 'Prologue'
                    if match.group(1):
                        title += f': {match.group(1).strip()}'
                elif 'epilogue' in line.lower():
                    title = 'Epilogue'
                    if match.group(1):
                        title += f': {match.group(1).strip()}'
                else:
                    chapter_num = match.group(1)
                    chapter_title = match.group(2).strip() if len(match.groups()) > 1 else ''
                    
                    # Build title
                    if 'chapter' in line.lower():
                        title = f'Chapter {chapter_num}'
                    elif 'part' in line.lower():
                        title = f'Part {chapter_num}'
                    elif 'book' in line.lower():
                        title = f'Book {chapter_num}'
                    else:
                        title = f'Chapter {chapter_num}'
                    
                    if chapter_title and len(chapter_title) > 2:
                        title += f': {chapter_title}'
                
                chapters.append({
                    'title': title,
                    'char_position': char_position
                })
                break
        
        char_position += len(lines[i]) + 1
    
    return chapters

def chunk_text(text, max_chars=MAX_CHARS_PER_REQUEST):
    """Split text into chunks that respect sentence boundaries"""
    chunks = []
    current_chunk = ""
    
    # Split by sentences (simplified)
    sentences = text.replace('\n', ' ').split('. ')
    
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
            
        # If adding this sentence would exceed the limit
        if len(current_chunk) + len(sentence) + 2 > max_chars:
            if current_chunk:
                chunks.append(current_chunk)
                current_chunk = sentence + '. '
            else:
                # Single sentence is too long, split it
                chunks.append(sentence[:max_chars])
                current_chunk = sentence[max_chars:] + '. '
        else:
            current_chunk += sentence + '. '
    
    # Add the last chunk
    if current_chunk:
        chunks.append(current_chunk)
    
    return chunks

def text_to_speech_chunk(text, voice_id):
    """Convert a single text chunk to audio bytes"""
    if not ELEVENLABS_API_KEY:
        print("Error: ELEVENLABS_API_KEY not set")
        return None

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY
    }
    
    data = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.5
        }
    }
    
    response = requests.post(url, json=data, headers=headers)
    
    if response.status_code == 200:
        return response.content
    else:
        print(f"Error: {response.status_code} - {response.text}")
        return None

def merge_audio_chunks_binary(audio_chunks, output_path):
    """Merge multiple MP3 chunks by concatenating them"""
    if not audio_chunks:
        return False
    
    with open(output_path, 'wb') as outfile:
        for chunk_bytes in audio_chunks:
            outfile.write(chunk_bytes)
    
    return True

def convert_to_audiobook(input_path, output_path, voice_id):
    import json
    
    path = Path(input_path)
    text = ""
    chapters = []
    
    print(f"Starting conversion for: {path.name}")
    
    # Extract text and chapters
    if path.suffix.lower() == '.pdf':
        text = extract_text_from_pdf(input_path)
        # Try intelligent chapter detection for PDFs
        chapters = detect_chapters_from_text(text)
        print(f"Detected {len(chapters)} chapters from PDF")
    elif path.suffix.lower() == '.epub':
        text, chapters = extract_text_from_epub_with_chapters(input_path)
        
        # If no chapters found from TOC, try intelligent detection
        if not chapters or len(chapters) == 0:
            print("No TOC found, analyzing text for chapters...")
            chapters = detect_chapters_from_text(text)
            print(f"Detected {len(chapters)} chapters from text analysis")
        else:
            print(f"Found {len(chapters)} chapters from TOC")
    else:
        print(f"Unsupported file format: {path.suffix}")
        return

    if not text:
        print("No text extracted.")
        return

    print(f"Extracted {len(text)} characters")
    
    # Chunk the text
    chunks = chunk_text(text)
    print(f"Split into {len(chunks)} chunks")
    
    # Convert each chunk to audio and track timestamps
    audio_chunks = []
    chunk_char_positions = []
    cumulative_chars = 0
    
    for i, chunk in enumerate(chunks):
        print(f"Converting chunk {i+1}/{len(chunks)}...")
        chunk_char_positions.append(cumulative_chars)
        cumulative_chars += len(chunk)
        
        audio_bytes = text_to_speech_chunk(chunk, voice_id)
        if audio_bytes:
            audio_chunks.append(audio_bytes)
        else:
            print(f"Failed to convert chunk {i+1}")
    
    if not audio_chunks:
        print("No audio generated")
        return
    
    # Calculate chapter timestamps
    if chapters:
        # Estimate audio duration per character
        total_audio_bytes = sum(len(chunk) for chunk in audio_chunks)
        # Rough estimate: 1 minute of MP3 ≈ 1MB at 128kbps, average reading speed ≈ 150 chars/sec
        chars_per_second = 15  # Conservative estimate
        
        chapter_data = []
        for chapter in chapters:
            # Find which chunk this chapter starts in
            char_pos = chapter['char_position']
            timestamp = char_pos / chars_per_second
            chapter_data.append({
                "title": chapter['title'],
                "timestamp": round(timestamp, 1)
            })
        
        # Save chapter metadata
        chapters_path = Path(output_path).with_suffix('').with_suffix('').with_name(
            Path(output_path).stem + '_chapters.json'
        )
        chapters_path = Path(output_path).parent / f"{Path(output_path).stem}_chapters.json"
        
        with open(chapters_path, 'w', encoding='utf-8') as f:
            json.dump({
                "title": path.stem,
                "chapters": chapter_data
            }, f, indent=2, ensure_ascii=False)
        
        print(f"Saved chapter data to {chapters_path}")
    
    print(f"Merging {len(audio_chunks)} audio chunks...")
    
    # Merge all audio chunks using binary concatenation
    success = merge_audio_chunks_binary(audio_chunks, output_path)
    
    if success:
        file_size = Path(output_path).stat().st_size
        print(f"Audio saved to {output_path}")
        print(f"File size: {file_size / 1024 / 1024:.2f} MB")
    else:
        print("Failed to merge audio chunks")
