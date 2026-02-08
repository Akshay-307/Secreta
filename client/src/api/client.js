/**
 * API Client
 * 
 * Axios instance configured with JWT interceptors
 * for automatic token refresh and authentication
 */

import axios from 'axios';

// Helper to get API URL
const getApiUrl = () => {
    let url = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    // Ensure it ends with /api if not present (unless it's just the domain, then append /api)
    // Heuristic: if it doesn't end in /api, append it.
    if (!url.endsWith('/api') && !url.endsWith('/api/')) {
        url = `${url.replace(/\/$/, '')}/api`;
    }
    return url;
};

const API_URL = getApiUrl();

const api = axios.create({
    baseURL: API_URL
});

// Request interceptor - add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If 401 and we haven't tried refreshing yet
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refreshToken');
                if (!refreshToken) {
                    throw new Error('No refresh token');
                }

                const response = await axios.post(`${API_URL}/auth/refresh`, {
                    refreshToken
                });

                const { accessToken, refreshToken: newRefreshToken } = response.data;

                localStorage.setItem('accessToken', accessToken);
                localStorage.setItem('refreshToken', newRefreshToken);

                // Retry original request with new token
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                // Refresh failed - clear tokens and redirect to login
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('user');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
