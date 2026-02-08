/**
 * File Encryption Utilities
 * 
 * Client-side encryption/decryption for file attachments.
 * Uses the same E2EE approach as messages.
 */

import { getPrivateKey, importPublicKey } from './keyManager';

/**
 * Encrypt a file for a recipient using their public key
 */
export async function encryptFile(file, recipientPublicKeyJwk, senderPublicKeyJwk) {
    // Read file as ArrayBuffer
    const fileBuffer = await file.arrayBuffer();

    // Generate ephemeral key pair for ECDH
    const ephemeralKeyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits']
    );

    // Import recipient's public key
    const recipientPublicKey = await importPublicKey(recipientPublicKeyJwk);

    // Derive shared secret
    const sharedBits = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: recipientPublicKey },
        ephemeralKeyPair.privateKey,
        256
    );

    // Derive AES key from shared secret
    const aesKey = await crypto.subtle.importKey(
        'raw',
        sharedBits,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
    );

    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt file data
    const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        fileBuffer
    );

    // Export ephemeral public key
    const ephemeralPublicKey = await crypto.subtle.exportKey(
        'jwk',
        ephemeralKeyPair.publicKey
    );

    return {
        encryptedData: new Uint8Array(encryptedData),
        ephemeralPublicKey,
        iv: Array.from(iv),
        metadata: {
            name: file.name,
            type: file.type,
            size: file.size
        }
    };
}

/**
 * Decrypt a file using our private key
 */
export async function decryptFile(encryptedData, ephemeralPublicKeyJwk, iv) {
    // Get our private key
    const privateKey = await getPrivateKey();
    if (!privateKey) {
        throw new Error('Private key not found');
    }

    // Import ephemeral public key
    const ephemeralPublicKey = await crypto.subtle.importKey(
        'jwk',
        ephemeralPublicKeyJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
    );

    // Derive shared secret
    const sharedBits = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: ephemeralPublicKey },
        privateKey,
        256
    );

    // Derive AES key
    const aesKey = await crypto.subtle.importKey(
        'raw',
        sharedBits,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
    );

    // Decrypt
    const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        aesKey,
        encryptedData
    );

    return new Uint8Array(decryptedData);
}

/**
 * Create a downloadable blob from decrypted data
 */
export function createDownloadBlob(decryptedData, mimeType) {
    return new Blob([decryptedData], { type: mimeType });
}

/**
 * Download a file to the user's device
 */
export function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export default {
    encryptFile,
    decryptFile,
    createDownloadBlob,
    downloadFile
};
