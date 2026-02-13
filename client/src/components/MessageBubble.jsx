/**
 * Message Bubble Component
 * With context menu for copy/delete, swipe-to-reply, emoji reactions
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
    onDeleteMessage,
    friendName
}) {
    const [showPicker, setShowPicker] = useState(false);
    const [showContextMenu, setShowContextMenu] = useState(false);
    const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const touchStartX = useRef(0);
    const longPressTimer = useRef(null);
    const bubbleRef = useRef(null);

    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleReaction = (emoji) => {
        onReact?.(message._id, emoji);
        setShowPicker(false);
        setShowContextMenu(false);
    };

    // Handle swipe to reply
    const handleTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
        // Long press for context menu on mobile
        longPressTimer.current = setTimeout(() => {
            const touch = e.touches[0];
            setContextPos({ x: touch.clientX, y: touch.clientY });
            setShowContextMenu(true);
        }, 500);
    };

    const handleTouchMove = (e) => {
        // Cancel long press if finger moves
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        const diff = e.touches[0].clientX - touchStartX.current;
        if (diff > 0 && diff < 80) {
            setSwipeOffset(diff);
        }
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        if (swipeOffset > 50) {
            onReply?.(message);
        }
        setSwipeOffset(0);
    };

    // Right-click context menu
    const handleContextMenu = (e) => {
        e.preventDefault();
        setContextPos({ x: e.clientX, y: e.clientY });
        setShowContextMenu(true);
    };

    // Copy message
    const handleCopy = async () => {
        if (message.content) {
            await navigator.clipboard.writeText(message.content);
        }
        setShowContextMenu(false);
    };

    // Delete message
    const handleDelete = async () => {
        setIsDeleting(true);
        setShowContextMenu(false);
        onDeleteMessage?.(message._id);
    };

    // Close context menu when clicking elsewhere
    const handleOverlayClick = () => {
        setShowContextMenu(false);
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
                return (
                    <div className="message-media-container">
                        {message.fileAttachment && (
                            <FileMessage
                                file={{
                                    name: message.fileAttachment.fileName,
                                    size: message.fileAttachment.fileSize,
                                    mimeType: message.fileAttachment.mimeType,
                                    previewUrl: message.previewUrl
                                }}
                                onDownload={handleFileDownload}
                                isDownloading={isDownloading}
                                uploadProgress={message.uploadProgress}
                            />
                        )}
                        {/* Caption */}
                        {message.content && !message.content.startsWith('📷') && !message.content.startsWith('📎') && (
                            <div className="message-caption">
                                {renderContent(message.content)}
                            </div>
                        )}
                    </div>
                );

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

    // Disappear mode indicator
    const getDisappearIcon = () => {
        if (message.disappearMode === 'view_once') return '👁️';
        if (message.disappearMode === 'default' || !message.disappearMode) return '⏳';
        return null;
    };

    return (
        <>
            <div
                ref={bubbleRef}
                className={`message-bubble ${isMine ? 'mine' : 'theirs'} ${isDeleting ? 'deleting' : ''}`}
                style={{ transform: `translateX(${swipeOffset}px)` }}
                onDoubleClick={() => setShowPicker(!showPicker)}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onContextMenu={handleContextMenu}
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
                    {getDisappearIcon() && (
                        <span className="disappear-icon">{getDisappearIcon()}</span>
                    )}
                    <span className="message-time">{formatTime(message.createdAt)}</span>
                    {isMine && (
                        <span className={`message-status ${message.read ? 'read' : ''}`}>
                            {message.read ? '✓✓' : message.delivered ? '✓' : '○'}
                        </span>
                    )}
                </div>
            </div>

            {/* Context Menu */}
            {showContextMenu && (
                <div className="context-menu-overlay" onClick={handleOverlayClick}>
                    <div
                        className="context-menu"
                        style={{
                            top: Math.min(contextPos.y, window.innerHeight - 200),
                            left: Math.min(contextPos.x, window.innerWidth - 180)
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {message.messageType === 'text' && (
                            <button className="context-menu-item" onClick={handleCopy}>
                                <span className="context-icon">📋</span>
                                Copy
                            </button>
                        )}
                        <button className="context-menu-item" onClick={() => { onReply?.(message); setShowContextMenu(false); }}>
                            <span className="context-icon">↩️</span>
                            Reply
                        </button>
                        <button className="context-menu-item" onClick={() => { setShowPicker(true); setShowContextMenu(false); }}>
                            <span className="context-icon">😄</span>
                            React
                        </button>
                        <div className="context-menu-divider" />
                        <button className="context-menu-item danger" onClick={handleDelete}>
                            <span className="context-icon">🗑️</span>
                            Delete for me
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
