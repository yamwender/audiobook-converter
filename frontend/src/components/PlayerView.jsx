import React, { useRef, useEffect, useState } from 'react';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, List } from 'lucide-react';
import { API_URL } from '../config';
import axios from 'axios';

const PlayerView = ({ filename, onBack }) => {
    const audioRef = useRef(null);
    const [chapters, setChapters] = useState([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
    const [showChapters, setShowChapters] = useState(true);

    useEffect(() => {
        if (filename) {
            // Fetch chapters
            axios.get(`${API_URL}/chapters/${filename}`)
                .then(res => {
                    if (res.data.chapters && res.data.chapters.length > 0) {
                        setChapters(res.data.chapters);
                    }
                })
                .catch(err => console.error("Error loading chapters:", err));
        }
    }, [filename]);

    useEffect(() => {
        if (audioRef.current && filename) {
            audioRef.current.play();
            setIsPlaying(true);
        }
    }, [filename]);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);

            // Find current chapter
            for (let i = chapters.length - 1; i >= 0; i--) {
                if (audioRef.current.currentTime >= chapters[i].timestamp) {
                    setCurrentChapterIndex(i);
                    break;
                }
            }
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const jumpToChapter = async (timestamp) => {
        if (audioRef.current) {
            try {
                // Ensure timestamp is a number
                const time = parseFloat(timestamp);
                if (!isNaN(time)) {
                    audioRef.current.currentTime = time;
                    const playPromise = audioRef.current.play();
                    if (playPromise !== undefined) {
                        await playPromise;
                    }
                    setIsPlaying(true);
                }
            } catch (error) {
                console.error("Playback failed:", error);
                setIsPlaying(false);
            }
        }
    };

    const skipForward = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 30, duration);
        }
    };

    const skipBackward = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 30, 0);
        }
    };

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!filename) return null;

    return (
        <div className="flex-1 flex flex-col bg-slate-900">
            {/* Header */}
            <div className="bg-slate-800 border-b border-slate-700 p-4 flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-lg font-bold truncate flex-1">{filename}</h1>
                {chapters.length > 0 && (
                    <button
                        onClick={() => setShowChapters(!showChapters)}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <List className="w-6 h-6" />
                    </button>
                )}
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Main Player Area */}
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                    {/* Current Chapter Display */}
                    {chapters.length > 0 && (
                        <div className="text-center mb-8">
                            <p className="text-sm text-slate-400 mb-2">Chapter {currentChapterIndex + 1} of {chapters.length}</p>
                            <h2 className="text-2xl font-bold text-blue-400">
                                {chapters[currentChapterIndex]?.title || 'Audiobook'}
                            </h2>
                        </div>
                    )}

                    {/* Progress Bar */}
                    <div className="w-full max-w-md mb-8">
                        <div className="bg-slate-700 h-2 rounded-full overflow-hidden cursor-pointer"
                            onClick={(e) => {
                                if (audioRef.current) {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const x = e.clientX - rect.left;
                                    const percentage = x / rect.width;
                                    audioRef.current.currentTime = percentage * duration;
                                }
                            }}
                        >
                            <div
                                className="bg-blue-600 h-full transition-all"
                                style={{ width: `${(currentTime / duration) * 100}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-sm text-slate-400 mt-2">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Playback Controls */}
                    <div className="flex items-center gap-6">
                        <button
                            onClick={skipBackward}
                            className="p-3 hover:bg-slate-800 rounded-full transition-colors"
                        >
                            <SkipBack className="w-8 h-8" />
                        </button>

                        <button
                            onClick={togglePlay}
                            className="p-6 bg-blue-600 hover:bg-blue-500 rounded-full transition-colors"
                        >
                            {isPlaying ? (
                                <Pause className="w-10 h-10 fill-current" />
                            ) : (
                                <Play className="w-10 h-10 fill-current" />
                            )}
                        </button>

                        <button
                            onClick={skipForward}
                            className="p-3 hover:bg-slate-800 rounded-full transition-colors"
                        >
                            <SkipForward className="w-8 h-8" />
                        </button>
                    </div>

                    <div className="text-sm text-slate-500 mt-4">
                        Tap arrows to skip ±30 seconds
                    </div>
                </div>

                {/* Chapters Sidebar */}
                {chapters.length > 0 && showChapters && (
                    <>
                        {/* Mobile Backdrop */}
                        <div
                            className="fixed inset-0 bg-black/50 z-40 md:hidden"
                            onClick={() => setShowChapters(false)}
                        />

                        {/* Sidebar Panel */}
                        <div className="fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] bg-slate-800 border-l border-slate-700 flex flex-col shadow-2xl md:relative md:shadow-none md:z-auto">
                            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                                <h3 className="font-bold">Chapters</h3>
                                <button
                                    onClick={() => setShowChapters(false)}
                                    className="md:hidden p-1 hover:bg-slate-700 rounded"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                <ul>
                                    {chapters.map((chapter, index) => (
                                        <li key={index}>
                                            <button
                                                onClick={() => {
                                                    jumpToChapter(chapter.timestamp);
                                                    // Close sidebar on mobile after selection
                                                    if (window.innerWidth < 768) {
                                                        setShowChapters(false);
                                                    }
                                                }}
                                                className={`w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors border-b border-slate-700/50 ${index === currentChapterIndex ? 'bg-blue-600' : ''
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium">{chapter.title}</div>
                                                        <div className="text-xs text-slate-400 mt-1">
                                                            {formatTime(chapter.timestamp)}
                                                        </div>
                                                    </div>
                                                    {index === currentChapterIndex && (
                                                        <div className="bg-blue-400 w-2 h-2 rounded-full mt-2 flex-shrink-0" />
                                                    )}
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Hidden Audio Element */}
            <audio
                ref={audioRef}
                src={`${API_URL}/audio/${filename}`}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
            />
        </div>
    );
};

export default PlayerView;
