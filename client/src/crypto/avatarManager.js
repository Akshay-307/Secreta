/**
 * Avatar Manager
 * 
 * Stores user avatar locally in IndexedDB
 * Avatar data is kept on device only (privacy-first approach)
 */

const DB_NAME = 'secreta_keys';
const DB_VERSION = 2;
const STORE_NAME = 'keystore';
const AVATAR_KEY = 'user_avatar';

/**
 * Open IndexedDB connection
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
 * Compress and resize image to max dimensions
 * @param {File} file - Image file
 * @param {number} maxSize - Max width/height in pixels
 * @returns {Promise<string>} - Base64 data URL
 */
export async function processAvatar(file, maxSize = 200) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;

                // Scale down if needed
                if (width > height) {
                    if (width > maxSize) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to WebP for better compression, fallback to JPEG
                let dataUrl = canvas.toDataURL('image/webp', 0.85);
                if (dataUrl.startsWith('data:image/webp')) {
                    resolve(dataUrl);
                } else {
                    resolve(canvas.toDataURL('image/jpeg', 0.85));
                }
            };
            img.onerror = reject;
            img.src = e.target.result;
        };

        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Save avatar to IndexedDB
 * @param {string} dataUrl - Base64 data URL of avatar
 */
export async function saveAvatar(dataUrl) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const request = store.put({
            id: AVATAR_KEY,
            data: dataUrl,
            updatedAt: new Date().toISOString()
        });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get avatar from IndexedDB
 * @returns {Promise<string | null>} - Base64 data URL or null
 */
export async function getAvatar() {
    try {
        const db = await openDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(AVATAR_KEY);

            request.onsuccess = () => {
                resolve(request.result?.data || null);
            };
            request.onerror = () => reject(request.error);
        });
    } catch {
        return null;
    }
}

/**
 * Delete avatar from IndexedDB
 */
export async function deleteAvatar() {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(AVATAR_KEY);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
