/**
 * Friend Search Modal
 * 
 * Search for users and send friend requests
 */

import { useState } from 'react';
import api from '../api/client';
import './Modal.css';

export default function FriendSearch({ onClose, onFriendAdded }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async (e) => {
        e.preventDefault();
        if (query.length < 2) return;

        setLoading(true);
        setError('');

        try {
            const response = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
            setResults(response.data);
        } catch (err) {
            setError('Search failed');
        } finally {
            setLoading(false);
        }
    };

    const sendRequest = async (userId) => {
        try {
            await api.post(`/friends/request/${userId}`);
            // Update the result to show pending
            setResults(prev =>
                prev.map(u =>
                    u.id === userId ? { ...u, friendshipStatus: 'pending' } : u
                )
            );
            onFriendAdded();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send request');
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <header className="modal-header">
                    <h2>Add Friend</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </header>

                <form onSubmit={handleSearch} className="search-form">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by username..."
                        className="search-input"
                        autoFocus
                    />
                    <button type="submit" className="search-button" disabled={loading || query.length < 2}>
                        🔍
                    </button>
                </form>

                {error && <div className="modal-error">{error}</div>}

                <div className="search-results">
                    {results.length === 0 && query.length >= 2 && !loading && (
                        <p className="no-results">No users found</p>
                    )}

                    {results.map(user => (
                        <div key={user.id} className="search-result-item">
                            <div className="result-avatar">
                                {user.username[0].toUpperCase()}
                            </div>
                            <div className="result-info">
                                <span className="result-username">{user.username}</span>
                                {user.hasPublicKey && <span className="result-encrypted">🔒</span>}
                            </div>
                            <div className="result-action">
                                {user.friendshipStatus === 'accepted' ? (
                                    <span className="status-badge friends">Friends</span>
                                ) : user.friendshipStatus === 'pending' ? (
                                    <span className="status-badge pending">Pending</span>
                                ) : (
                                    <button
                                        className="add-friend-btn"
                                        onClick={() => sendRequest(user.id)}
                                    >
                                        Add
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
