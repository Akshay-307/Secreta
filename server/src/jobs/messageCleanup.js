/**
 * Message Cleanup Job
 * 
 * Periodically deletes expired ephemeral messages.
 * Runs every 15 minutes to clean up messages past their expiration time.
 */

import Message from '../models/Message.js';

// Run cleanup every 15 minutes
const CLEANUP_INTERVAL = 15 * 60 * 1000;

/**
 * Delete all expired messages
 */
async function cleanupExpiredMessages() {
    try {
        const now = new Date();
        const result = await Message.deleteMany({
            isEphemeral: true,
            expiresAt: { $lte: now }
        });

        if (result.deletedCount > 0) {
            console.log(`✓ Cleaned up ${result.deletedCount} expired messages`);
        }
    } catch (error) {
        console.error('Message cleanup error:', error);
    }
}

/**
 * Start the cleanup scheduler
 */
export function startMessageCleanup() {
    // Run immediately on startup
    cleanupExpiredMessages();

    // Schedule periodic cleanup
    setInterval(cleanupExpiredMessages, CLEANUP_INTERVAL);
    console.log('✓ Message cleanup job started (every 15 minutes)');
}

export default { startMessageCleanup };
