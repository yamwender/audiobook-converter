import React, { useState } from 'react';
import UploadZone from './components/UploadZone';
import PlayerView from './components/PlayerView';
import { Headphones, BookOpen, Play, Trash2, RefreshCw, Menu, X } from 'lucide-react';
import axios from 'axios';
import { API_URL } from './config';

function App() {
  const [currentAudio, setCurrentAudio] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState('home'); // 'home' or 'player'

  const handleUploadSuccess = () => {
    setTimeout(() => {
      setRefreshTrigger(prev => prev + 1);
      fetchBooks();
    }, 1000);
  };

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

  const handlePlay = (filename) => {
    setCurrentAudio(filename);
    setView('player');
    setSidebarOpen(false);
  };

  const handleBackToHome = () => {
    setView('home');
    setCurrentAudio(null);
  };

  const handleDelete = async (filename) => {
    try {
      await axios.delete(`${API_URL}/audiobook/${filename}`);
      setDeleteConfirm(null);
      fetchBooks();
      if (currentAudio === filename) {
        handleBackToHome();
      }
    } catch (error) {
      console.error("Error deleting audiobook:", error);
      alert("Failed to delete audiobook");
    }
  };

  React.useEffect(() => {
    fetchBooks();
  }, [refreshTrigger]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {view === 'player' ? (
        // Player View
        <PlayerView
          filename={currentAudio}
          onBack={handleBackToHome}
        />
      ) : (
        // Home View
        <>
          <header className="bg-slate-800 border-b border-slate-700 p-4 flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Headphones className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Audiobook Converter
              </h1>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar Overlay */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 bg-black/50 z-40 md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* Sidebar */}
            <div className={`
              fixed md:relative inset-y-0 left-0 z-50
              w-80 bg-slate-800 border-r border-slate-700 
              transform transition-transform duration-300 ease-in-out
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
              ${!sidebarOpen && 'md:hidden'}
              flex flex-col
            `}>
              <div className="flex justify-between items-center p-4 border-b border-slate-700 md:hidden">
                <h2 className="font-bold">Library</h2>
                <button onClick={() => setSidebarOpen(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2">
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
                  <p className="text-slate-400 text-center py-8 text-sm">No audiobooks found.</p>
                ) : (
                  <ul className="space-y-2">
                    {books.map((book) => (
                      <li
                        key={book.filename}
                        className="p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate flex-1 text-sm font-medium">
                            {book.filename}
                          </span>
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => handlePlay(book.filename)}
                              className="p-2 bg-blue-600 hover:bg-blue-500 rounded-full text-white transition-colors"
                              title="Play"
                            >
                              <Play className="w-3 h-3 fill-current" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(book.filename)}
                              className="p-2 bg-red-600 hover:bg-red-500 rounded-full text-white transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col overflow-y-auto">
              <div className="flex-1 flex items-center justify-center p-4 md:p-8">
                <div className="w-full max-w-2xl">
                  <div className="mb-8 text-center">
                    <h2 className="text-xl md:text-2xl font-bold mb-2">Convert Your eBooks</h2>
                    <p className="text-slate-400 text-sm md:text-base">
                      Upload your PDF or EPUB files and convert them to audiobooks
                    </p>
                  </div>
                  <UploadZone onUploadSuccess={handleUploadSuccess} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 max-w-sm mx-4">
            <h3 className="text-lg font-bold mb-2">Delete Audiobook?</h3>
            <p className="text-slate-300 mb-4 text-sm">
              Are you sure you want to delete "{deleteConfirm}"? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
