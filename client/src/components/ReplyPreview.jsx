/**
 * Reply Preview Component
 * 
 * Shows a compact preview of a quoted message
 */

import './MessageBubble.css';

export default function ReplyPreview({ preview, isMine, onClick }) {
    if (!preview) return null;

    return (
        <div className={`reply-preview ${isMine ? 'mine' : 'theirs'}`} onClick={onClick}>
            <div className="reply-bar" />
            <div className="reply-content">
                <span className="reply-sender">
                    {preview.senderName || 'User'}
                </span>
                <span className="reply-text">
                    {preview.content?.substring(0, 50) || 'Message'}
                    {preview.content?.length > 50 ? '...' : ''}
                </span>
            </div>
        </div>
    );
}
