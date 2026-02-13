/**
 * Media Preview Modal
 * 
 * Shows a preview of the selected image/video file
 * allows adding a caption before sending.
 */

import React, { useState, useEffect } from 'react';
import './MediaPreview.css';

export default function MediaPreview({ file, onClose, onSend }) {
    const [previewUrl, setPreviewUrl] = useState(null);
    const [caption, setCaption] = useState('');
    const [fileType, setFileType] = useState('');

    useEffect(() => {
        if (!file) return;

        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
        setFileType(file.type.split('/')[0]); // 'image' or 'video'

        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);

    const handleSend = () => {
        onSend(file, caption);
        onClose();
    };

    if (!file) return null;

    return (
        <div className="media-preview-overlay">
            <div className="media-preview-container">
                <div className="media-preview-header">
                    <h3>Send {fileType === 'video' ? 'Video' : 'Photo'}</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="media-preview-content">
                    {fileType === 'image' ? (
                        <img src={previewUrl} alt="Preview" className="media-preview-image" />
                    ) : (
                        <video src={previewUrl} controls className="media-preview-video" />
                    )}
                </div>

                <div className="media-preview-footer">
                    <input
                        type="text"
                        placeholder="Add a caption..."
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        className="caption-input"
                        autoFocus
                    />
                    <div className="preview-actions">
                        <span className="file-info">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                        <button className="send-btn" onClick={handleSend}>
                            Send ➤
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
