/**
 * Profile Page
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { getAvatar, saveAvatar, processAvatar, deleteAvatar } from '../crypto/avatarManager';
import './Profile.css';

export default function Profile() {
    const { user, logout, clearAllData } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [avatar, setAvatar] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        loadAvatar();
    }, []);

    const loadAvatar = async () => {
        const savedAvatar = await getAvatar();
        setAvatar(savedAvatar);
    };

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setMessage('Please select an image file');
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            const processed = await processAvatar(file, 200);
            await saveAvatar(processed);
            // Sync to server so friends can see it
            await api.put('/avatar', { avatar: processed });
            setAvatar(processed);
            setMessage('Avatar updated!');
        } catch (error) {
            console.error('Failed to process avatar:', error);
            setMessage('Failed to update avatar');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveAvatar = async () => {
        await deleteAvatar();
        // Remove from server too
        await api.delete('/avatar').catch(console.error);
        setAvatar(null);
        setMessage('Avatar removed');
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const handleClearData = async () => {
        if (confirm('This will delete all your encryption keys. You will not be able to read old messages. Continue?')) {
            await clearAllData();
            navigate('/login');
        }
    };

    return (
        <div className="profile-page">
            <div className="profile-card glass-card-light">
                <button className="back-button" onClick={() => navigate('/')}>
                    ← Back
                </button>

                <div className="profile-header">
                    <div
                        className={`avatar-container ${loading ? 'loading' : ''}`}
                        onClick={handleAvatarClick}
                    >
                        {avatar ? (
                            <img src={avatar} alt="Avatar" className="avatar-image" />
                        ) : (
                            <div className="avatar-placeholder">
                                {user?.username?.[0]?.toUpperCase() || '?'}
                            </div>
                        )}
                        <div className="avatar-overlay">
                            <span>📷</span>
                        </div>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />

                    <h1 className="profile-username">{user?.username}</h1>
                    <p className="profile-email">{user?.email}</p>

                    {message && <p className="profile-message">{message}</p>}

                    {avatar && (
                        <button className="remove-avatar-btn" onClick={handleRemoveAvatar}>
                            Remove Avatar
                        </button>
                    )}
                </div>

                <div className="profile-section">
                    <h2>Security</h2>
                    <div className="security-info">
                        <div className="security-item">
                            <span className="security-icon">🔐</span>
                            <div>
                                <strong>End-to-End Encryption</strong>
                                <p>Your messages are encrypted with P-256 ECDH + AES-256-GCM</p>
                            </div>
                        </div>
                        <div className="security-item">
                            <span className="security-icon">🔑</span>
                            <div>
                                <strong>Private Keys</strong>
                                <p>Stored locally in your browser - never leave your device</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="profile-actions">
                    <button className="logout-btn" onClick={handleLogout}>
                        Sign Out
                    </button>
                    <button className="danger-btn" onClick={handleClearData}>
                        Clear All Data & Keys
                    </button>
                </div>
            </div>
        </div>
    );
}
