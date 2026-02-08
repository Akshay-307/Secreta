import mongoose from 'mongoose';

/**
 * User Schema
 * 
 * SECURITY NOTES:
 * - passwordHash: Stored using bcrypt (cost factor 12)
 * - publicKey: JWK format ECDH public key for E2EE
 * - Private keys are NEVER stored on the server
 */
const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 30,
        index: true
    },
    passwordHash: {
        type: String,
        required: true
    },
    /**
     * Public key in JWK (JSON Web Key) format
     * Used for ECDH key exchange in E2EE
     * Format: { kty: "EC", crv: "P-256", x: "...", y: "..." }
     */
    publicKey: {
        type: Object,
        default: null
    },
    refreshToken: {
        type: String,
        default: null
    },
    /**
     * Avatar stored as base64 data URL (max ~50KB compressed)
     */
    avatar: {
        type: String,
        default: null
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },
    // Email verification
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: {
        type: String,
        default: null
    },
    verificationExpires: {
        type: Date,
        default: null
    },
    // User status (shown to friends)
    status: {
        text: {
            type: String,
            maxlength: 100,
            default: ''
        },
        emoji: {
            type: String,
            default: ''
        },
        updatedAt: {
            type: Date,
            default: Date.now
        }
    },
    // User bio
    bio: {
        type: String,
        maxlength: 150,
        default: ''
    }
}, {
    timestamps: true
});

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function () {
    const user = this.toObject();
    delete user.passwordHash;
    delete user.refreshToken;
    return user;
};

const User = mongoose.model('User', userSchema);

export default User;
