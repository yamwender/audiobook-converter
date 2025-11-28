import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Play, BookOpen, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { API_URL } from '../config';

const AudiobookList = ({ onPlay, refreshTrigger }) => {
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [conversionStatus, setConversionStatus] = useState({});

    const fetchBooks = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/library`);
            setBooks(res.data);
        } catch (error) {
            console.error("Error fetching library:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchConversionStatus = async (filename) => {
        try {
            // Encode filename to handle spaces and special characters
            const encodedFilename = encodeURIComponent(filename);
            const res = await axios.get(`${API_URL}/conversion-status/${encodedFilename}`);

            setConversionStatus(prev => ({
                ...prev,
                [filename]: res.data
            }));
        } catch (error) {
            console.error("Error fetching status:", error);
        }
    };

    const handleDelete = async (filename) => {
        try {
            const encodedFilename = encodeURIComponent(filename);
            await axios.delete(`${API_URL}/audiobook/${encodedFilename}`);
            setDeleteConfirm(null);
            fetchBooks(); // Refresh library
        } catch (error) {
            console.error("Error deleting audiobook:", error);
            alert("Failed to delete audiobook");
        }
    };

    useEffect(() => {
        fetchBooks();

        // Poll for conversion status every 2 seconds
        const interval = setInterval(() => {
            books.forEach(book => {
                // Only poll if book is converting
                if (book.status === 'converting' || (conversionStatus[book.filename] && conversionStatus[book.filename].status !== 'completed')) {
                    fetchConversionStatus(book.filename);
                }
            });
        }, 2000);

        return () => clearInterval(interval);
    }, [refreshTrigger, books.length]); // Removed conversionStatus dependency to avoid infinite loops

    const getStatusForBook = (filename) => {
        return conversionStatus[filename];
    };

    return (
        <div className="w-full max-w-md mx-auto mt-8 p-6 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-purple-400" />
                    Library
                </h2>
                <button
                    onClick={fetchBooks}
                    className="p-2 hover:bg-slate-700 rounded-full transition-colors"
                    title="Refresh Library"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {books.length === 0 ? (
                <p className="text-slate-400 text-center py-4">No audiobooks found.</p>
            ) : (
                <ul className="space-y-3">
                    {books.map((book) => {
                        const status = getStatusForBook(book.filename);
                        // Show progress bar if:
                        // 1. We have status and it's not completed/not_found
                        // 2. OR we don't have status yet but library says it's converting
                        const isConverting = (status && status.status !== 'completed' && status.status !== 'not_found') ||
                            (!status && book.status === 'converting');

                        // Use status message or default
                        const progressMessage = status?.message || "Starting conversion...";
                        const progressPercent = status?.progress || 0;
                        const currentChunk = status?.current_chunk || 0;
                        const totalChunks = status?.total_chunks || 0;

                        return (
                            <li key={book.filename} className="p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="truncate flex-1 mr-4 text-sm font-medium">{book.filename}</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => onPlay(book.filename)}
                                            className="p-2 bg-blue-600 hover:bg-blue-500 rounded-full text-white transition-colors"
                                            title="Play"
                                            disabled={isConverting}
                                        >
                                            <Play className="w-4 h-4 fill-current" />
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirm(book.filename)}
                                            className="p-2 bg-red-600 hover:bg-red-500 rounded-full text-white transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                {isConverting && (
                                    <div className="mt-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                                            <span className="text-xs text-slate-400">{progressMessage}</span>
                                        </div>
                                        <div className="w-full bg-slate-600 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="bg-gradient-to-r from-blue-600 to-purple-600 h-full transition-all duration-300"
                                                style={{ width: `${progressPercent}%` }}
                                            />
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            {currentChunk > 0 && `Chunk ${currentChunk}/${totalChunks} • `}
                                            {progressPercent}%
                                        </div>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* Delete Confirmation Dialog */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 max-w-sm mx-4">
                        <h3 className="text-lg font-bold mb-2">Delete Audiobook?</h3>
                        <p className="text-slate-300 mb-4">
                            Are you sure you want to delete "{deleteConfirm}"? This cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm)}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AudiobookList;
