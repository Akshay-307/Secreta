import express from 'express';
import User from '../models/User.js';
import Friendship from '../models/Friendship.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/users/search?q=username
 * 
 * Search for users by username (for adding friends)
 * Returns users that are not already friends
 */
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        const currentUserId = req.user.userId;

        if (!q || q.length < 2) {
            return res.status(400).json({ error: 'Search query must be at least 2 characters' });
        }

        // Find users matching search query (case-insensitive)
        const users = await User.find({
            _id: { $ne: currentUserId },
            username: { $regex: q, $options: 'i' }
        })
            .select('_id username publicKey')
            .limit(20);

        // Get existing friendships
        const friendships = await Friendship.find({
            $or: [
                { requester: currentUserId },
                { recipient: currentUserId }
            ]
        });

        // Mark friendship status for each user
        const usersWithStatus = users.map(user => {
            const friendship = friendships.find(f =>
            (f.requester.toString() === user._id.toString() ||
                f.recipient.toString() === user._id.toString())
            );

            return {
                id: user._id,
                username: user.username,
                hasPublicKey: !!user.publicKey,
                friendshipStatus: friendship ? friendship.status : null
            };
        });

        res.json(usersWithStatus);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

/**
 * GET /api/users/:userId/public-key
 * 
 * Get a user's public key (required for E2EE)
 * Only allowed for friends
 */
router.get('/:userId/public-key', async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.userId;

        // Verify friendship exists
        const friendship = await Friendship.findOne({
            $or: [
                { requester: currentUserId, recipient: userId, status: 'accepted' },
                { requester: userId, recipient: currentUserId, status: 'accepted' }
            ]
        });

        if (!friendship) {
            return res.status(403).json({ error: 'Not friends with this user' });
        }

        const user = await User.findById(userId).select('publicKey username');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.publicKey) {
            return res.status(404).json({ error: 'User has not set up encryption keys' });
        }

        res.json({
            userId: user._id,
            username: user.username,
            publicKey: user.publicKey
        });
    } catch (error) {
        console.error('Get public key error:', error);
        res.status(500).json({ error: 'Failed to get public key' });
    }
});

export default router;
