import express from 'express';
import Message from '../models/Message.js';
import Friendship from '../models/Friendship.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/messages/:friendId
 * 
 * Get message history with a friend
 * Returns encrypted messages - decryption happens client-side
 */
router.get('/:friendId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { friendId } = req.params;
        const { limit = 50, before } = req.query;

        // Verify friendship
        const friendship = await Friendship.findOne({
            $or: [
                { requester: userId, recipient: friendId, status: 'accepted' },
                { requester: friendId, recipient: userId, status: 'accepted' }
            ]
        });

        if (!friendship) {
            return res.status(403).json({ error: 'Not friends with this user' });
        }

        // Build query
        const query = {
            $or: [
                { senderId: userId, recipientId: friendId },
                { senderId: friendId, recipientId: userId }
            ]
        };

        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }

        const messages = await Message.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .lean();

        // Mark messages as delivered
        const undeliveredIds = messages
            .filter(m => m.recipientId.toString() === userId && !m.delivered)
            .map(m => m._id);

        if (undeliveredIds.length > 0) {
            await Message.updateMany(
                { _id: { $in: undeliveredIds } },
                { delivered: true }
            );
        }

        res.json(messages.reverse());
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

/**
 * PUT /api/messages/read/:friendId
 * 
 * Mark all messages from a friend as read
 */
router.put('/read/:friendId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { friendId } = req.params;

        await Message.updateMany(
            { senderId: friendId, recipientId: userId, read: false },
            { read: true }
        );

        res.json({ message: 'Messages marked as read' });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ error: 'Failed to mark messages as read' });
    }
});

export default router;
