import jwt from 'jsonwebtoken';

/**
 * JWT Authentication Middleware
 * 
 * Verifies the JWT token from the Authorization header
 * and attaches the decoded user info to req.user
 */
export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(403).json({ error: 'Invalid token' });
    }
};

/**
 * Socket.IO Authentication Middleware
 * 
 * Verifies JWT token for WebSocket connections
 */
export const authenticateSocket = (socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error('Authentication required'));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
        next();
    } catch (error) {
        next(new Error('Invalid token'));
    }
};

export default { authenticateToken, authenticateSocket };
