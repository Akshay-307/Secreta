/**
 * Blocked Users Component
 * 
 * Displays list of blocked users with unblock option
 */

import { useState, useEffect } from 'react';
import api from '../api/client';
import './Modal.css';

export default function BlockedUsers({ onClose }) {
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadBlockedUsers();
    }, []);

    const loadBlockedUsers = async () => {
        try {
            const res = await api.get('/friends/blocked');
            setBlockedUsers(res.data);
        } catch (error) {
            console.error('Failed to load blocked users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUnblock = async (userId) => {
        try {
            await api.delete(`/friends/block/${userId}`);
            setBlockedUsers(blockedUsers.filter(u => u.id !== userId));
        } catch (error) {
            console.error('Failed to unblock user:', error);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content glass-card-light" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Blocked Users</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    {loading ? (
                        <div className="loading-state">Loading...</div>
                    ) : blockedUsers.length === 0 ? (
                        <div className="empty-state">
                            <span className="empty-icon">🚫</span>
                            <p>No blocked users</p>
                        </div>
                    ) : (
                        <div className="blocked-list">
                            {blockedUsers.map(user => (
                                <div key={user.id} className="blocked-item">
                                    <div className="blocked-avatar">
                                        {user.avatar ? (
                                            <img src={user.avatar} alt={user.username} />
                                        ) : (
                                            user.username[0].toUpperCase()
                                        )}
                                    </div>
                                    <div className="blocked-info">
                                        <div className="blocked-name">{user.username}</div>
                                        <div className="blocked-date">
                                            Blocked {new Date(user.blockedAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <button
                                        className="unblock-btn"
                                        onClick={() => handleUnblock(user.id)}
                                    >
                                        Unblock
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
