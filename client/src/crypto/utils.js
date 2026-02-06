/**
 * Secreta - Cryptographic Utilities
 * 
 * Helper functions for encoding/decoding between
 * ArrayBuffer, Base64, and string formats.
 */

/**
 * Convert ArrayBuffer to Base64 string
 * @param {ArrayBuffer} buffer 
 * @returns {string}
 */
export function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 * @param {string} base64 
 * @returns {ArrayBuffer}
 */
export function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Convert string to ArrayBuffer (UTF-8)
 * @param {string} str 
 * @returns {ArrayBuffer}
 */
export function stringToArrayBuffer(str) {
    return new TextEncoder().encode(str).buffer;
}

/**
 * Convert ArrayBuffer to string (UTF-8)
 * @param {ArrayBuffer} buffer 
 * @returns {string}
 */
export function arrayBufferToString(buffer) {
    return new TextDecoder().decode(buffer);
}

/**
 * Generate a cryptographically secure random IV for AES-GCM
 * @returns {Uint8Array} 12-byte IV
 */
export function generateIV() {
    return crypto.getRandomValues(new Uint8Array(12));
}
