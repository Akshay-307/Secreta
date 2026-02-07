/**
 * Message Bubble Component
 */

import { useState } from 'react';
import './MessageBubble.css';

const EMOJI_OPTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

export default function MessageBubble({ message, isMine, onReact, currentUserId }) {
    const [showPicker, setShowPicker] = useState(false);

    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleReaction = (emoji) => {
        onReact?.(message._id, emoji);
        setShowPicker(false);
    };

    // Group reactions by emoji with count
    const groupedReactions = (message.reactions || []).reduce((acc, r) => {
        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
        return acc;
    }, {});

    // Check if current user reacted with specific emoji
    const userReacted = (emoji) => {
        return (message.reactions || []).some(
            r => r.emoji === emoji && r.userId === currentUserId
        );
    };

    // URL regex pattern
    const URL_REGEX = /(https?:\/\/[^\s]+)/g;

    // Render message content with clickable links
    function renderContent(text) {
        const parts = text.split(URL_REGEX);
        return parts.map((part, i) => {
            if (URL_REGEX.test(part)) {
                // Reset regex lastIndex after test
                URL_REGEX.lastIndex = 0;
                return (
                    <a
                        key={i}
                        href={part}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="message-link"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {part.length > 50 ? part.substring(0, 50) + '...' : part}
                    </a>
                );
            }
            return part;
        });
    }

    return (
        <div
            className={`message-bubble ${isMine ? 'mine' : 'theirs'}`}
            onDoubleClick={() => setShowPicker(!showPicker)}
        >
            <div className="message-content">
                {renderContent(message.content)}
            </div>

            {/* Reaction display */}
            {Object.keys(groupedReactions).length > 0 && (
                <div className="message-reactions">
                    {Object.entries(groupedReactions).map(([emoji, count]) => (
                        <span
                            key={emoji}
                            className={`reaction-badge ${userReacted(emoji) ? 'my-reaction' : ''}`}
                            onClick={() => handleReaction(emoji)}
                        >
                            {emoji} {count > 1 && count}
                        </span>
                    ))}
                </div>
            )}

            {/* Reaction picker */}
            {showPicker && (
                <div className="reaction-picker">
                    {EMOJI_OPTIONS.map(emoji => (
                        <button key={emoji} onClick={() => handleReaction(emoji)}>
                            {emoji}
                        </button>
                    ))}
                </div>
            )}

            <div className="message-meta">
                <span className="message-time">{formatTime(message.createdAt)}</span>
                {isMine && (
                    <span className="message-status">
                        {message.read ? '✓✓' : message.delivered ? '✓' : '○'}
                    </span>
                )}
            </div>
        </div>
    );
}
