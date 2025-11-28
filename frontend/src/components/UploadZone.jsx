import React, { useState } from 'react';
import axios from 'axios';
import { Upload, FileText, Loader2, CheckCircle } from 'lucide-react';
import { API_URL } from '../config';

const UploadZone = ({ onUploadSuccess }) => {
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [conversionStage, setConversionStage] = useState(''); // 'uploading', 'converting', 'done'
    const [narratorVoice, setNarratorVoice] = useState('en-US-GuyNeural');
    const [dialogueVoice, setDialogueVoice] = useState('en-US-JennyNeural');
    const [emphasisVoice, setEmphasisVoice] = useState('en-US-DavisNeural');
    const [uploadedFile, setUploadedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [generatingPreview, setGeneratingPreview] = useState(false);

    const voices = [
        // US Voices
        { id: 'en-US-GuyNeural', name: 'Guy (US Male - Warm)' },
        { id: 'en-US-DavisNeural', name: 'Davis (US Male - Strong)' },
        { id: 'en-US-TonyNeural', name: 'Tony (US Male - News)' },
        { id: 'en-US-JasonNeural', name: 'Jason (US Male - Young)' },
        { id: 'en-US-JennyNeural', name: 'Jenny (US Female - Friendly)' },
        { id: 'en-US-AriaNeural', name: 'Aria (US Female - Expressive)' },
        { id: 'en-US-SaraNeural', name: 'Sara (US Female - Professional)' },
        { id: 'en-US-NancyNeural', name: 'Nancy (US Female - News)' },
        // UK Voices
        { id: 'en-GB-RyanNeural', name: 'Ryan (UK Male)' },
        { id: 'en-GB-ThomasNeural', name: 'Thomas (UK Male - Calm)' },
        { id: 'en-GB-SoniaNeural', name: 'Sonia (UK Female)' },
        { id: 'en-GB-LibbyNeural', name: 'Libby (UK Female - Bright)' },
        // Australian Voices
        { id: 'en-AU-WilliamNeural', name: 'William (AU Male)' },
        { id: 'en-AU-NatashaNeural', name: 'Natasha (AU Female)' },
        // Indian Voices
        { id: 'en-IN-PrabhatNeural', name: 'Prabhat (IN Male)' },
        { id: 'en-IN-NeerjaNeural', name: 'Neerja (IN Female)' },
    ];

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        setUploadProgress(0);
        setConversionStage('uploading');

        const formData = new FormData();
        formData.append('file', file);

        try {
            // 1. Upload file with progress tracking
            const uploadRes = await axios.post(`${API_URL}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(percentCompleted);
                }
            });

            // Store uploaded filename for preview
            setUploadedFile(uploadRes.data.filename);
            setConversionStage('converting');
            setUploadProgress(100);

            // 2. Trigger conversion with selected voices
            await axios.post(`${API_URL}/convert`, {
                filename: uploadRes.data.filename,
                narrator_voice_id: narratorVoice,
                dialogue_voice_id: dialogueVoice,
                emphasis_voice_id: emphasisVoice,
            });

            setConversionStage('done');

            // Wait 2 seconds before resetting
            setTimeout(() => {
                setUploading(false);
                setConversionStage('');
                setUploadProgress(0);
                if (onUploadSuccess) onUploadSuccess();
            }, 2000);

        } catch (error) {
            console.error(error);
            setConversionStage('error');
            setTimeout(() => {
                setUploading(false);
                setConversionStage('');
                setUploadProgress(0);
            }, 3000);
        }
    };

    const handlePreview = async () => {
        if (!uploadedFile) return;

        setGeneratingPreview(true);
        try {
            const response = await axios.post(`${API_URL}/preview`, {
                filename: uploadedFile,
                narrator_voice_id: narratorVoice,
                dialogue_voice_id: dialogueVoice,
                emphasis_voice_id: emphasisVoice,
            }, {
                responseType: 'blob'
            });

            // Create URL for audio playback
            const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
            const url = URL.createObjectURL(audioBlob);
            setPreviewUrl(url);
        } catch (error) {
            console.error("Preview generation failed:", error);
            alert("Failed to generate preview. Please try again.");
        } finally {
            setGeneratingPreview(false);
        }
    };

    const getStatusMessage = () => {
        switch (conversionStage) {
            case 'uploading':
                return `Uploading... ${uploadProgress}%`;
            case 'converting':
                return 'Converting to audiobook...';
            case 'done':
                return 'Conversion started! Check library soon.';
            case 'error':
                return 'Error uploading or converting file.';
            default:
                return '';
        }
    };

    return (
        <div className="w-full max-w-md mx-auto p-6 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-400" />
                Upload eBook
            </h2>

            <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                    Narrator Voice
                </label>
                <select
                    value={narratorVoice}
                    onChange={(e) => setNarratorVoice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={uploading}
                >
                    {voices.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                            {voice.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                    Dialogue Voice (for quotes)
                </label>
                <select
                    value={dialogueVoice}
                    onChange={(e) => setDialogueVoice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    disabled={uploading}
                >
                    {voices.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                            {voice.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                    Emphasis Voice (for SHOUTING!)
                </label>
                <select
                    value={emphasisVoice}
                    onChange={(e) => setEmphasisVoice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    disabled={uploading}
                >
                    {voices.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                            {voice.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Preview Section */}
            {uploadedFile && !uploading && (
                <div className="mb-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-sm text-slate-300">
                            <span className="font-medium">Ready:</span> {uploadedFile}
                        </div>
                    </div>

                    <button
                        onClick={handlePreview}
                        disabled={generatingPreview}
                        className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        {generatingPreview ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Generating Preview...
                            </>
                        ) : (
                            <>
                                🎧 Preview Voices (30s)
                            </>
                        )}
                    </button>

                    {/* Progress bar for preview generation */}
                    {generatingPreview && (
                        <div className="mt-3">
                            <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                                <div className="bg-purple-500 h-full animate-pulse w-full"
                                    style={{ animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
                                />
                            </div>
                            <p className="text-xs text-slate-400 mt-1 text-center">Processing audio...</p>
                        </div>
                    )}

                    {previewUrl && (
                        <div className="mt-3">
                            <p className="text-xs text-slate-400 mb-2">Preview Audio:</p>
                            <audio
                                controls
                                src={previewUrl}
                                className="w-full"
                                style={{ height: '40px' }}
                            />
                        </div>
                    )}
                </div>
            )}

            <div className="relative border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                <input
                    type="file"
                    accept=".pdf,.epub"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={uploading}
                />

                {uploading ? (
                    <div className="flex flex-col items-center gap-3 text-slate-300">
                        {conversionStage === 'done' ? (
                            <CheckCircle className="w-8 h-8 text-green-500" />
                        ) : (
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        )}
                        <span className="font-medium">{getStatusMessage()}</span>

                        {/* Progress Bar */}
                        {conversionStage === 'uploading' && (
                            <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
                                <div
                                    className="bg-blue-600 h-full transition-all duration-300"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        )}

                        {conversionStage === 'converting' && (
                            <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
                                <div className="bg-purple-600 h-full w-full animate-pulse" />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                        <FileText className="w-10 h-10 mb-2" />
                        <p className="font-medium text-slate-200">Click or drag file to upload</p>
                        <p className="text-sm">Supports PDF and EPUB</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UploadZone;
