/**
 * Friend Requests Modal
 * 
 * View and respond to pending friend requests
 */

import { useState, useEffect } from 'react';
import api from '../api/client';
import './Modal.css';

export default function FriendRequests({ onClose, onRequestHandled }) {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            const response = await api.get('/friends/requests');
            setRequests(response.data);
        } catch (error) {
            console.error('Failed to fetch requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async (requestId) => {
        try {
            await api.put(`/friends/accept/${requestId}`);
            setRequests(prev => prev.filter(r => r.id !== requestId));
            onRequestHandled();
        } catch (error) {
            console.error('Failed to accept:', error);
        }
    };

    const handleReject = async (requestId) => {
        try {
            await api.put(`/friends/reject/${requestId}`);
            setRequests(prev => prev.filter(r => r.id !== requestId));
            onRequestHandled();
        } catch (error) {
            console.error('Failed to reject:', error);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <header className="modal-header">
                    <h2>Friend Requests</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </header>

                <div className="requests-list">
                    {loading ? (
                        <p className="loading-text">Loading...</p>
                    ) : requests.length === 0 ? (
                        <p className="no-results">No pending requests</p>
                    ) : (
                        requests.map(request => (
                            <div key={request.id} className="request-item">
                                <div className="result-avatar">
                                    {request.from.username[0].toUpperCase()}
                                </div>
                                <div className="result-info">
                                    <span className="result-username">{request.from.username}</span>
                                </div>
                                <div className="request-actions">
                                    <button
                                        className="accept-btn"
                                        onClick={() => handleAccept(request.id)}
                                    >
                                        ✓
                                    </button>
                                    <button
                                        className="reject-btn"
                                        onClick={() => handleReject(request.id)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
