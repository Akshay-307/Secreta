import mongoose from 'mongoose';

/**
 * Message Schema
 * 
 * SECURITY NOTES:
 * - Messages are stored ENCRYPTED - server cannot read content
 * - Each message is encrypted TWICE: once for recipient, once for sender
 * - This allows both parties to decrypt their own copy of the conversation
 * - Server only relays encrypted blobs between clients
 */

// Sub-schema for encrypted payload
const encryptedPayloadSchema = new mongoose.Schema({
    // Ephemeral public key (JWK format) for this message
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
}, { _id: false });

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
     * Encrypted for recipient (using recipient's public key)
     * Only the recipient can decrypt this
     */
    encryptedForRecipient: encryptedPayloadSchema,
    /**
     * Encrypted for sender (using sender's public key)
     * Only the sender can decrypt this
     */
    encryptedForSender: encryptedPayloadSchema,
    /**
     * Legacy field for backwards compatibility
     * @deprecated Use encryptedForRecipient/encryptedForSender instead
     */
    encrypted: {
        ephemeralPublicKey: Object,
        iv: String,
        ciphertext: String
    },
    // Message delivery status
    delivered: {
        type: Boolean,
        default: false
    },
    read: {
        type: Boolean,
        default: false
    },
    // Emoji reactions: array of { emoji: string, userId: ObjectId }
    reactions: [{
        emoji: { type: String, required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
    }],
    // Reply to another message
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null
    },
    // Preview of the replied message (encrypted)
    replyPreview: {
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        // Encrypted content preview
        encryptedPreview: {
            ephemeralPublicKey: Object,
            iv: String,
            ciphertext: String
        }
    },
    // File attachment support
    fileAttachment: {
        fileId: String,          // GridFS file ID
        fileName: String,        // Original filename
        fileSize: Number,        // Size in bytes  
        mimeType: String,        // MIME type
        // Encrypted file metadata (for secure filename etc)
        encryptedMetadata: {
            ephemeralPublicKey: Object,
            iv: String,
            ciphertext: String
        }
    },
    // Message type: 'text', 'file', 'voice', 'image'
    messageType: {
        type: String,
        enum: ['text', 'file', 'voice', 'image'],
        default: 'text'
    },
    // Voice message specific fields
    voiceDuration: {
        type: Number,
        default: null
    },
    voiceWaveform: {
        type: [Number],
        default: []
    },
    // Disappearing messages support
    isEphemeral: {
        type: Boolean,
        default: false
    },
    expiresAt: {
        type: Date,
        default: null,
        index: true // Index for efficient cleanup queries
    }
}, {
    timestamps: true
});

// Compound index for efficient conversation queries
messageSchema.index({ senderId: 1, recipientId: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;
