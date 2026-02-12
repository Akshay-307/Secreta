/**
 * Chat List Component
 * 
 * Shows list of friends/conversations in sidebar
 * with last message preview, unread count, and timestamps
 */

import './ChatList.css';

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

// Format message timestamp for chat list
function formatMessageTime(date) {
    if (!date) return '';
    const now = new Date();
    const msgDate = new Date(date);
    const diffMs = now - msgDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) {
        return msgDate.toLocaleDateString([], { weekday: 'short' });
    }
    return msgDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ChatList({ friends, selectedFriend, onSelectFriend, onlineUsers, lastMessages, unreadCounts }) {
    if (friends.length === 0) {
        return (
            <div className="chat-list-empty">
                <span className="empty-icon">👋</span>
                <p>No friends yet</p>
                <p className="empty-hint">Add friends to start chatting</p>
            </div>
        );
    }

    return (
        <div className="chat-list">
            {friends.map((friend, index) => {
                const lastMsg = lastMessages?.[friend.id];
                const unread = unreadCounts?.[friend.id] || 0;
                return (
                    <div
                        key={friend.id}
                        className={`chat-item ${selectedFriend?.id === friend.id ? 'active' : ''}`}
                        onClick={() => onSelectFriend(friend)}
                        style={{ animationDelay: `${index * 0.03}s` }}
                    >
                        <div className="chat-item-avatar">
                            {friend.avatar ? (
                                <img src={friend.avatar} alt={friend.username} className="avatar-img" />
                            ) : (
                                friend.username[0].toUpperCase()
                            )}
                            {onlineUsers.has(friend.id) && <span className="online-indicator" />}
                        </div>
                        <div className="chat-item-info">
                            <div className="chat-item-top-row">
                                <span className="chat-item-name">
                                    {friend.status?.emoji && <span className="friend-status-emoji">{friend.status.emoji}</span>}
                                    {friend.username}
                                </span>
                                {lastMsg?.time && (
                                    <span className={`chat-item-time ${unread > 0 ? 'has-unread' : ''}`}>
                                        {formatMessageTime(lastMsg.time)}
                                    </span>
                                )}
                            </div>
                            <div className="chat-item-bottom-row">
                                <div className="chat-item-preview">
                                    {lastMsg?.text ? (
                                        <span className="preview-text">
                                            {lastMsg.isMine && <span className="preview-you">You: </span>}
                                            {lastMsg.text}
                                        </span>
                                    ) : friend.status?.text ? (
                                        <span className="status-text-preview">{friend.status.text}</span>
                                    ) : onlineUsers.has(friend.id) ? (
                                        <span className="status-online">online</span>
                                    ) : (
                                        <span className="status-offline">Last seen {formatLastSeen(friend.lastSeen)}</span>
                                    )}
                                </div>
                                {unread > 0 && (
                                    <span className="unread-badge">{unread > 99 ? '99+' : unread}</span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
