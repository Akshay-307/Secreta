import Message from '../models/Message.js';
import Friendship from '../models/Friendship.js';
import User from '../models/User.js';

// Map of userId -> Set of socket IDs (for multiple tabs/devices)
// Exported for use in routes (e.g., friend request notifications)
export const userSockets = new Map();

/**
 * Socket.IO Event Handlers
 * 
 * SECURITY NOTES:
 * - All messages are pre-encrypted by the client
 * - Server only relays encrypted blobs
 * - Server cannot read message content
 */
export const setupSocketHandlers = (io) => {
    io.on('connection', (socket) => {
        const userId = socket.user.userId;
        console.log(`✓ User connected: ${userId}`);

        // Track socket connection
        if (!userSockets.has(userId)) {
            userSockets.set(userId, new Set());
        }
        userSockets.get(userId).add(socket.id);

        // Update last seen
        User.findByIdAndUpdate(userId, { lastSeen: new Date() }).catch(console.error);

        // Notify friends that user is online
        notifyFriendsOfStatus(io, userId, 'online');

        /**
         * Handle sending encrypted messages
         * 
         * Expected payload:
         * {
         *   recipientId: string,
         *   encryptedForRecipient: {
         *     ephemeralPublicKey: JWK,
         *     iv: string (base64),
         *     ciphertext: string (base64)
         *   },
         *   encryptedForSender: {
         *     ephemeralPublicKey: JWK,
         *     iv: string (base64),
         *     ciphertext: string (base64)
         *   }
         * }
         */
        socket.on('send_message', async (data, callback) => {
            try {
                const { recipientId, encryptedForRecipient, encryptedForSender, encrypted } = data;

                // Support both new dual-encryption and legacy single encryption
                const forRecipient = encryptedForRecipient || encrypted;
                const forSender = encryptedForSender;

                // Validate payload
                if (!recipientId || !forRecipient || !forRecipient.ephemeralPublicKey ||
                    !forRecipient.iv || !forRecipient.ciphertext) {
                    return callback({ error: 'Invalid message payload' });
                }

                // Verify friendship
                const friendship = await Friendship.findOne({
                    $or: [
                        { requester: userId, recipient: recipientId, status: 'accepted' },
                        { requester: recipientId, recipient: userId, status: 'accepted' }
                    ]
                });

                if (!friendship) {
                    return callback({ error: 'Not friends with this user' });
                }

                // Save encrypted message with both versions
                const message = new Message({
                    senderId: userId,
                    recipientId,
                    encryptedForRecipient: {
                        ephemeralPublicKey: forRecipient.ephemeralPublicKey,
                        iv: forRecipient.iv,
                        ciphertext: forRecipient.ciphertext
                    },
                    encryptedForSender: forSender ? {
                        ephemeralPublicKey: forSender.ephemeralPublicKey,
                        iv: forSender.iv,
                        ciphertext: forSender.ciphertext
                    } : null,
                    // Keep legacy field for backward compatibility
                    encrypted: {
                        ephemeralPublicKey: forRecipient.ephemeralPublicKey,
                        iv: forRecipient.iv,
                        ciphertext: forRecipient.ciphertext
                    }
                });

                await message.save();

                // Prepare message for delivery
                const messageData = {
                    _id: message._id,
                    senderId: userId,
                    recipientId,
                    encryptedForRecipient: message.encryptedForRecipient,
                    encryptedForSender: message.encryptedForSender,
                    encrypted: message.encryptedForRecipient, // Legacy support
                    createdAt: message.createdAt,
                    delivered: false,
                    read: false
                };

                // Send to recipient if online
                const recipientSockets = userSockets.get(recipientId);
                if (recipientSockets && recipientSockets.size > 0) {
                    recipientSockets.forEach(socketId => {
                        io.to(socketId).emit('new_message', messageData);
                    });

                    // Mark as delivered
                    message.delivered = true;
                    await message.save();
                    messageData.delivered = true;
                }

                // Confirm to sender
                callback({ success: true, message: messageData });
            } catch (error) {
                console.error('Send message error:', error);
                callback({ error: 'Failed to send message' });
            }
        });

        /**
         * Handle typing indicator
         * No message content is sent - just the fact that user is typing
         */
        socket.on('typing', async (data) => {
            const { recipientId, isTyping } = data;

            const recipientSockets = userSockets.get(recipientId);
            if (recipientSockets) {
                recipientSockets.forEach(socketId => {
                    io.to(socketId).emit('user_typing', {
                        userId,
                        isTyping
                    });
                });
            }
        });

        /**
         * Handle adding emoji reaction to a message
         */
        socket.on('add_reaction', async (data, callback) => {
            const { messageId, emoji, recipientId } = data;

            try {
                const message = await Message.findById(messageId);
                if (!message) {
                    return callback?.({ error: 'Message not found' });
                }

                // Check if user already reacted with this emoji
                const existingReaction = message.reactions?.find(
                    r => r.userId.toString() === userId && r.emoji === emoji
                );

                if (existingReaction) {
                    // Remove reaction (toggle off)
                    message.reactions = message.reactions.filter(
                        r => !(r.userId.toString() === userId && r.emoji === emoji)
                    );
                } else {
                    // Add reaction
                    if (!message.reactions) message.reactions = [];
                    message.reactions.push({ emoji, userId });
                }

                await message.save();

                const reactionData = {
                    messageId,
                    reactions: message.reactions
                };

                // Notify both users
                const recipientSockets = userSockets.get(recipientId);
                if (recipientSockets) {
                    recipientSockets.forEach(socketId => {
                        io.to(socketId).emit('reaction_updated', reactionData);
                    });
                }

                // Also notify sender's other tabs
                const senderSockets = userSockets.get(userId);
                if (senderSockets) {
                    senderSockets.forEach(socketId => {
                        io.to(socketId).emit('reaction_updated', reactionData);
                    });
                }

                callback?.({ success: true, reactions: message.reactions });
            } catch (error) {
                console.error('Add reaction error:', error);
                callback?.({ error: 'Failed to add reaction' });
            }
        });

        /**
         * Handle message read receipt
         */
        socket.on('mark_read', async (data) => {
            const { messageIds, senderId } = data;

            try {
                await Message.updateMany(
                    { _id: { $in: messageIds }, recipientId: userId },
                    { read: true }
                );

                // Notify sender
                const senderSockets = userSockets.get(senderId);
                if (senderSockets) {
                    senderSockets.forEach(socketId => {
                        io.to(socketId).emit('messages_read', {
                            messageIds,
                            readBy: userId
                        });
                    });
                }
            } catch (error) {
                console.error('Mark read error:', error);
            }
        });

        /**
         * Handle disconnect
         */
        socket.on('disconnect', () => {
            console.log(`✗ User disconnected: ${userId}`);

            // Remove socket from tracking
            const sockets = userSockets.get(userId);
            if (sockets) {
                sockets.delete(socket.id);
                if (sockets.size === 0) {
                    userSockets.delete(userId);
                    // Notify friends that user is offline
                    User.findByIdAndUpdate(userId, { lastSeen: new Date() }).catch(console.error);
                    notifyFriendsOfStatus(io, userId, 'offline');
                }
            }
        });
    });
};

/**
 * Notify friends when user comes online/offline
 */
async function notifyFriendsOfStatus(io, userId, status) {
    try {
        const friendships = await Friendship.find({
            $or: [
                { requester: userId, status: 'accepted' },
                { recipient: userId, status: 'accepted' }
            ]
        });

        friendships.forEach(f => {
            const friendId = f.requester.toString() === userId
                ? f.recipient.toString()
                : f.requester.toString();

            const friendSockets = userSockets.get(friendId);
            if (friendSockets) {
                friendSockets.forEach(socketId => {
                    io.to(socketId).emit('friend_status', { userId, status });
                });
            }
        });
    } catch (error) {
        console.error('Notify friends error:', error);
    }
}

export default { setupSocketHandlers };
