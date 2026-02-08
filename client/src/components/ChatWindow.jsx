/**
 * Chat Window Component
 * 
 * The main message area with header, messages, and input
 */

import { useState, useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import WallpaperPicker from './WallpaperPicker';
import FileAttachment from './FileAttachment';
import VoiceRecorder from './VoiceRecorder';
import CallScreen from './CallScreen';
import { getWallpaper, PRESET_WALLPAPERS } from '../utils/wallpaperManager';
import './ChatWindow.css';

// Format last seen time as relative string
function formatLastSeen(lastSeen) {
    if (!lastSeen) return 'offline';

    const now = new Date();
    const seen = new Date(lastSeen);
    const diffMs = now - seen;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return seen.toLocaleDateString();
}

export default function ChatWindow({
    friend,
    messages,
    onSendMessage,
    onSendFile,
    onSendVoice,
    onTyping,
    isTyping,
    isOnline,
    onBack,
    showBackButton,
    onReact,
    currentUserId,
    socket,
    onDownloadFile, // Add download handler prop
    replyingTo,
    setReplyingTo
}) {
    const [input, setInput] = useState('');
    const [typingTimeout, setTypingTimeout] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [wallpaper, setWallpaper] = useState(PRESET_WALLPAPERS[0]);
    const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
    // replyingTo state lifted to parent
    const [showFileAttachment, setShowFileAttachment] = useState(false);
    const [isRecordingVoice, setIsRecordingVoice] = useState(false);
    const [activeCall, setActiveCall] = useState(null); // { isVideo: boolean, isIncoming: boolean }
    const messagesEndRef = useRef(null);

    // Load wallpaper for this chat
    useEffect(() => {
        if (friend?.id) {
            getWallpaper(friend.id).then(setWallpaper);
        }
    }, [friend?.id]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Listen for incoming calls
    useEffect(() => {
        if (!socket) return;

        const handleIncomingCall = ({ callerId, isVideo, offer }) => {
            if (callerId === friend.id) {
                setActiveCall({ isVideo, isIncoming: true, offer });
            }
        };

        socket.on('call_offer', handleIncomingCall);
        return () => socket.off('call_offer', handleIncomingCall);
    }, [socket, friend?.id]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        onSendMessage(input, replyingTo);
        setInput('');
        setReplyingTo(null);
        onTyping(false);
    };

    const handleInputChange = (e) => {
        setInput(e.target.value);

        // Clear existing timeout
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }

        // Notify typing
        onTyping(true);

        // Set timeout to stop typing indicator
        const timeout = setTimeout(() => {
            onTyping(false);
        }, 2000);

        setTypingTimeout(timeout);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend(e);
        }
    };

    const handleReply = (message) => {
        setReplyingTo(message);
    };

    const handleFileAttach = (file) => {
        if (onSendFile) {
            onSendFile(file);
        }
    };

    const handleVoiceRecord = (voiceData) => {
        if (onSendVoice) {
            onSendVoice(voiceData);
        }
        setIsRecordingVoice(false);
    };

    const startCall = (isVideo) => {
        setActiveCall({ isVideo, isIncoming: false });
    };

    const getWallpaperStyle = () => {
        if (wallpaper.type === 'image') {
            return { backgroundImage: `url(${wallpaper.value})`, backgroundSize: 'cover', backgroundPosition: 'center' };
        } else if (wallpaper.type === 'gradient') {
            return { background: wallpaper.value };
        } else {
            return { backgroundColor: wallpaper.value };
        }
    };

    return (
        <div className="chat-window">
            {/* Header */}
            <header className="chat-header">
                {showBackButton && (
                    <button className="back-button" onClick={onBack}>
                        ←
                    </button>
                )}
                <div className="chat-header-avatar">
                    {friend.avatar ? (
                        <img src={friend.avatar} alt={friend.username} className="avatar-img" />
                    ) : (
                        friend.username[0].toUpperCase()
                    )}
                </div>
                <div className="chat-header-info">
                    <div className="chat-header-name">{friend.username}</div>
                    <div className="chat-header-status">
                        {isTyping ? (
                            <span className="typing-indicator">typing...</span>
                        ) : isOnline ? (
                            <span className="online-status">online</span>
                        ) : (
                            <span>Last seen {friend.lastSeen ? formatLastSeen(friend.lastSeen) : 'offline'}</span>
                        )}
                    </div>
                </div>
                <div className="chat-header-actions">
                    <button
                        className="header-action-btn"
                        onClick={() => startCall(false)}
                        title="Voice call"
                    >
                        📞
                    </button>
                    <button
                        className="header-action-btn"
                        onClick={() => startCall(true)}
                        title="Video call"
                    >
                        📹
                    </button>
                    <button
                        className="header-action-btn"
                        onClick={() => setShowWallpaperPicker(true)}
                        title="Change wallpaper"
                    >
                        🎨
                    </button>
                    <button
                        className={`search-toggle ${showSearch ? 'active' : ''}`}
                        onClick={() => { setShowSearch(!showSearch); setSearchQuery(''); }}
                        title="Search messages"
                    >
                        🔍
                    </button>
                    <span className="chat-header-lock" title="End-to-end encrypted">
                        🔒
                    </span>
                </div>
            </header>

            {/* Search bar */}
            {showSearch && (
                <div className="search-bar">
                    <input
                        type="text"
                        placeholder="Search messages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                    {searchQuery && (
                        <span className="search-count">
                            {messages.filter(m => m.content?.toLowerCase().includes(searchQuery.toLowerCase())).length} found
                        </span>
                    )}
                </div>
            )}

            {/* Messages with wallpaper */}
            <div className="messages-container" style={getWallpaperStyle()}>
                {messages.length === 0 ? (
                    <div className="no-messages">
                        <span className="encryption-badge">🔐</span>
                        <p>Messages are end-to-end encrypted</p>
                        <p className="encryption-hint">Only you and {friend.username} can read them</p>
                    </div>
                ) : (
                    <>
                        <div className="encryption-notice">
                            <span>🔐</span>
                            Messages are end-to-end encrypted
                        </div>
                        {messages
                            .filter(m => !searchQuery || m.content?.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map((message, index) => (
                                <MessageBubble
                                    key={message._id || index}
                                    message={message}
                                    isMine={message.senderId !== friend.id}
                                    onReact={onReact}
                                    currentUserId={currentUserId}
                                    searchQuery={searchQuery}
                                    onReply={handleReply}
                                    onDownloadFile={onDownloadFile}
                                    friendName={friend.username}
                                />
                            ))}
                    </>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Reply preview */}
            {replyingTo && (
                <div className="reply-input-bar">
                    <div className="reply-bar" />
                    <div className="reply-input-info">
                        <span className="reply-to-name">
                            Replying to {replyingTo.senderId === currentUserId ? 'yourself' : friend.username}
                        </span>
                        <span className="reply-to-text">{replyingTo.content}</span>
                    </div>
                    <button className="reply-cancel-btn" onClick={() => setReplyingTo(null)}>×</button>
                </div>
            )}

            {/* Input area */}
            {isRecordingVoice ? (
                <VoiceRecorder
                    onRecord={handleVoiceRecord}
                    onCancel={() => setIsRecordingVoice(false)}
                />
            ) : (
                <form className="message-input-form" onSubmit={handleSend}>
                    <button
                        type="button"
                        className="input-action-btn"
                        onClick={() => setShowFileAttachment(true)}
                        title="Attach file"
                    >
                        📎
                    </button>
                    <input
                        type="text"
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        className="message-input"
                    />
                    {input.trim() ? (
                        <button type="submit" className="send-button">
                            <span>➤</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="voice-btn"
                            onClick={() => setIsRecordingVoice(true)}
                            title="Record voice message"
                        >
                            🎤
                        </button>
                    )}
                </form>
            )}

            {/* File Attachment Modal */}
            {showFileAttachment && (
                <FileAttachment
                    onAttach={handleFileAttach}
                    onClose={() => setShowFileAttachment(false)}
                />
            )}

            {/* Wallpaper Picker Modal */}
            {showWallpaperPicker && (
                <WallpaperPicker
                    chatId={friend.id}
                    currentWallpaper={wallpaper}
                    onSelect={setWallpaper}
                    onClose={() => setShowWallpaperPicker(false)}
                />
            )}

            {/* Call Screen */}
            {activeCall && (
                <CallScreen
                    socket={socket}
                    friend={friend}
                    isIncoming={activeCall.isIncoming}
                    isVideo={activeCall.isVideo}
                    offer={activeCall.offer}
                    onEnd={() => setActiveCall(null)}
                />
            )}
        </div>
    );
}


