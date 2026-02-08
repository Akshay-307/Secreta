/**
 * File Upload Routes
 * 
 * Handles encrypted file uploads and downloads via GridFS.
 * Files are encrypted client-side before upload for E2EE.
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { upload, uploadToGridFS, downloadFromGridFS, getFileInfo, deleteFromGridFS } from '../config/gridfs.js';
import Friendship from '../models/Friendship.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * POST /api/files/upload
 * 
 * Upload an encrypted file
 * Request body: multipart/form-data with 'file' field
 * Headers: x-recipient-id (for verification)
 */
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const userId = req.user.userId;
        const recipientId = req.headers['x-recipient-id'];

        // Verify friendship if recipient is specified
        if (recipientId) {
            const friendship = await Friendship.findOne({
                $or: [
                    { requester: userId, recipient: recipientId, status: 'accepted' },
                    { requester: recipientId, recipient: userId, status: 'accepted' }
                ]
            });

            if (!friendship) {
                return res.status(403).json({ error: 'Not friends with recipient' });
            }
        }

        const result = await uploadToGridFS(req.file.buffer, req.file.originalname, {
            senderId: userId,
            recipientId: recipientId || null,
            mimeType: req.file.mimetype,
            originalName: req.file.originalname,
            encrypted: true // Flag indicating client-side encryption
        });

        res.json({
            fileId: result.fileId.toString(),
            filename: result.filename,
            size: result.length
        });
    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

/**
 * GET /api/files/:fileId
 * 
 * Download an encrypted file
 */
router.get('/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const userId = req.user.userId;

        // Get file info to verify access
        const fileInfo = await getFileInfo(fileId);
        if (!fileInfo) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Verify user has access (sender or recipient)
        const { senderId, recipientId } = fileInfo.metadata || {};
        if (senderId !== userId && recipientId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const buffer = await downloadFromGridFS(fileId);

        res.set({
            'Content-Type': fileInfo.metadata?.mimeType || 'application/octet-stream',
            'Content-Length': buffer.length,
            'Content-Disposition': `attachment; filename="${fileInfo.filename}"`
        });

        res.send(buffer);
    } catch (error) {
        console.error('File download error:', error);
        res.status(500).json({ error: 'Failed to download file' });
    }
});

/**
 * GET /api/files/:fileId/info
 * 
 * Get file metadata without downloading
 */
router.get('/:fileId/info', async (req, res) => {
    try {
        const { fileId } = req.params;
        const userId = req.user.userId;

        const fileInfo = await getFileInfo(fileId);
        if (!fileInfo) {
            return res.status(404).json({ error: 'File not found' });
        }

        const { senderId, recipientId } = fileInfo.metadata || {};
        if (senderId !== userId && recipientId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({
            fileId: fileInfo._id.toString(),
            filename: fileInfo.filename,
            size: fileInfo.length,
            mimeType: fileInfo.metadata?.mimeType,
            uploadedAt: fileInfo.metadata?.uploadedAt
        });
    } catch (error) {
        console.error('Get file info error:', error);
        res.status(500).json({ error: 'Failed to get file info' });
    }
});

/**
 * DELETE /api/files/:fileId
 * 
 * Delete a file (sender only)
 */
router.delete('/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const userId = req.user.userId;

        const fileInfo = await getFileInfo(fileId);
        if (!fileInfo) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Only sender can delete
        if (fileInfo.metadata?.senderId !== userId) {
            return res.status(403).json({ error: 'Only sender can delete file' });
        }

        await deleteFromGridFS(fileId);
        res.json({ message: 'File deleted' });
    } catch (error) {
        console.error('File delete error:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

export default router;
