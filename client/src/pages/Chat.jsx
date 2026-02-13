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
import { getStoredPublicKeyJwk } from '../crypto/keyManager';
import { encryptFile, decryptFile, createDownloadBlob, downloadFile } from '../crypto/fileEncryption';
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
    const [replyingTo, setReplyingTo] = useState(null);
    const [searchFilter, setSearchFilter] = useState('');
    const [lastMessages, setLastMessages] = useState({});
    const [unreadCounts, setUnreadCounts] = useState({});

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
            const decryptedMessages = await Promise.all(response.data.map(async (msg) => {
                try {
                    const isMine = msg.senderId !== friendId;
                    let encryptedData;

                    if (isMine && msg.encryptedForSender) {
                        encryptedData = msg.encryptedForSender;
                    } else if (!isMine && msg.encryptedForRecipient) {
                        encryptedData = msg.encryptedForRecipient;
                    } else {
                        encryptedData = msg.encrypted;
                    }

                    if (!encryptedData || !encryptedData.ephemeralPublicKey) {
                        return { ...msg, content: '[No encryption data]' };
                    }

                    let decryptedContent = '';
                    let audioUrl = null;

                    const ciphertext = encryptedData?.ciphertext;
                    const isPlaceholder = ciphertext === 'FILE' || ciphertext === 'VOICE' || ciphertext === '' || (ciphertext && ciphertext.length < 24);

                    if (msg.messageType === 'voice' && msg.fileAttachment) {
                        try {
                            const fileResponse = await api.get(`/files/${msg.fileAttachment.fileId}`, {
                                responseType: 'arraybuffer'
                            });

                            const iv = Uint8Array.from(atob(msg.fileAttachment.encryptedMetadata.iv), c => c.charCodeAt(0));
                            const decryptedAudio = await decryptFile(
                                fileResponse.data,
                                msg.fileAttachment.encryptedMetadata.ephemeralPublicKey,
                                iv
                            );

                            const blob = new Blob([decryptedAudio], { type: 'audio/webm' });
                            audioUrl = URL.createObjectURL(blob);
                            decryptedContent = '🎤 Voice Message';
                        } catch (err) {
                            console.error('Failed to load voice message:', err);
                            decryptedContent = '⚠️ Voice Message Failed';
                        }
                    } else if (msg.messageType === 'image' && msg.fileAttachment) {
                        try {
                            const fileResponse = await api.get(`/files/${msg.fileAttachment.fileId}`, {
                                responseType: 'arraybuffer'
                            });

                            const iv = Uint8Array.from(atob(msg.fileAttachment.encryptedMetadata.iv), c => c.charCodeAt(0));
                            const decryptedImage = await decryptFile(
                                fileResponse.data,
                                msg.fileAttachment.encryptedMetadata.ephemeralPublicKey,
                                iv
                            );

                            const blob = new Blob([decryptedImage], { type: msg.fileAttachment.mimeType });
                            msg.previewUrl = URL.createObjectURL(blob);
                            decryptedContent = '📷 Image';
                        } catch (err) {
                            console.error('Failed to load image:', err);
                            decryptedContent = '⚠️ Image Failed';
                        }
                    } else if (!msg.messageType) {
                        if (isPlaceholder) {
                            decryptedContent = '📎 Attachment';
                        } else {
                            decryptedContent = await decryptMessage(encryptedData);
                        }
                    } else if (msg.messageType === 'text') {
                        decryptedContent = await decryptMessage(encryptedData);
                    } else {
                        decryptedContent = msg.messageType === 'image' ? '📷 Image' : '📎 File';
                    }

                    return { ...msg, content: decryptedContent, audioUrl };
                } catch (error) {
                    if (error.name === 'OperationError' || error.name === 'InvalidCharacterError') {
                        return { ...msg, content: '🔒 Unreadable' };
                    }
                    console.error('Failed to decrypt message:', error);
                    return { ...msg, content: '[Unable to decrypt]' };
                }
            }));


            setMessages(decryptedMessages);

            // Update last message for this friend
            if (decryptedMessages.length > 0) {
                const lastMsg = decryptedMessages[decryptedMessages.length - 1];
                setLastMessages(prev => ({
                    ...prev,
                    [friendId]: {
                        text: lastMsg.content?.substring(0, 40) || '',
                        time: lastMsg.createdAt,
                        isMine: lastMsg.senderId !== friendId
                    }
                }));
            }

            // Clear unread count for selected friend
            setUnreadCounts(prev => ({ ...prev, [friendId]: 0 }));

            // Mark as read via socket for real-time updates
            const socket = getSocket();
            if (socket && decryptedMessages.length > 0) {
                const messageIds = decryptedMessages.map(m => m._id);
                socket.emit('mark_read', {
                    messageIds,
                    senderId: friendId
                });
            }
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
    const sendMessage = async (content, replyTo, disappearMode = 'default') => {
        if (!selectedFriend || !content.trim()) return;

        const socket = getSocket();
        if (!socket) return;

        try {
            const recipientPublicKey = await getFriendPublicKey(selectedFriend.id);
            const myPublicKey = await getStoredPublicKeyJwk();

            const encryptedForRecipient = await encryptMessage(content, recipientPublicKey);
            const encryptedForSender = myPublicKey
                ? await encryptMessage(content, myPublicKey)
                : null;

            let replyData = {};
            if (replyTo) {
                const previewContent = replyTo.content.substring(0, 50);
                const encryptedPreview = await encryptMessage(previewContent, recipientPublicKey);

                replyData = {
                    replyTo: replyTo._id,
                    replyPreview: {
                        senderId: replyTo.senderId,
                        encryptedPreview
                    }
                };
            }

            socket.emit('send_message', {
                recipientId: selectedFriend.id,
                encryptedForRecipient,
                encryptedForSender,
                disappearMode,
                ...replyData
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

                // Update last message
                setLastMessages(prev => ({
                    ...prev,
                    [selectedFriend.id]: {
                        text: content.substring(0, 40),
                        time: new Date().toISOString(),
                        isMine: true
                    }
                }));

                setReplyingTo(null);
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

    // Handle emoji reaction
    const handleReact = (messageId, emoji) => {
        const socket = getSocket();
        if (socket && selectedFriend) {
            socket.emit('add_reaction', {
                messageId,
                emoji,
                recipientId: selectedFriend.id
            });
        }
    };

    // Handle delete message
    const handleDeleteMessage = (messageId) => {
        const socket = getSocket();
        if (!socket) return;

        socket.emit('delete_message', { messageId }, (response) => {
            if (response.success) {
                setMessages(prev => prev.filter(m => m._id !== messageId));
            }
        });
    };

    // Handle file upload and send
    const handleSendFile = async (file) => {
        console.log('Starting file send:', file.name, file.type, file.size);
        if (!selectedFriend) {
            console.error('No friend selected');
            return;
        }
        const socket = getSocket();
        if (!socket) {
            console.error('Socket not connected');
            return;
        }

        try {
            console.log('Fetching public keys...');
            const recipientPublicKey = await getFriendPublicKey(selectedFriend.id);
            const myPublicKey = await getStoredPublicKeyJwk();

            if (!recipientPublicKey) {
                console.error('Recipient public key not found');
                return;
            }

            console.log('Encrypting file...');
            const encryptedData = await encryptFile(file, recipientPublicKey, myPublicKey);
            console.log('File encrypted successfully');

            const formData = new FormData();
            const encryptedBlob = new Blob([encryptedData.encryptedData]);
            formData.append('file', encryptedBlob, 'encrypted');

            console.log('Uploading file to server...');
            const response = await api.post('/files/upload', formData, {
                headers: {
                    'x-recipient-id': selectedFriend.id
                }
            });
            console.log('File uploaded, ID:', response.data.fileId);

            const encryptionMetadata = {
                ephemeralPublicKey: encryptedData.ephemeralPublicKey,
                iv: btoa(String.fromCharCode(...encryptedData.iv)),
                ciphertext: 'FILE'
            };

            socket.emit('send_message', {
                recipientId: selectedFriend.id,
                messageType: file.type.startsWith('image/') ? 'image' : 'file',
                encryptedForRecipient: encryptionMetadata,
                encryptedForSender: encryptionMetadata,
                disappearMode: 'default',
                fileAttachment: {
                    fileId: response.data.fileId,
                    fileName: file.name,
                    fileSize: file.size,
                    mimeType: file.type,
                    encryptedMetadata: encryptionMetadata
                }
            }, (response) => {
                if (response.error) {
                    console.error('Send file failed:', response.error);
                    return;
                }
                console.log('Message sent successfully:', response.message);
                setMessages(prev => [...prev, response.message]);
            });

        } catch (error) {
            console.error('Failed to send file:', error);
            alert(`File upload failed: ${error.message || 'Unknown error'}`);
        }
    };

    // Handle voice message
    const handleSendVoice = async (voiceData) => {
        if (!selectedFriend) return;
        const socket = getSocket();
        if (!socket) return;

        try {
            const { blob, duration, waveformData } = voiceData;

            const recipientPublicKey = await getFriendPublicKey(selectedFriend.id);
            const myPublicKey = await getStoredPublicKeyJwk();

            const encryptedData = await encryptFile(blob, recipientPublicKey, myPublicKey);

            const formData = new FormData();
            const encryptedBlob = new Blob([encryptedData.encryptedData]);
            formData.append('file', encryptedBlob, 'voice.webm');

            const response = await api.post('/files/upload', formData, {
                headers: {
                    'x-recipient-id': selectedFriend.id
                }
            });

            const encryptionMetadata = {
                ephemeralPublicKey: encryptedData.ephemeralPublicKey,
                iv: btoa(String.fromCharCode(...encryptedData.iv)),
                ciphertext: 'VOICE'
            };

            socket.emit('send_message', {
                recipientId: selectedFriend.id,
                messageType: 'voice',
                voiceDuration: duration,
                waveformData: waveformData,
                encryptedForRecipient: encryptionMetadata,
                encryptedForSender: encryptionMetadata,
                disappearMode: 'default',
                fileAttachment: {
                    fileId: response.data.fileId,
                    fileName: 'Voice Message',
                    fileSize: blob.size,
                    mimeType: 'audio/webm',
                    encryptedMetadata: encryptionMetadata
                }
            }, (response) => {
                if (response.error) {
                    console.error('Send voice failed:', response.error);
                    return;
                }
                setMessages(prev => [...prev, response.message]);
            });

        } catch (error) {
            console.error('Failed to send voice message:', error);
        }
    };

    // Handle file download
    const handleDownloadFile = async (fileAttachment) => {
        try {
            const { fileId, encryptedMetadata, mimeType, fileName } = fileAttachment;

            const response = await api.get(`/files/${fileId}`, {
                responseType: 'arraybuffer'
            });

            const iv = Uint8Array.from(atob(encryptedMetadata.iv), c => c.charCodeAt(0));

            const decryptedData = await decryptFile(
                response.data,
                encryptedMetadata.ephemeralPublicKey,
                iv
            );

            const blob = createDownloadBlob(decryptedData, mimeType);
            downloadFile(blob, fileName);

        } catch (error) {
            console.error('Failed to download file:', error);
        }
    };

    // Setup socket listeners
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        // New message received
        const handleNewMessage = async (message) => {
            try {
                let decryptedContent = '';
                let audioUrl = null;

                const ciphertext = message.encryptedForRecipient?.ciphertext || message.encrypted?.ciphertext;
                const isPlaceholder = ciphertext === 'FILE' || ciphertext === 'VOICE' || ciphertext === '' || (ciphertext && ciphertext.length < 24);

                if (message.messageType === 'voice' && message.fileAttachment) {
                    try {
                        const fileResponse = await api.get(`/files/${message.fileAttachment.fileId}`, {
                            responseType: 'arraybuffer'
                        });

                        const iv = Uint8Array.from(atob(message.fileAttachment.encryptedMetadata.iv), c => c.charCodeAt(0));
                        const decryptedAudio = await decryptFile(
                            fileResponse.data,
                            message.fileAttachment.encryptedMetadata.ephemeralPublicKey,
                            iv
                        );

                        const blob = new Blob([decryptedAudio], { type: 'audio/webm' });
                        audioUrl = URL.createObjectURL(blob);
                        decryptedContent = '🎤 Voice Message';
                    } catch (err) {
                        console.error('Failed to load voice message:', err);
                        decryptedContent = '⚠️ Voice Message Failed';
                    }
                } else if (message.messageType === 'image' && message.fileAttachment) {
                    try {
                        const fileResponse = await api.get(`/files/${message.fileAttachment.fileId}`, {
                            responseType: 'arraybuffer'
                        });

                        const iv = Uint8Array.from(atob(message.fileAttachment.encryptedMetadata.iv), c => c.charCodeAt(0));
                        const decryptedImage = await decryptFile(
                            fileResponse.data,
                            message.fileAttachment.encryptedMetadata.ephemeralPublicKey,
                            iv
                        );

                        const blob = new Blob([decryptedImage], { type: message.fileAttachment.mimeType });
                        message.previewUrl = URL.createObjectURL(blob);
                        decryptedContent = '📷 Image';
                    } catch (err) {
                        console.error('Failed to load image:', err);
                        decryptedContent = '⚠️ Image Failed';
                    }
                } else if (!message.messageType) {
                    if (isPlaceholder) {
                        decryptedContent = '📎 Attachment';
                    } else {
                        const encryptedData = message.encryptedForRecipient || message.encrypted;
                        decryptedContent = await decryptMessage(encryptedData);
                    }
                } else if (message.messageType === 'text') {
                    const encryptedData = message.encryptedForRecipient || message.encrypted;
                    decryptedContent = await decryptMessage(encryptedData);
                } else {
                    decryptedContent = message.messageType === 'image' ? '📷 Image' : '📎 File';
                }

                const decryptedMessage = { ...message, content: decryptedContent, audioUrl };

                // Update last message for this sender
                setLastMessages(prev => ({
                    ...prev,
                    [message.senderId]: {
                        text: decryptedContent.substring(0, 40),
                        time: message.createdAt,
                        isMine: false
                    }
                }));

                setMessages(prev => {
                    if (
                        selectedFriend &&
                        (message.senderId === selectedFriend.id ||
                            message.recipientId === selectedFriend.id)
                    ) {
                        return [...prev, decryptedMessage];
                    }
                    return prev;
                });

                // Update unread count if not viewing this conversation
                if (!selectedFriend || message.senderId !== selectedFriend.id) {
                    setUnreadCounts(prev => ({
                        ...prev,
                        [message.senderId]: (prev[message.senderId] || 0) + 1
                    }));
                }

                // Update friends list
                fetchFriends();
            } catch (error) {
                if (error.name === 'OperationError' || error.name === 'InvalidCharacterError') {
                    console.warn('Skipping unreadable incoming message');
                    return;
                }
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

        // Friend request accepted - refresh friend list
        const handleFriendRequestAccepted = () => {
            fetchFriends();
        };

        // Reaction updated
        const handleReactionUpdated = ({ messageId, reactions }) => {
            setMessages(prev => prev.map(msg =>
                msg._id === messageId ? { ...msg, reactions } : msg
            ));
        };

        // Messages read
        const handleMessagesRead = ({ messageIds }) => {
            setMessages(prev => prev.map(msg =>
                messageIds.includes(msg._id) ? { ...msg, read: true } : msg
            ));
        };

        // View-once message viewed - remove from UI
        const handleMessageViewedOnce = ({ messageId }) => {
            setMessages(prev => prev.filter(msg => msg._id !== messageId));
        };

        socket.on('new_message', handleNewMessage);
        socket.on('friend_status', handleFriendStatus);
        socket.on('user_typing', handleUserTyping);
        socket.on('friend_request_accepted', handleFriendRequestAccepted);
        socket.on('reaction_updated', handleReactionUpdated);
        socket.on('messages_read', handleMessagesRead);
        socket.on('message_viewed_once', handleMessageViewedOnce);

        return () => {
            socket.off('new_message', handleNewMessage);
            socket.off('friend_status', handleFriendStatus);
            socket.off('user_typing', handleUserTyping);
            socket.off('friend_request_accepted', handleFriendRequestAccepted);
            socket.off('reaction_updated', handleReactionUpdated);
            socket.off('messages_read', handleMessagesRead);
            socket.off('message_viewed_once', handleMessageViewedOnce);
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

    // Filter friends by search
    const filteredFriends = searchFilter
        ? friends.filter(f => f.username.toLowerCase().includes(searchFilter.toLowerCase()))
        : friends;

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

                {/* Search filter for friends */}
                <div className="chat-search-wrapper">
                    <div className="search-input-wrapper">
                        <span className="search-icon">🔍</span>
                        <input
                            type="text"
                            className="chat-search-input"
                            placeholder="Search chats..."
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                        />
                    </div>
                </div>

                <ChatList
                    friends={filteredFriends}
                    selectedFriend={selectedFriend}
                    onSelectFriend={setSelectedFriend}
                    onlineUsers={onlineUsers}
                    lastMessages={lastMessages}
                    unreadCounts={unreadCounts}
                />
            </aside>

            {/* Chat Area */}
            <main className={`chat-main ${!selectedFriend && isMobileView ? 'hidden' : ''}`}>
                {selectedFriend ? (
                    <ChatWindow
                        friend={selectedFriend}
                        messages={messages}
                        onSendMessage={sendMessage}
                        onSendFile={handleSendFile}
                        onSendVoice={handleSendVoice}
                        onDownloadFile={handleDownloadFile}
                        onDeleteMessage={handleDeleteMessage}
                        socket={getSocket()}
                        onTyping={handleTyping}
                        isTyping={typingUsers.has(selectedFriend.id)}
                        isOnline={onlineUsers.has(selectedFriend.id)}
                        onBack={() => setSelectedFriend(null)}
                        showBackButton={isMobileView}
                        onReact={handleReact}
                        currentUserId={user?.id}
                        replyingTo={replyingTo}
                        setReplyingTo={setReplyingTo}
                    />
                ) : (
                    <div className="no-chat-selected">
                        <div className="no-chat-content">
                            <span className="no-chat-icon">💬</span>
                            <h2>Select a conversation</h2>
                            <p>Choose a friend from the list to start chatting</p>
                            <p className="disappear-hint">⏳ All messages auto-delete after 24 hours</p>
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
