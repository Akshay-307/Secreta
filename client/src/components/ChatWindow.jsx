/**
 * Chat Window Component
 * 
 * The main message area with header, messages, and input
 */

import { useState, useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import './ChatWindow.css';

export default function ChatWindow({
    friend,
    messages,
    onSendMessage,
    onTyping,
    isTyping,
    isOnline,
    onBack,
    showBackButton
}) {
    const [input, setInput] = useState('');
    const [typingTimeout, setTypingTimeout] = useState(null);
    const messagesEndRef = useRef(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        onSendMessage(input);
        setInput('');
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
                    {friend.username[0].toUpperCase()}
                </div>
                <div className="chat-header-info">
                    <div className="chat-header-name">{friend.username}</div>
                    <div className="chat-header-status">
                        {isTyping ? (
                            <span className="typing-indicator">typing...</span>
                        ) : isOnline ? (
                            <span className="online-status">online</span>
                        ) : (
                            <span>offline</span>
                        )}
                    </div>
                </div>
                <div className="chat-header-lock" title="End-to-end encrypted">
                    🔒
                </div>
            </header>

            {/* Messages */}
            <div className="messages-container">
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
                        {messages.map((message, index) => (
                            <MessageBubble
                                key={message._id || index}
                                message={message}
                                isMine={message.senderId !== friend.id}
                            />
                        ))}
                    </>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form className="message-input-form" onSubmit={handleSend}>
                <input
                    type="text"
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="message-input"
                />
                <button type="submit" className="send-button" disabled={!input.trim()}>
                    <span>➤</span>
                </button>
            </form>
        </div>
    );
}
