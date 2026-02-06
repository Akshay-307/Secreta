import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendVerificationEmail } from '../config/emailService.js';

const router = express.Router();

// Bcrypt cost factor - higher = more secure but slower
const BCRYPT_ROUNDS = 12;

// Token expiration times
const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '7d';
const VERIFICATION_TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate JWT tokens
 */
const generateTokens = (userId) => {
    const accessToken = jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
        { userId },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    return { accessToken, refreshToken };
};

/**
 * Generate email verification token
 */
const generateVerificationToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * POST /api/auth/register
 * 
 * Register a new user with email, username, and password.
 * Sends verification email before allowing login.
 */
router.post('/register', async (req, res) => {
    try {
        const { email, username, password, publicKey } = req.body;

        // Validate required fields
        if (!email || !username || !password) {
            return res.status(400).json({ error: 'Email, username, and password are required' });
        }

        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email: email.toLowerCase() }, { username }]
        });

        if (existingUser) {
            return res.status(409).json({
                error: existingUser.email === email.toLowerCase()
                    ? 'Email already registered'
                    : 'Username already taken'
            });
        }

        // Hash password with bcrypt
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        // Generate verification token
        const verificationToken = generateVerificationToken();
        const verificationExpires = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY);

        // Create user (not verified yet)
        const user = new User({
            email: email.toLowerCase(),
            username,
            passwordHash,
            publicKey: publicKey || null,
            isVerified: false,
            verificationToken,
            verificationExpires
        });

        await user.save();

        // Send verification email
        const emailSent = await sendVerificationEmail(email, username, verificationToken);

        if (!emailSent) {
            // FALLBACK: If email service fails (e.g. Render firewall), auto-verify user
            // so they are not locked out of their own app.
            console.log('⚠ Email failed to send. Auto-verifying user for deployment capability.');
            user.isVerified = true;
            user.verificationToken = null;
            user.verificationExpires = null;
            await user.save();
        }

        res.status(201).json({
            message: emailSent
                ? 'Registration successful! Please check your email to verify your account.'
                : 'Account created! Email service was unavailable, so we auto-verified you.',
            requiresVerification: emailSent, // Only require verification if email actually sent
            emailSent
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * GET /api/auth/verify/:token
 * 
 * Verify user's email address
 */
router.get('/verify/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const user = await User.findOne({
            verificationToken: token,
            verificationExpires: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired verification link' });
        }

        // Mark as verified
        user.isVerified = true;
        user.verificationToken = null;
        user.verificationExpires = null;
        await user.save();

        res.json({ message: 'Email verified successfully! You can now log in.' });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
});

/**
 * POST /api/auth/resend-verification
 * 
 * Resend verification email
 */
router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            // Don't reveal if email exists
            return res.json({ message: 'If the email exists, a verification link has been sent.' });
        }

        if (user.isVerified) {
            return res.status(400).json({ error: 'Email is already verified' });
        }

        // Generate new token
        const verificationToken = generateVerificationToken();
        const verificationExpires = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY);

        user.verificationToken = verificationToken;
        user.verificationExpires = verificationExpires;
        await user.save();

        await sendVerificationEmail(user.email, user.username, verificationToken);

        res.json({ message: 'If the email exists, a verification link has been sent.' });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ error: 'Failed to resend verification email' });
    }
});

/**
 * POST /api/auth/login
 * 
 * Authenticate user with email and password
 * Only allows verified users to log in
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user by email
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if email is verified
        if (!user.isVerified) {
            return res.status(403).json({
                error: 'Please verify your email before logging in',
                requiresVerification: true,
                email: user.email
            });
        }

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user._id);

        // Update refresh token and last seen
        user.refreshToken = refreshToken;
        user.lastSeen = new Date();
        await user.save();

        res.json({
            message: 'Login successful',
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                publicKey: user.publicKey,
                isVerified: user.isVerified
            },
            accessToken,
            refreshToken
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * POST /api/auth/refresh
 * 
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        // Find user and verify stored refresh token
        const user = await User.findById(decoded.userId);
        if (!user || user.refreshToken !== refreshToken) {
            return res.status(403).json({ error: 'Invalid refresh token' });
        }

        // Generate new tokens
        const tokens = generateTokens(user._id);

        // Update stored refresh token
        user.refreshToken = tokens.refreshToken;
        await user.save();

        res.json({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
        });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(403).json({ error: 'Refresh token expired' });
        }
        res.status(403).json({ error: 'Invalid refresh token' });
    }
});

/**
 * POST /api/auth/logout
 * 
 * Invalidate refresh token
 */
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user.userId, { refreshToken: null });
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Logout failed' });
    }
});

/**
 * GET /api/auth/me
 * 
 * Get current user info
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            id: user._id,
            email: user.email,
            username: user.username,
            publicKey: user.publicKey,
            isVerified: user.isVerified
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

/**
 * PUT /api/auth/public-key
 * 
 * Update user's public key (used during initial setup or key rotation)
 */
router.put('/public-key', authenticateToken, async (req, res) => {
    try {
        const { publicKey } = req.body;

        if (!publicKey || !publicKey.kty || !publicKey.crv) {
            return res.status(400).json({ error: 'Valid JWK public key required' });
        }

        await User.findByIdAndUpdate(req.user.userId, { publicKey });

        res.json({ message: 'Public key updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update public key' });
    }
});

export default router;
