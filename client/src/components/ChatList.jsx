/**
 * Chat List Component
 * 
 * Shows list of friends/conversations in sidebar
 */

import './ChatList.css';

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
                        {friend.username[0].toUpperCase()}
                        {onlineUsers.has(friend.id) && <span className="online-indicator" />}
                    </div>
                    <div className="chat-item-info">
                        <div className="chat-item-name">{friend.username}</div>
                        <div className="chat-item-status">
                            {friend.hasPublicKey ? '🔒 Encrypted' : '⚠️ No encryption key'}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
