/**
 * Email Service
 * 
 * Handles sending verification and notification emails
 * Uses Nodemailer with SMTP
 */

import nodemailer from 'nodemailer';

// Create transporter - configure these in .env
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: parseInt(process.env.SMTP_PORT) === 465, // True for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    // Timeout settings to prevent hanging (10 seconds)
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    // Force IPv4 as some environments (Render) have issues with IPv6
    family: 4,
    dnsResolution: 4 // Force DNS to resolve to IPv4
});

/**
 * Send verification email to new user
 * @param {string} email - User's email address
 * @param {string} username - User's username  
 * @param {string} token - Verification token
 */
export async function sendVerificationEmail(email, username, token) {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const verifyUrl = `${clientUrl}/verify/${token}`;

    const mailOptions = {
        from: `"Secreta" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
        to: email,
        subject: '🔐 Verify your Secreta account',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f23; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 500px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 40px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 20px;">🔐</div>
            <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0 0 10px;">Welcome to Secreta</h1>
            <p style="color: #a1a1aa; font-size: 16px; margin: 0 0 30px;">Hi ${username}, verify your email to start messaging securely.</p>
            
            <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
                Verify Email
            </a>
            
            <p style="color: #6b7280; font-size: 13px; margin: 30px 0 0;">This link expires in 24 hours.</p>
            <p style="color: #6b7280; font-size: 12px; margin: 15px 0 0;">If you didn't create an account, ignore this email.</p>
        </div>
        <p style="color: #4b5563; font-size: 11px; text-align: center; margin-top: 20px;">
            Secreta - End-to-end encrypted messaging
        </p>
    </div>
</body>
</html>
        `,
        text: `Welcome to Secreta, ${username}!\n\nVerify your email by clicking this link:\n${verifyUrl}\n\nThis link expires in 24 hours.`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✓ Verification email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('✗ Failed to send verification email:', error.message);
        return false;
    }
}

/**
 * Verify SMTP connection is working
 */
export async function verifyEmailConnection() {
    try {
        await transporter.verify();
        console.log('✓ Email service connected');
        return true;
    } catch (error) {
        console.warn('⚠ Email service not configured:', error.message);
        return false;
    }
}

export default { sendVerificationEmail, verifyEmailConnection };
