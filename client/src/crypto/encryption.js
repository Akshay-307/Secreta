/**
 * Secreta - Encryption Module
 * 
 * SECURITY-CRITICAL MODULE
 * 
 * Implements hybrid encryption for E2EE messaging:
 * - ECDH (P-256) for key exchange
 * - AES-256-GCM for message encryption
 * - Ephemeral keys per message for forward secrecy
 * 
 * Flow:
 * 1. Generate ephemeral ECDH key pair
 * 2. Derive shared secret using ECDH (ephemeral_private + recipient_public)
 * 3. Derive AES-GCM key from shared secret using HKDF
 * 4. Encrypt message with AES-GCM
 * 5. Send: ephemeral public key + IV + ciphertext
 * 
 * The ephemeral private key is discarded after encryption,
 * providing forward secrecy at the message level.
 */

import { getStoredKeyPair, importPublicKey, generateKeyPair, exportPublicKey } from './keyManager.js';
import { arrayBufferToBase64, base64ToArrayBuffer, stringToArrayBuffer, arrayBufferToString, generateIV } from './utils.js';

/**
 * Derive AES-GCM key from ECDH shared secret
 * 
 * Uses HKDF to derive a 256-bit AES key from the ECDH shared secret
 * 
 * @param {CryptoKey} privateKey - Our private key
 * @param {CryptoKey} publicKey - Their public key
 * @returns {Promise<CryptoKey>} AES-GCM key
 */
async function deriveAESKey(privateKey, publicKey) {
    // Perform ECDH to get shared secret bits
    const sharedSecret = await crypto.subtle.deriveBits(
        {
            name: 'ECDH',
            public: publicKey
        },
        privateKey,
        256 // 256 bits for AES-256
    );

    // Import shared secret as raw key material for HKDF
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        sharedSecret,
        'HKDF',
        false,
        ['deriveKey']
    );

    // Derive AES-GCM key using HKDF
    return crypto.subtle.deriveKey(
        {
            name: 'HKDF',
            salt: new Uint8Array(16), // Fixed salt (could be improved with per-conversation salt)
            info: stringToArrayBuffer('secreta-e2ee-v1'),
            hash: 'SHA-256'
        },
        keyMaterial,
        {
            name: 'AES-GCM',
            length: 256
        },
        false, // Not extractable
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypt a message for a recipient
 * 
 * Uses ephemeral key pair for forward secrecy:
 * - Generates new key pair for each message
 * - Derives shared secret with recipient's public key
 * - Encrypts message with AES-GCM
 * - Returns ephemeral public key + encrypted data
 * 
 * @param {string} plaintext - Message to encrypt
 * @param {JsonWebKey} recipientPublicKeyJwk - Recipient's public key (JWK format)
 * @returns {Promise<Object>} Encrypted message payload
 */
export async function encryptMessage(plaintext, recipientPublicKeyJwk) {
    // Import recipient's public key
    const recipientPublicKey = await importPublicKey(recipientPublicKeyJwk);

    // Generate ephemeral key pair for this message (forward secrecy)
    const ephemeralKeyPair = await generateKeyPair();

    // Derive AES key using ephemeral private + recipient public
    const aesKey = await deriveAESKey(ephemeralKeyPair.privateKey, recipientPublicKey);

    // Generate random IV for AES-GCM
    const iv = generateIV();

    // Encrypt the message
    const plaintextBuffer = stringToArrayBuffer(plaintext);
    const ciphertextBuffer = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv,
            tagLength: 128 // 128-bit authentication tag
        },
        aesKey,
        plaintextBuffer
    );

    // Export ephemeral public key for sending
    const ephemeralPublicKeyJwk = await exportPublicKey(ephemeralKeyPair.publicKey);

    // The ephemeral private key is now discarded (not stored)
    // This provides forward secrecy

    return {
        ephemeralPublicKey: ephemeralPublicKeyJwk,
        iv: arrayBufferToBase64(iv),
        ciphertext: arrayBufferToBase64(ciphertextBuffer)
    };
}

/**
 * Decrypt a message from a sender
 * 
 * Uses our stored private key + sender's ephemeral public key
 * to derive the same shared secret and decrypt.
 * 
 * @param {Object} encryptedData - Encrypted message payload
 * @param {JsonWebKey} encryptedData.ephemeralPublicKey - Sender's ephemeral public key
 * @param {string} encryptedData.iv - Base64 encoded IV
 * @param {string} encryptedData.ciphertext - Base64 encoded ciphertext
 * @returns {Promise<string>} Decrypted plaintext
 */
export async function decryptMessage(encryptedData) {
    const { ephemeralPublicKey, iv, ciphertext } = encryptedData;

    // Get our stored key pair
    const keyPair = await getStoredKeyPair();
    if (!keyPair) {
        throw new Error('No encryption keys found. Please log in again.');
    }

    // Import sender's ephemeral public key
    const senderEphemeralKey = await importPublicKey(ephemeralPublicKey);

    // Derive AES key using our private + sender's ephemeral public
    const aesKey = await deriveAESKey(keyPair.privateKey, senderEphemeralKey);

    // Decode IV and ciphertext
    const ivBuffer = base64ToArrayBuffer(iv);
    const ciphertextBuffer = base64ToArrayBuffer(ciphertext);

    // Decrypt
    const plaintextBuffer = await crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: ivBuffer,
            tagLength: 128
        },
        aesKey,
        ciphertextBuffer
    );

    return arrayBufferToString(plaintextBuffer);
}

/**
 * Verify that we can decrypt a test message
 * Used to validate key pair before use
 * 
 * @returns {Promise<boolean>}
 */
export async function verifyCryptoSetup() {
    try {
        const keyPair = await getStoredKeyPair();
        if (!keyPair) return false;

        // Encrypt and decrypt test message to self
        const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
        const testMessage = 'secreta-crypto-test';
        const encrypted = await encryptMessage(testMessage, publicKeyJwk);
        const decrypted = await decryptMessage(encrypted);

        return decrypted === testMessage;
    } catch (error) {
        console.error('Crypto verification failed:', error);
        return false;
    }
}
