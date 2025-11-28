import React, { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { API_URL } from '../config';

const AudioPlayer = ({ filename, onClose }) => {
    const audioRef = useRef(null);

    useEffect(() => {
        if (audioRef.current && filename) {
            audioRef.current.play();
        }
    }, [filename]);

    useEffect(() => {
        // Listen for chapter jump events
        const handleJumpToChapter = (event) => {
            if (audioRef.current && event.detail && event.detail.timestamp !== undefined) {
                audioRef.current.currentTime = event.detail.timestamp;
                audioRef.current.play();
            }
        };

        window.addEventListener('jumpToChapter', handleJumpToChapter);
        return () => window.removeEventListener('jumpToChapter', handleJumpToChapter);
    }, []);

    if (!filename) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 p-4 shadow-2xl z-40">
            <div className="max-w-4xl mx-auto flex items-center gap-4">
                <div className="flex-1">
                    <p className="text-sm text-slate-400 mb-1">Now Playing</p>
                    <p className="font-bold text-blue-400 truncate">{filename}</p>
                </div>

                <audio
                    ref={audioRef}
                    controls
                    src={`${API_URL}/audio/${filename}`}
                    className="w-full max-w-md"
                />

                <button
                    onClick={onClose}
                    className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default AudioPlayer;
