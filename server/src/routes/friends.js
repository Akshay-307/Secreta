import express from 'express';
import Friendship from '../models/Friendship.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/friends
 * 
 * Get all accepted friends for the current user
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;

        const friendships = await Friendship.find({
            $or: [
                { requester: userId, status: 'accepted' },
                { recipient: userId, status: 'accepted' }
            ]
        }).populate('requester recipient', '_id username publicKey lastSeen');

        const friends = friendships.map(f => {
            const friend = f.requester._id.toString() === userId
                ? f.recipient
                : f.requester;

            return {
                id: friend._id,
                username: friend.username,
                hasPublicKey: !!friend.publicKey,
                lastSeen: friend.lastSeen
            };
        });

        res.json(friends);
    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ error: 'Failed to get friends' });
    }
});

/**
 * GET /api/friends/requests
 * 
 * Get pending friend requests received by current user
 */
router.get('/requests', async (req, res) => {
    try {
        const userId = req.user.userId;

        const requests = await Friendship.find({
            recipient: userId,
            status: 'pending'
        }).populate('requester', '_id username');

        const formattedRequests = requests.map(r => ({
            id: r._id,
            from: {
                id: r.requester._id,
                username: r.requester.username
            },
            createdAt: r.createdAt
        }));

        res.json(formattedRequests);
    } catch (error) {
        console.error('Get requests error:', error);
        res.status(500).json({ error: 'Failed to get friend requests' });
    }
});

/**
 * POST /api/friends/request/:userId
 * 
 * Send a friend request to another user
 */
router.post('/request/:userId', async (req, res) => {
    try {
        const requesterId = req.user.userId;
        const recipientId = req.params.userId;

        if (requesterId === recipientId) {
            return res.status(400).json({ error: 'Cannot send friend request to yourself' });
        }

        // Check if recipient exists
        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check for existing friendship
        const existing = await Friendship.findOne({
            $or: [
                { requester: requesterId, recipient: recipientId },
                { requester: recipientId, recipient: requesterId }
            ]
        });

        if (existing) {
            if (existing.status === 'accepted') {
                return res.status(400).json({ error: 'Already friends' });
            }
            if (existing.status === 'pending') {
                return res.status(400).json({ error: 'Friend request already pending' });
            }
        }

        const friendship = new Friendship({
            requester: requesterId,
            recipient: recipientId,
            status: 'pending'
        });

        await friendship.save();

        res.status(201).json({
            message: 'Friend request sent',
            friendship: {
                id: friendship._id,
                recipientId,
                status: 'pending'
            }
        });
    } catch (error) {
        console.error('Send request error:', error);
        res.status(500).json({ error: 'Failed to send friend request' });
    }
});

/**
 * PUT /api/friends/accept/:requestId
 * 
 * Accept a pending friend request
 */
router.put('/accept/:requestId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { requestId } = req.params;

        const friendship = await Friendship.findOne({
            _id: requestId,
            recipient: userId,
            status: 'pending'
        }).populate('requester', '_id username');

        if (!friendship) {
            return res.status(404).json({ error: 'Friend request not found' });
        }

        friendship.status = 'accepted';
        await friendship.save();

        res.json({
            message: 'Friend request accepted',
            friend: {
                id: friendship.requester._id,
                username: friendship.requester.username
            }
        });
    } catch (error) {
        console.error('Accept request error:', error);
        res.status(500).json({ error: 'Failed to accept friend request' });
    }
});

/**
 * PUT /api/friends/reject/:requestId
 * 
 * Reject a pending friend request
 */
router.put('/reject/:requestId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { requestId } = req.params;

        const friendship = await Friendship.findOneAndUpdate(
            { _id: requestId, recipient: userId, status: 'pending' },
            { status: 'rejected' },
            { new: true }
        );

        if (!friendship) {
            return res.status(404).json({ error: 'Friend request not found' });
        }

        res.json({ message: 'Friend request rejected' });
    } catch (error) {
        console.error('Reject request error:', error);
        res.status(500).json({ error: 'Failed to reject friend request' });
    }
});

/**
 * DELETE /api/friends/:friendId
 * 
 * Remove a friend
 */
router.delete('/:friendId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { friendId } = req.params;

        const result = await Friendship.findOneAndDelete({
            $or: [
                { requester: userId, recipient: friendId },
                { requester: friendId, recipient: userId }
            ],
            status: 'accepted'
        });

        if (!result) {
            return res.status(404).json({ error: 'Friendship not found' });
        }

        res.json({ message: 'Friend removed' });
    } catch (error) {
        console.error('Remove friend error:', error);
        res.status(500).json({ error: 'Failed to remove friend' });
    }
});

export default router;
