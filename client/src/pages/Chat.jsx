/**
 * Main Chat Page
 * 
 * The primary chat interface showing friend list
 * and message conversation
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { getSocket } from '../api/socket';
import { encryptMessage, decryptMessage } from '../crypto/encryption';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import FriendSearch from '../components/FriendSearch';
import FriendRequests from '../components/FriendRequests';
import './Chat.css';

export default function Chat() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // State
    const [friends, setFriends] = useState([]);
    const [selectedFriend, setSelectedFriend] = useState(null);
    const [messages, setMessages] = useState([]);
    const [friendPublicKeys, setFriendPublicKeys] = useState({});
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [typingUsers, setTypingUsers] = useState(new Set());
    const [showSearch, setShowSearch] = useState(false);
    const [showRequests, setShowRequests] = useState(false);
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
    const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);

    // Fetch friends list
    const fetchFriends = useCallback(async () => {
        try {
            const response = await api.get('/friends');
            setFriends(response.data);
        } catch (error) {
            console.error('Failed to fetch friends:', error);
        }
    }, []);

    // Fetch pending requests count
    const fetchPendingRequests = useCallback(async () => {
        try {
            const response = await api.get('/friends/requests');
            setPendingRequestsCount(response.data.length);
        } catch (error) {
            console.error('Failed to fetch requests:', error);
        }
    }, []);

    // Fetch messages for selected friend
    const fetchMessages = useCallback(async (friendId) => {
        try {
            const response = await api.get(`/messages/${friendId}`);

            // Decrypt all messages
            const decryptedMessages = await Promise.all(
                response.data.map(async (msg) => {
                    try {
                        const decryptedContent = await decryptMessage(msg.encrypted);
                        return { ...msg, content: decryptedContent };
                    } catch (error) {
                        console.error('Failed to decrypt message:', error);
                        return { ...msg, content: '[Unable to decrypt]' };
                    }
                })
            );

            setMessages(decryptedMessages);

            // Mark as read
            api.put(`/messages/read/${friendId}`).catch(console.error);
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        }
    }, []);

    // Get friend's public key
    const getFriendPublicKey = useCallback(async (friendId) => {
        if (friendPublicKeys[friendId]) {
            return friendPublicKeys[friendId];
        }

        try {
            const response = await api.get(`/users/${friendId}/public-key`);
            const publicKey = response.data.publicKey;
            setFriendPublicKeys(prev => ({ ...prev, [friendId]: publicKey }));
            return publicKey;
        } catch (error) {
            console.error('Failed to get public key:', error);
            throw error;
        }
    }, [friendPublicKeys]);

    // Send message
    const sendMessage = async (content) => {
        if (!selectedFriend || !content.trim()) return;

        const socket = getSocket();
        if (!socket) return;

        try {
            const publicKey = await getFriendPublicKey(selectedFriend.id);
            const encrypted = await encryptMessage(content, publicKey);

            socket.emit('send_message', {
                recipientId: selectedFriend.id,
                encrypted
            }, (response) => {
                if (response.error) {
                    console.error('Send failed:', response.error);
                    return;
                }

                // Add message to local state
                setMessages(prev => [...prev, {
                    ...response.message,
                    content
                }]);
            });
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    };

    // Handle typing indicator
    const handleTyping = (isTyping) => {
        const socket = getSocket();
        if (socket && selectedFriend) {
            socket.emit('typing', {
                recipientId: selectedFriend.id,
                isTyping
            });
        }
    };

    // Setup socket listeners
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        // New message received
        const handleNewMessage = async (message) => {
            try {
                const decryptedContent = await decryptMessage(message.encrypted);
                const decryptedMessage = { ...message, content: decryptedContent };

                setMessages(prev => {
                    // Only add if this is for current conversation
                    if (
                        selectedFriend &&
                        (message.senderId === selectedFriend.id ||
                            message.recipientId === selectedFriend.id)
                    ) {
                        return [...prev, decryptedMessage];
                    }
                    return prev;
                });

                // Update friends list to show last message indicator
                fetchFriends();
            } catch (error) {
                console.error('Failed to decrypt incoming message:', error);
            }
        };

        // Friend online status
        const handleFriendStatus = ({ userId, status }) => {
            setOnlineUsers(prev => {
                const newSet = new Set(prev);
                if (status === 'online') {
                    newSet.add(userId);
                } else {
                    newSet.delete(userId);
                }
                return newSet;
            });
        };

        // Typing indicator
        const handleUserTyping = ({ userId, isTyping }) => {
            setTypingUsers(prev => {
                const newSet = new Set(prev);
                if (isTyping) {
                    newSet.add(userId);
                } else {
                    newSet.delete(userId);
                }
                return newSet;
            });
        };

        socket.on('new_message', handleNewMessage);
        socket.on('friend_status', handleFriendStatus);
        socket.on('user_typing', handleUserTyping);

        return () => {
            socket.off('new_message', handleNewMessage);
            socket.off('friend_status', handleFriendStatus);
            socket.off('user_typing', handleUserTyping);
        };
    }, [selectedFriend, fetchFriends]);

    // Initial data fetch
    useEffect(() => {
        fetchFriends();
        fetchPendingRequests();
    }, [fetchFriends, fetchPendingRequests]);

    // Fetch messages when friend selected
    useEffect(() => {
        if (selectedFriend) {
            fetchMessages(selectedFriend.id);
        } else {
            setMessages([]);
        }
    }, [selectedFriend, fetchMessages]);

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            setIsMobileView(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Handle logout
    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="chat-container">
            {/* Sidebar */}
            <aside className={`chat-sidebar ${selectedFriend && isMobileView ? 'hidden' : ''}`}>
                <header className="sidebar-header">
                    <div className="user-info">
                        <div className="user-avatar">{user?.username?.[0]?.toUpperCase()}</div>
                        <span className="user-name">{user?.username}</span>
                    </div>
                    <div className="header-actions">
                        <button
                            className="icon-button"
                            onClick={() => setShowSearch(true)}
                            title="Add friend"
                        >
                            ➕
                        </button>
                        <button
                            className={`icon-button ${pendingRequestsCount > 0 ? 'has-badge' : ''}`}
                            onClick={() => setShowRequests(true)}
                            title="Friend requests"
                        >
                            👥
                        </button>
                        <button
                            className="profile-button"
                            onClick={() => navigate('/profile')}
                            title="Profile"
                        >
                            {user?.username?.[0]?.toUpperCase() || '?'}
                        </button>
                    </div>
                </header>

                <ChatList
                    friends={friends}
                    selectedFriend={selectedFriend}
                    onSelectFriend={setSelectedFriend}
                    onlineUsers={onlineUsers}
                />
            </aside>

            {/* Chat Area */}
            <main className={`chat-main ${!selectedFriend && isMobileView ? 'hidden' : ''}`}>
                {selectedFriend ? (
                    <ChatWindow
                        friend={selectedFriend}
                        messages={messages}
                        onSendMessage={sendMessage}
                        onTyping={handleTyping}
                        isTyping={typingUsers.has(selectedFriend.id)}
                        isOnline={onlineUsers.has(selectedFriend.id)}
                        onBack={() => setSelectedFriend(null)}
                        showBackButton={isMobileView}
                    />
                ) : (
                    <div className="no-chat-selected">
                        <div className="no-chat-content">
                            <span className="no-chat-icon">💬</span>
                            <h2>Select a conversation</h2>
                            <p>Choose a friend from the list to start chatting</p>
                        </div>
                    </div>
                )}
            </main>

            {/* Modals */}
            {showSearch && (
                <FriendSearch
                    onClose={() => setShowSearch(false)}
                    onFriendAdded={() => {
                        fetchPendingRequests();
                    }}
                />
            )}

            {showRequests && (
                <FriendRequests
                    onClose={() => setShowRequests(false)}
                    onRequestHandled={() => {
                        fetchFriends();
                        fetchPendingRequests();
                    }}
                />
            )}
        </div>
    );
}
