import mongoose from 'mongoose';

/**
 * Friendship Schema
 * 
 * Manages friend relationships for the chat application.
 * Users can only message accepted friends.
 */
const friendshipSchema = new mongoose.Schema({
    requester: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    }
}, {
    timestamps: true
});

// Compound index for efficient friendship queries
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });
friendshipSchema.index({ recipient: 1, status: 1 });

const Friendship = mongoose.model('Friendship', friendshipSchema);

export default Friendship;
