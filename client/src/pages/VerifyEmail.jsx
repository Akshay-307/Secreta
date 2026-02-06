/**
 * Email Verification Page
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import './Auth.css';

export default function VerifyEmail() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('verifying'); // verifying, success, error
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (token) {
            verifyEmail();
        }
    }, [token]);

    const verifyEmail = async () => {
        try {
            const response = await api.get(`/auth/verify/${token}`);
            setStatus('success');
            setMessage(response.data.message);

            // Redirect to login after 3 seconds
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (error) {
            setStatus('error');
            setMessage(error.response?.data?.error || 'Verification failed');
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    {status === 'verifying' && (
                        <>
                            <div className="auth-logo spinning">⏳</div>
                            <h1>Verifying...</h1>
                            <p>Please wait while we verify your email</p>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div className="auth-logo">✅</div>
                            <h1>Email Verified!</h1>
                            <p>{message}</p>
                            <p className="redirect-text">Redirecting to login...</p>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <div className="auth-logo">❌</div>
                            <h1>Verification Failed</h1>
                            <p>{message}</p>
                        </>
                    )}
                </div>

                <div className="verify-actions">
                    {status === 'error' && (
                        <Link to="/login" className="auth-button">
                            Go to Login
                        </Link>
                    )}

                    {status === 'success' && (
                        <Link to="/login" className="auth-button">
                            Login Now
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
