/**
 * Login Page
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function Login() {
    const [email, setEmail] = useState('');
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
            await login(email, password);
            navigate('/');
        } catch (err) {
            const errorData = err.response?.data;
            setError(errorData?.error || 'Login failed');

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
            await api.post('/auth/resend-verification', { email });
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
