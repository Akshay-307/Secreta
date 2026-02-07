import express from 'express';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Max avatar size: 50KB base64 (~37KB raw image)
const MAX_AVATAR_SIZE = 50 * 1024;

/**
 * PUT /api/avatar
 * 
 * Upload or update user avatar
 * Expects: { avatar: "data:image/...;base64,..." }
 */
router.put('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { avatar } = req.body;

        if (!avatar) {
            return res.status(400).json({ error: 'Avatar data required' });
        }

        // Validate base64 data URL format
        if (!avatar.startsWith('data:image/')) {
            return res.status(400).json({ error: 'Invalid image format' });
        }

        // Check size
        if (avatar.length > MAX_AVATAR_SIZE) {
            return res.status(400).json({ error: 'Avatar too large (max 50KB)' });
        }

        await User.findByIdAndUpdate(userId, { avatar });

        res.json({ message: 'Avatar updated successfully' });
    } catch (error) {
        console.error('Update avatar error:', error);
        res.status(500).json({ error: 'Failed to update avatar' });
    }
});

/**
 * DELETE /api/avatar
 * 
 * Remove user avatar
 */
router.delete('/', async (req, res) => {
    try {
        const userId = req.user.userId;

        await User.findByIdAndUpdate(userId, { avatar: null });

        res.json({ message: 'Avatar removed successfully' });
    } catch (error) {
        console.error('Remove avatar error:', error);
        res.status(500).json({ error: 'Failed to remove avatar' });
    }
});

export default router;
