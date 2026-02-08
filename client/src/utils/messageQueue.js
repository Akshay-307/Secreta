/**
 * Message Queue Manager
 * 
 * Stores messages locally when offline and syncs when connection is restored.
 * Uses IndexedDB for persistent storage.
 */

const DB_NAME = 'secreta_queue';
const STORE_NAME = 'pending_messages';
const DB_VERSION = 1;

let db = null;

/**
 * Initialize IndexedDB
 */
function openDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, {
                    keyPath: 'tempId',
                    autoIncrement: false
                });
                store.createIndex('recipientId', 'recipientId', { unique: false });
                store.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };
    });
}

/**
 * Generate a temporary ID for queued messages
 */
function generateTempId() {
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add a message to the offline queue
 */
export async function queueMessage(message) {
    try {
        const database = await openDB();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);

            const queuedMessage = {
                tempId: generateTempId(),
                ...message,
                createdAt: new Date().toISOString(),
                status: 'pending'
            };

            const request = store.add(queuedMessage);

            request.onsuccess = () => resolve(queuedMessage);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Failed to queue message:', error);
        throw error;
    }
}

/**
 * Get all pending messages
 */
export async function getPendingMessages() {
    try {
        const database = await openDB();
        return new Promise((resolve) => {
            const tx = database.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
        });
    } catch {
        return [];
    }
}

/**
 * Get pending messages for a specific recipient
 */
export async function getPendingMessagesFor(recipientId) {
    try {
        const database = await openDB();
        return new Promise((resolve) => {
            const tx = database.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('recipientId');
            const request = index.getAll(recipientId);

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
        });
    } catch {
        return [];
    }
}

/**
 * Remove a message from the queue (after successful send)
 */
export async function removeFromQueue(tempId) {
    try {
        const database = await openDB();
        return new Promise((resolve) => {
            const tx = database.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.delete(tempId);

            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
        });
    } catch {
        return false;
    }
}

/**
 * Update message status in queue
 */
export async function updateMessageStatus(tempId, status) {
    try {
        const database = await openDB();
        return new Promise((resolve) => {
            const tx = database.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const getRequest = store.get(tempId);

            getRequest.onsuccess = () => {
                const message = getRequest.result;
                if (message) {
                    message.status = status;
                    const putRequest = store.put(message);
                    putRequest.onsuccess = () => resolve(true);
                    putRequest.onerror = () => resolve(false);
                } else {
                    resolve(false);
                }
            };

            getRequest.onerror = () => resolve(false);
        });
    } catch {
        return false;
    }
}

/**
 * Clear all pending messages
 */
export async function clearQueue() {
    try {
        const database = await openDB();
        return new Promise((resolve) => {
            const tx = database.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
        });
    } catch {
        return false;
    }
}

/**
 * Get queue count
 */
export async function getQueueCount() {
    try {
        const database = await openDB();
        return new Promise((resolve) => {
            const tx = database.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(0);
        });
    } catch {
        return 0;
    }
}

export default {
    queueMessage,
    getPendingMessages,
    getPendingMessagesFor,
    removeFromQueue,
    updateMessageStatus,
    clearQueue,
    getQueueCount
};
