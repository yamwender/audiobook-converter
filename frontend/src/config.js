// API Configuration
// Use relative URL in production (cloud), localhost in development

const getApiUrl = () => {
    // In development (Vite dev server), proxy to backend
    if (import.meta.env.DEV) {
        return 'http://localhost:8000';
    }

    // In production, same origin (backend serves frontend)
    return '';
};

export const API_URL = getApiUrl();
