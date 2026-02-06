import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import { connectDB } from './config/database.js';
import { authenticateSocket } from './middleware/auth.js';
import { setupSocketHandlers } from './socket/handlers.js';

// Routes
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import friendsRoutes from './routes/friends.js';
import messagesRoutes from './routes/messages.js';

const app = express();
const httpServer = createServer(app);

// Socket.IO setup with CORS
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/messages', messagesRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO authentication middleware
io.use(authenticateSocket);

// Socket.IO handlers
setupSocketHandlers(io);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3001;

const startServer = async () => {
    await connectDB();

    httpServer.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════╗
║         SECRETA E2EE SERVER            ║
╠════════════════════════════════════════╣
║  🔒 End-to-End Encrypted Messaging     ║
║  🚀 Server running on port ${PORT}        ║
║  📡 WebSocket ready                    ║
╚════════════════════════════════════════╝
    `);
    });
};

startServer().catch(console.error);
