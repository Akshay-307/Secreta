import mongoose from 'mongoose';

/**
 * BlockedUser Schema
 * 
 * Manages blocked users for privacy and security.
 * Blocked users cannot send messages or see online status.
 */
const blockedUserSchema = new mongoose.Schema({
    blockerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    blockedId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Compound index for efficient lookups
blockedUserSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

const BlockedUser = mongoose.model('BlockedUser', blockedUserSchema);

export default BlockedUser;
