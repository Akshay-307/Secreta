/**
 * Register Page
 * 
 * Shows verification message after registration
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { initializeKeys } from '../crypto/keyManager';
import './Auth.css';

export default function Register() {
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [registered, setRegistered] = useState(false);
    const [resending, setResending] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        if (username.length < 3) {
            setError('Username must be at least 3 characters');
            return;
        }

        setLoading(true);

        try {
            // Generate encryption keys
            const publicKey = await initializeKeys();

            // Register (don't auto-login since email verification required)
            await api.post('/auth/register', {
                email,
                username,
                password,
                publicKey
            });

            setRegistered(true);
        } catch (err) {
            setError(err.response?.data?.error || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    const handleResendVerification = async () => {
        setResending(true);
        try {
            await api.post('/auth/resend-verification', { email });
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to resend');
        } finally {
            setResending(false);
        }
    };

    // Show verification pending screen
    if (registered) {
        return (
            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-header">
                        <div className="auth-logo">📧</div>
                        <h1>Check Your Email</h1>
                        <p>We sent a verification link to</p>
                        <p className="verification-email">{email}</p>
                    </div>

                    <div className="verification-info">
                        <p>Click the link in your email to verify your account and start messaging securely.</p>
                        <p className="verification-hint">Don't see it? Check your spam folder.</p>
                    </div>

                    <button
                        className="resend-btn"
                        onClick={handleResendVerification}
                        disabled={resending}
                    >
                        {resending ? 'Sending...' : 'Resend verification email'}
                    </button>

                    <p className="auth-footer">
                        Already verified? <Link to="/login">Sign in</Link>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <div className="auth-logo">
                        <img src="/logo.svg" alt="Secreta Logo" style={{ width: '100%', height: '100%' }} />
                    </div>
                    <h1>Join Secreta</h1>
                    <p>Create your secure account</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && <div className="auth-error">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="johndoe"
                            required
                            minLength={3}
                            maxLength={30}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={8}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button type="submit" className="auth-button" disabled={loading}>
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>

                    <div className="auth-security-note">
                        <span>🔒</span>
                        <p>Encryption keys will be generated locally on your device</p>
                    </div>
                </form>

                <p className="auth-footer">
                    Already have an account? <Link to="/login">Sign in</Link>
                </p>
            </div>
        </div>
    );
}
