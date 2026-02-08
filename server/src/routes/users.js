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

/**
 * PUT /api/users/status
 * 
 * Update user status (text and emoji)
 */
router.put('/status', async (req, res) => {
    try {
        const { text, emoji } = req.body;
        const userId = req.user.userId;

        const updateData = {
            'status.updatedAt': new Date()
        };

        if (text !== undefined) {
            if (text.length > 100) {
                return res.status(400).json({ error: 'Status text must be 100 characters or less' });
            }
            updateData['status.text'] = text;
        }

        if (emoji !== undefined) {
            updateData['status.emoji'] = emoji;
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true }
        ).select('status');

        res.json({ status: user.status });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

/**
 * PUT /api/users/bio
 * 
 * Update user bio
 */
router.put('/bio', async (req, res) => {
    try {
        const { bio } = req.body;
        const userId = req.user.userId;

        if (bio && bio.length > 150) {
            return res.status(400).json({ error: 'Bio must be 150 characters or less' });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: { bio: bio || '' } },
            { new: true }
        ).select('bio');

        res.json({ bio: user.bio });
    } catch (error) {
        console.error('Update bio error:', error);
        res.status(500).json({ error: 'Failed to update bio' });
    }
});

/**
 * GET /api/users/profile
 * 
 * Get current user's profile including status and bio
 */
router.get('/profile', async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId).select('username email avatar status bio');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

export default router;

