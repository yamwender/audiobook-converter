import React, { useState } from 'react';
import axios from 'axios';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { API_URL } from '../config';

const UploadZone = ({ onUploadSuccess }) => {
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');
    const [selectedVoice, setSelectedVoice] = useState('ZQe5CZNOzWyzPSCn5a3c'); // Default to James

    const voices = [
        { id: 'ZQe5CZNOzWyzPSCn5a3c', name: 'James' },
        { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum' },
        { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
    ];

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        setMessage('Uploading...');

        const formData = new FormData();
        formData.append('file', file);

        try {
            // 1. Upload file
            const uploadRes = await axios.post(`${API_URL}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setMessage('Starting conversion...');

            // 2. Trigger conversion with selected voice
            await axios.post(`${API_URL}/convert`, {
                filename: uploadRes.data.filename,
                voice_id: selectedVoice,
            });

            setMessage('Conversion started! It will appear in the library soon.');
            if (onUploadSuccess) onUploadSuccess();

        } catch (error) {
            console.error(error);
            setMessage('Error uploading or converting file.');
        } finally {
            setUploading(false);
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
                    Select Voice
                </label>
                <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
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

            <div className="relative border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                <input
                    type="file"
                    accept=".pdf,.epub"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={uploading}
                />

                {uploading ? (
                    <div className="flex flex-col items-center gap-2 text-slate-300">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        <span>{message}</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                        <FileText className="w-10 h-10 mb-2" />
                        <p className="font-medium text-slate-200">Click or drag file to upload</p>
                        <p className="text-sm">Supports PDF and EPUB</p>
                    </div>
                )}
            </div>

            {message && !uploading && (
                <div className="mt-4 text-center text-sm text-green-400">
                    {message}
                </div>
            )}
        </div>
    );
};

export default UploadZone;
