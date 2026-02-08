/**
 * Secreta - Key Manager
 * 
 * SECURITY-CRITICAL MODULE
 * 
 * Manages ECDH key pair generation and secure storage using IndexedDB.
 * Private keys NEVER leave the client browser.
 * 
 * Key Algorithm: ECDH with P-256 curve
 * Storage: IndexedDB (browser local storage)
 */

const DB_NAME = 'secreta_keys';
const DB_VERSION = 2;
const STORE_NAME = 'keystore';
const KEY_ID = 'identity_keypair';

/**
 * Open IndexedDB connection
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

/**
 * Generate a new ECDH key pair
 * 
 * Uses Web Crypto API with P-256 curve (NIST standard)
 * Keys are extractable so we can store/export the public key
 * 
 * @returns {Promise<CryptoKeyPair>}
 */
export async function generateKeyPair() {
    const keyPair = await crypto.subtle.generateKey(
        {
            name: 'ECDH',
            namedCurve: 'P-256'
        },
        true, // extractable - needed to export public key
        ['deriveKey', 'deriveBits']
    );

    return keyPair;
}

/**
 * Export public key to JWK format for server storage
 * 
 * @param {CryptoKey} publicKey 
 * @returns {Promise<JsonWebKey>}
 */
export async function exportPublicKey(publicKey) {
    const jwk = await crypto.subtle.exportKey('jwk', publicKey);
    // Remove private components (should already be absent for public key)
    delete jwk.d;
    return jwk;
}

/**
 * Import a public key from JWK format
 * 
 * @param {JsonWebKey} jwk 
 * @returns {Promise<CryptoKey>}
 */
export async function importPublicKey(jwk) {
    return crypto.subtle.importKey(
        'jwk',
        jwk,
        {
            name: 'ECDH',
            namedCurve: 'P-256'
        },
        true,
        []
    );
}

/**
 * Store key pair in IndexedDB
 * 
 * SECURITY NOTE: IndexedDB is browser-local storage.
 * Keys are stored as JWK and only accessible to this origin.
 * 
 * @param {CryptoKeyPair} keyPair 
 */
export async function storeKeyPair(keyPair) {
    const db = await openDB();

    // Export both keys to JWK for storage
    const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const request = store.put({
            id: KEY_ID,
            publicKey: publicJwk,
            privateKey: privateJwk,
            createdAt: new Date().toISOString()
        });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Retrieve stored key pair from IndexedDB
 * 
 * @returns {Promise<CryptoKeyPair | null>}
 */
export async function getStoredKeyPair() {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(KEY_ID);

        request.onsuccess = async () => {
            if (!request.result) {
                resolve(null);
                return;
            }

            try {
                // Import keys back from JWK
                const publicKey = await crypto.subtle.importKey(
                    'jwk',
                    request.result.publicKey,
                    { name: 'ECDH', namedCurve: 'P-256' },
                    true,
                    []
                );

                const privateKey = await crypto.subtle.importKey(
                    'jwk',
                    request.result.privateKey,
                    { name: 'ECDH', namedCurve: 'P-256' },
                    true,
                    ['deriveKey', 'deriveBits']
                );

                resolve({ publicKey, privateKey });
            } catch (error) {
                console.error('Error importing stored keys:', error);
                resolve(null);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get stored private key (for decryption)
 * 
 * @returns {Promise<CryptoKey | null>}
 */
export async function getPrivateKey() {
    const keyPair = await getStoredKeyPair();
    return keyPair ? keyPair.privateKey : null;
}

/**
 * Get stored public key as JWK (for sending to server)
 * 
 * @returns {Promise<JsonWebKey | null>}
 */
export async function getStoredPublicKeyJwk() {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(KEY_ID);

        request.onsuccess = () => {
            resolve(request.result?.publicKey || null);
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Check if keys exist in storage
 * 
 * @returns {Promise<boolean>}
 */
export async function hasStoredKeys() {
    const keys = await getStoredKeyPair();
    return keys !== null;
}

/**
 * Delete all stored keys (for logout/key rotation)
 */
export async function clearKeys() {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(KEY_ID);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Initialize keys - generates new if none exist
 * Returns the public key JWK for server registration
 * 
 * @returns {Promise<JsonWebKey>}
 */
export async function initializeKeys() {
    let keyPair = await getStoredKeyPair();

    if (!keyPair) {
        console.log('🔐 Generating new encryption keys...');
        keyPair = await generateKeyPair();
        await storeKeyPair(keyPair);
        console.log('✓ Keys generated and stored securely');
    }

    return exportPublicKey(keyPair.publicKey);
}

/**
 * Derive an encryption key from password using PBKDF2
 * @param {string} password 
 * @param {Uint8Array} salt 
 * @returns {Promise<CryptoKey>}
 */
async function deriveKeyFromPassword(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Export keys as password-protected backup
 * @param {string} password - User-provided password for encryption
 * @returns {Promise<string>} - JSON backup string
 */
export async function exportKeyBackup(password) {
    const keyPair = await getStoredKeyPair();
    if (!keyPair) {
        throw new Error('No keys to export');
    }

    // Export both keys as JWK
    const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

    const data = JSON.stringify({ publicKey: publicJwk, privateKey: privateJwk });

    // Generate salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Derive encryption key from password
    const encKey = await deriveKeyFromPassword(password, salt);

    // Encrypt the key data
    const enc = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        encKey,
        enc.encode(data)
    );

    // Return base64-encoded backup
    const backup = {
        version: 1,
        salt: btoa(String.fromCharCode(...salt)),
        iv: btoa(String.fromCharCode(...iv)),
        data: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
    };

    return JSON.stringify(backup, null, 2);
}

/**
 * Import keys from password-protected backup
 * @param {string} backupJson - JSON backup string
 * @param {string} password - Password used during export
 */
export async function importKeyBackup(backupJson, password) {
    const backup = JSON.parse(backupJson);

    if (backup.version !== 1) {
        throw new Error('Unsupported backup version');
    }

    // Decode from base64
    const salt = new Uint8Array([...atob(backup.salt)].map(c => c.charCodeAt(0)));
    const iv = new Uint8Array([...atob(backup.iv)].map(c => c.charCodeAt(0)));
    const encryptedData = new Uint8Array([...atob(backup.data)].map(c => c.charCodeAt(0)));

    // Derive decryption key from password
    const decKey = await deriveKeyFromPassword(password, salt);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        decKey,
        encryptedData
    );

    const dec = new TextDecoder();
    const data = JSON.parse(dec.decode(decrypted));

    // Import the keys
    const publicKey = await crypto.subtle.importKey(
        'jwk',
        data.publicKey,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        []
    );

    const privateKey = await crypto.subtle.importKey(
        'jwk',
        data.privateKey,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey', 'deriveBits']
    );

    // Store the imported keys
    await storeKeyPair({ publicKey, privateKey });

    console.log('✓ Keys restored from backup');
    return true;
}
