/**
 * Message Bubble Component
 */

import { useState, useRef } from 'react';
import ReplyPreview from './ReplyPreview';
import { FileMessage } from './FileAttachment';
import { VoiceMessage } from './VoiceRecorder';
import './MessageBubble.css';

const EMOJI_OPTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

export default function MessageBubble({
    message,
    isMine,
    onReact,
    currentUserId,
    onReply,
    onScrollToMessage,
    onDownloadFile,
    friendName
}) {
    const [showPicker, setShowPicker] = useState(false);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);
    const touchStartX = useRef(0);

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

    // Handle swipe to reply
    const handleTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchMove = (e) => {
        const diff = e.touches[0].clientX - touchStartX.current;
        // Only allow swipe right for reply
        if (diff > 0 && diff < 80) {
            setSwipeOffset(diff);
        }
    };

    const handleTouchEnd = () => {
        if (swipeOffset > 50) {
            onReply?.(message);
        }
        setSwipeOffset(0);
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
        if (!text) return null;
        const parts = text.split(URL_REGEX);
        return parts.map((part, i) => {
            if (URL_REGEX.test(part)) {
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

    const handleReplyClick = () => {
        if (message.replyTo && onScrollToMessage) {
            onScrollToMessage(message.replyTo);
        }
    };

    const handleFileDownload = async () => {
        if (!message.fileAttachment || !onDownloadFile) return;
        setIsDownloading(true);
        try {
            await onDownloadFile(message.fileAttachment);
        } finally {
            setIsDownloading(false);
        }
    };

    // Render content based on message type
    const renderMessageContent = () => {
        const msgType = message.messageType || 'text';

        switch (msgType) {
            case 'file':
            case 'image':
                return message.fileAttachment ? (
                    <FileMessage
                        file={{
                            name: message.fileAttachment.fileName,
                            size: message.fileAttachment.fileSize,
                            mimeType: message.fileAttachment.mimeType
                        }}
                        onDownload={handleFileDownload}
                        isDownloading={isDownloading}
                    />
                ) : null;

            case 'voice':
                return (
                    <VoiceMessage
                        audioUrl={message.audioUrl}
                        duration={message.voiceDuration || 0}
                        waveformData={message.waveformData}
                        isMine={isMine}
                    />
                );

            default:
                return (
                    <div className="message-content">
                        {renderContent(message.content)}
                    </div>
                );
        }
    };

    return (
        <div
            className={`message-bubble ${isMine ? 'mine' : 'theirs'}`}
            style={{ transform: `translateX(${swipeOffset}px)` }}
            onDoubleClick={() => setShowPicker(!showPicker)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Reply indicator on swipe */}
            {swipeOffset > 20 && (
                <div className="swipe-reply-indicator" style={{ opacity: swipeOffset / 60 }}>
                    ↩️
                </div>
            )}

            {/* Reply preview if this is a reply */}
            {message.replyPreview && (
                <ReplyPreview
                    preview={{
                        senderName: message.replyPreview.senderId === currentUserId ? 'You' : friendName,
                        content: message.replyPreview.content
                    }}
                    isMine={isMine}
                    onClick={handleReplyClick}
                />
            )}

            {renderMessageContent()}

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
                    <button onClick={() => { onReply?.(message); setShowPicker(false); }}>
                        ↩️
                    </button>
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

