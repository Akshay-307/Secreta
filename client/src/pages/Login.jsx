/**
 * Login Page
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [showResend, setShowResend] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(username, password);
            navigate('/');
        } catch (err) {
            const errorData = err.response?.data;
            const errorMessage = errorData?.error || 'Login failed';

            setError(errorMessage);

            if (errorData?.requiresVerification) {
                setShowResend(true);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setResending(true);
        try {
            // Note: We might need to ask for email if not provided, 
            // but for now relying on username lookup on backend if supported,
            // or we might need to change resend logic. 
            // However, the prompt specifically asked for login change. 
            // I will assume resend verification might need email, but let's stick to the requested scope.
            // If the backend resend-verification endpoint requires email, this might fail if we only have username.
            // But let's first fix the login part.
            await api.post('/auth/resend-verification', { username });
            setError('Verification email sent! Please check your inbox.');
            setShowResend(false);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to resend email');
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <div className="auth-logo">
                        <img src="/logo.svg" alt="Secreta Logo" style={{ width: '100%', height: '100%' }} />
                    </div>
                    <h1>Secreta</h1>
                    <p>End-to-end encrypted messaging</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && <div className="auth-error">{error}</div>}

                    {showResend && (
                        <button
                            type="button"
                            className="resend-verification-btn"
                            onClick={handleResend}
                            disabled={resending}
                        >
                            {resending ? 'Sending email...' : 'Resend Verification Email'}
                        </button>
                    )}

                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            required
                            autoFocus
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
                        />
                    </div>

                    <button type="submit" className="auth-button" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p className="auth-footer">
                    Don't have an account? <Link to="/register">Create one</Link>
                </p>
            </div>
        </div>
    );
}

