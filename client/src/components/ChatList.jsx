/**
 * Chat List Component
 * 
 * Shows list of friends/conversations in sidebar
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

export default function ChatList({ friends, selectedFriend, onSelectFriend, onlineUsers }) {
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
            {friends.map(friend => (
                <div
                    key={friend.id}
                    className={`chat-item ${selectedFriend?.id === friend.id ? 'active' : ''}`}
                    onClick={() => onSelectFriend(friend)}
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
                        <div className="chat-item-name">{friend.username}</div>
                        <div className="chat-item-status">
                            {onlineUsers.has(friend.id)
                                ? <span className="status-online">online</span>
                                : <span className="status-offline">Last seen {formatLastSeen(friend.lastSeen)}</span>
                            }
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
