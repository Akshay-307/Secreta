/**
 * Authentication Context
 * 
 * Manages user authentication state, key generation,
 * and provides auth methods to the app
 */

import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';
import { connectSocket, disconnectSocket } from '../api/socket';
import { initializeKeys, clearKeys, getStoredPublicKeyJwk } from '../crypto/keyManager';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Check for existing session on mount
    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('accessToken');
            const storedUser = localStorage.getItem('user');

            if (token && storedUser) {
                try {
                    // Verify token is still valid
                    const response = await api.get('/auth/me');
                    setUser(response.data);

                    // Connect socket
                    connectSocket(token);

                    // Check if we have encryption keys
                    const publicKey = await getStoredPublicKeyJwk();
                    if (!publicKey) {
                        // Generate and upload keys
                        const newPublicKey = await initializeKeys();
                        await api.put('/auth/public-key', { publicKey: newPublicKey });
                    }
                } catch (error) {
                    console.error('Auth check failed:', error);
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refreshToken');
                    localStorage.removeItem('user');
                }
            }
            setLoading(false);
        };

        checkAuth();
    }, []);

    /**
     * Register a new user
     */
    const register = async (email, username, password) => {
        // Generate encryption keys before registration
        const publicKey = await initializeKeys();

        const response = await api.post('/auth/register', {
            email,
            username,
            password,
            publicKey
        });

        // Server requires email verification - don't log in yet
        if (response.data.requiresVerification) {
            return response.data;
        }

        // Fallback for servers allowing direct login (legacy)
        const { user: userData, accessToken, refreshToken } = response.data;

        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(userData));

        setUser(userData);
        connectSocket(accessToken);

        return userData;
    };

    /**
     * Log in existing user
     */
    const login = async (email, password) => {
        const response = await api.post('/auth/login', { email, password });
        const { user: userData, accessToken, refreshToken } = response.data;

        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(userData));

        setUser(userData);
        connectSocket(accessToken);

        // Check if we have encryption keys
        const publicKey = await getStoredPublicKeyJwk();
        if (!publicKey) {
            // Generate new keys (new device)
            const newPublicKey = await initializeKeys();
            await api.put('/auth/public-key', { publicKey: newPublicKey });
        } else if (!userData.publicKey) {
            // User has local keys but none on server
            await api.put('/auth/public-key', { publicKey });
        }

        return userData;
    };

    /**
     * Log out user
     */
    const logout = async () => {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            // Ignore logout errors
        }

        disconnectSocket();
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        // Note: We keep encryption keys for when user logs back in
        setUser(null);
    };

    /**
     * Clear all data including encryption keys
     */
    const clearAllData = async () => {
        await logout();
        await clearKeys();
    };

    const value = {
        user,
        loading,
        register,
        login,
        logout,
        clearAllData,
        isAuthenticated: !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}

export default AuthContext;
