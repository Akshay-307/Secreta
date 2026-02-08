/**
 * File Attachment Component
 * 
 * Handles file selection, preview, and encrypted upload
 */

import { useState, useRef } from 'react';
import './FileAttachment.css';

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB

const FILE_ICONS = {
    'image': '🖼️',
    'video': '🎬',
    'audio': '🎵',
    'application/pdf': '📄',
    'text': '📝',
    'default': '📎'
};

function getFileIcon(mimeType) {
    if (!mimeType) return FILE_ICONS.default;

    if (mimeType.startsWith('image/')) return FILE_ICONS.image;
    if (mimeType.startsWith('video/')) return FILE_ICONS.video;
    if (mimeType.startsWith('audio/')) return FILE_ICONS.audio;
    if (mimeType.startsWith('text/')) return FILE_ICONS.text;
    if (mimeType === 'application/pdf') return FILE_ICONS['application/pdf'];

    return FILE_ICONS.default;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function FileAttachment({ onAttach, onClose }) {
    const [selectedFile, setSelectedFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError('');

        if (file.size > MAX_FILE_SIZE) {
            setError('File size must be less than 16MB');
            return;
        }

        setSelectedFile(file);

        // Generate preview for images
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => setPreview(e.target.result);
            reader.readAsDataURL(file);
        } else {
            setPreview(null);
        }
    };

    const handleAttach = () => {
        if (selectedFile) {
            onAttach(selectedFile);
            onClose();
        }
    };

    return (
        <div className="file-attachment-overlay" onClick={onClose}>
            <div className="file-attachment-modal" onClick={e => e.stopPropagation()}>
                <div className="file-attachment-header">
                    <h3>Attach File</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="file-attachment-body">
                    {!selectedFile ? (
                        <div
                            className="file-drop-zone"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <span className="drop-icon">📁</span>
                            <p>Click to select a file</p>
                            <span className="drop-hint">Max size: 16MB</span>
                        </div>
                    ) : (
                        <div className="file-preview">
                            {preview ? (
                                <img src={preview} alt="Preview" className="image-preview" />
                            ) : (
                                <div className="file-icon-large">
                                    {getFileIcon(selectedFile.type)}
                                </div>
                            )}
                            <div className="file-info">
                                <span className="file-name">{selectedFile.name}</span>
                                <span className="file-size">{formatFileSize(selectedFile.size)}</span>
                            </div>
                            <button
                                className="change-file-btn"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                Change
                            </button>
                        </div>
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                    />

                    {error && <div className="file-error">{error}</div>}
                </div>

                <div className="file-attachment-footer">
                    <button className="cancel-btn" onClick={onClose}>Cancel</button>
                    <button
                        className="attach-btn"
                        onClick={handleAttach}
                        disabled={!selectedFile}
                    >
                        🔒 Send Encrypted
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * File Message Display Component
 * Shows attached files in message bubbles
 */
export function FileMessage({ file, onDownload, isDownloading }) {
    const icon = getFileIcon(file.mimeType);
    const isImage = file.mimeType?.startsWith('image/');

    return (
        <div className="file-message" onClick={onDownload}>
            {isImage && file.previewUrl ? (
                <img src={file.previewUrl} alt={file.name} className="file-image" />
            ) : (
                <div className="file-message-icon">{icon}</div>
            )}
            <div className="file-message-info">
                <span className="file-message-name">{file.name}</span>
                <span className="file-message-size">{formatFileSize(file.size)}</span>
            </div>
            <div className="file-message-action">
                {isDownloading ? (
                    <span className="loading-spinner">⏳</span>
                ) : (
                    <span className="download-icon">⬇️</span>
                )}
            </div>
        </div>
    );
}
