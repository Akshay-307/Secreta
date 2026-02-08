/**
 * GridFS Storage Configuration
 * 
 * Configures MongoDB GridFS for storing encrypted file attachments.
 * Files are encrypted client-side before upload.
 */

import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import multer from 'multer';
import { Readable } from 'stream';

let bucket = null;

/**
 * Initialize GridFS bucket after MongoDB connection
 */
export function initGridFS() {
    const db = mongoose.connection.db;
    bucket = new GridFSBucket(db, { bucketName: 'files' });
    console.log('✓ GridFS initialized');
    return bucket;
}

/**
 * Get the GridFS bucket instance
 */
export function getBucket() {
    if (!bucket) {
        initGridFS();
    }
    return bucket;
}

/**
 * Multer memory storage for handling file uploads
 */
export const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 16 * 1024 * 1024 // 16MB max (MongoDB document limit)
    }
});

/**
 * Upload a file buffer to GridFS
 */
export async function uploadToGridFS(buffer, filename, metadata = {}) {
    const bucket = getBucket();

    return new Promise((resolve, reject) => {
        const uploadStream = bucket.openUploadStream(filename, {
            metadata: {
                ...metadata,
                uploadedAt: new Date()
            }
        });

        const readableStream = Readable.from(buffer);

        readableStream.pipe(uploadStream)
            .on('error', reject)
            .on('finish', () => {
                resolve({
                    fileId: uploadStream.id,
                    filename: filename,
                    length: buffer.length
                });
            });
    });
}

/**
 * Download a file from GridFS by ID
 */
export async function downloadFromGridFS(fileId) {
    const bucket = getBucket();
    const objectId = new mongoose.Types.ObjectId(fileId);

    return new Promise((resolve, reject) => {
        const chunks = [];
        const downloadStream = bucket.openDownloadStream(objectId);

        downloadStream
            .on('data', chunk => chunks.push(chunk))
            .on('error', reject)
            .on('end', () => {
                resolve(Buffer.concat(chunks));
            });
    });
}

/**
 * Delete a file from GridFS
 */
export async function deleteFromGridFS(fileId) {
    const bucket = getBucket();
    const objectId = new mongoose.Types.ObjectId(fileId);
    await bucket.delete(objectId);
}

/**
 * Get file metadata from GridFS
 */
export async function getFileInfo(fileId) {
    const bucket = getBucket();
    const objectId = new mongoose.Types.ObjectId(fileId);

    const cursor = bucket.find({ _id: objectId });
    const files = await cursor.toArray();

    return files.length > 0 ? files[0] : null;
}

export default {
    initGridFS,
    getBucket,
    upload,
    uploadToGridFS,
    downloadFromGridFS,
    deleteFromGridFS,
    getFileInfo
};
