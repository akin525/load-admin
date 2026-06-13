import axios from 'axios';
import { clearAdminSession } from './admin-access';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://api.eazycredit.com.ng',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Automatically attach the auth token to every request
api.interceptors.request.use((config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

const normalizeMessage = (value: unknown) => (typeof value === 'string' ? value.toLowerCase().trim() : '');

const hasStoredToken = () => typeof window !== 'undefined' && Boolean(localStorage.getItem('token'));

const shouldForceLogout = (error: unknown) => {
    if (!axios.isAxiosError(error) || !hasStoredToken()) {
        return false;
    }

    if (error.response?.status === 401) {
        return true;
    }

    const payload = error.response?.data;

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return false;
    }

    const response = payload as {
        name?: unknown;
        message?: unknown;
        code?: unknown;
        className?: unknown;
        data?: {
            name?: unknown;
        };
    };

    const message = normalizeMessage(response.message);
    const responseName = normalizeMessage(response.name);
    const className = normalizeMessage(response.className);
    const dataName = normalizeMessage(response.data?.name);

    return response.code === 401 && (
        responseName === 'notauthenticated'
        || className === 'not-authenticated'
        || dataName === 'tokenexpirederror'
        || message.includes('jwt expired')
        || message.includes('token expired')
        || message.includes('unauthorized')
        || message.includes('not authenticated')
    );
};

const forceLogout = () => {
    if (typeof window === 'undefined') {
        return;
    }

    localStorage.removeItem('token');
    clearAdminSession();
    delete api.defaults.headers.common.Authorization;

    if (window.location.pathname !== '/auth/login') {
        window.location.replace('/auth/login');
    }
};

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (shouldForceLogout(error)) {
            forceLogout();
        }

        return Promise.reject(error);
    },
);

export default api;
