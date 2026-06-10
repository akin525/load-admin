import axios from 'axios';

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

const shouldForceLogout = (error: unknown) => {
    if (!axios.isAxiosError(error)) {
        return false;
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

    return response.code === 401
        && response.name === 'NotAuthenticated'
        && response.className === 'not-authenticated'
        && response.message === 'jwt expired'
        && response.data?.name === 'TokenExpiredError';
};

const forceLogout = () => {
    if (typeof window === 'undefined') {
        return;
    }

    localStorage.removeItem('token');
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
