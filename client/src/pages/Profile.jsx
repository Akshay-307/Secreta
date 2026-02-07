/**
 * Profile Page
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api/client';
import { getAvatar, saveAvatar, processAvatar, deleteAvatar } from '../crypto/avatarManager';
import { exportKeyBackup, importKeyBackup } from '../crypto/keyManager';
import './Profile.css';

export default function Profile() {
    const { user, logout, clearAllData } = useAuth();
    const { theme, toggleTheme } = useTheme();
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

    const handleExportKeys = async () => {
        const password = prompt('Enter a password to protect your backup:');
        if (!password) return;

        try {
            setLoading(true);
            const backup = await exportKeyBackup(password);

            // Download as file
            const blob = new Blob([backup], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `secreta-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);

            setMessage('Backup exported successfully!');
        } catch (error) {
            console.error('Export error:', error);
            setMessage('Failed to export backup');
        } finally {
            setLoading(false);
        }
    };

    const handleImportKeys = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const password = prompt('Enter the backup password:');
            if (!password) return;

            setLoading(true);
            try {
                const text = await file.text();
                await importKeyBackup(text, password);
                setMessage('Keys restored! Please refresh the page.');
            } catch (error) {
                console.error('Import error:', error);
                setMessage('Failed to import backup. Wrong password?');
            } finally {
                setLoading(false);
            }
        };
        input.click();
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
                    <h2>Appearance</h2>
                    <div className="theme-toggle-row">
                        <span>Dark Mode</span>
                        <button
                            className={`theme-toggle ${theme === 'dark' ? 'active' : ''}`}
                            onClick={toggleTheme}
                        >
                            <span className="toggle-slider" />
                        </button>
                    </div>
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

                    <div className="key-backup-actions">
                        <button className="backup-btn" onClick={handleExportKeys}>
                            📤 Export Key Backup
                        </button>
                        <button className="backup-btn" onClick={handleImportKeys}>
                            📥 Import Key Backup
                        </button>
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
