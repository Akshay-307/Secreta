import mongoose from 'mongoose';

/**
 * Message Schema
 * 
 * SECURITY NOTES:
 * - Messages are stored ENCRYPTED - server cannot read content
 * - encrypted.ephemeralPublicKey: Used for ECDH key derivation
 * - encrypted.iv: Initialization vector for AES-GCM
 * - encrypted.ciphertext: The encrypted message content
 * - Server only relays encrypted blobs between clients
 */
const messageSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    /**
     * Encrypted message payload
     * All encryption/decryption happens CLIENT-SIDE
     */
    encrypted: {
        // Sender's ephemeral public key (JWK format) for this message
        ephemeralPublicKey: {
            type: Object,
            required: true
        },
        // Initialization vector (Base64 encoded)
        iv: {
            type: String,
            required: true
        },
        // Encrypted message content (Base64 encoded)
        ciphertext: {
            type: String,
            required: true
        }
    },
    // Message delivery status
    delivered: {
        type: Boolean,
        default: false
    },
    read: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Compound index for efficient conversation queries
messageSchema.index({ senderId: 1, recipientId: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;
