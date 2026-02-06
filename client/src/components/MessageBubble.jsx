/**
 * Message Bubble Component
 */

import './MessageBubble.css';

export default function MessageBubble({ message, isMine }) {
    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className={`message-bubble ${isMine ? 'mine' : 'theirs'}`}>
            <div className="message-content">
                {message.content}
            </div>
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
