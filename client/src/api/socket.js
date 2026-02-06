/**
 * Socket.IO Client
 * 
 * Manages WebSocket connection for real-time messaging
 */

import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

let socket = null;

/**
 * Connect to Socket.IO server
 * @param {string} token - JWT access token
 * @returns {Socket}
 */
export function connectSocket(token) {
    if (socket?.connected) {
        return socket;
    }

    socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    socket.on('connect', () => {
        console.log('✓ Connected to Secreta server');
    });

    socket.on('disconnect', (reason) => {
        console.log('✗ Disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error.message);
    });

    return socket;
}

/**
 * Get current socket instance
 * @returns {Socket | null}
 */
export function getSocket() {
    return socket;
}

/**
 * Disconnect socket
 */
export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

export default { connectSocket, getSocket, disconnectSocket };
