/**
 * Wallpaper Manager
 * 
 * Manages per-chat custom wallpapers stored in IndexedDB.
 * Supports gradients, solid colors, and custom images.
 */

const DB_NAME = 'secreta_wallpapers';
const STORE_NAME = 'wallpapers';
const DB_VERSION = 1;

// Preset wallpapers - gradients and patterns
export const PRESET_WALLPAPERS = [
    { id: 'default', name: 'Default', type: 'gradient', value: 'linear-gradient(180deg, rgba(18,18,28,1) 0%, rgba(25,25,40,1) 100%)' },
    { id: 'ocean', name: 'Ocean', type: 'gradient', value: 'linear-gradient(135deg, #1a2a6c 0%, #2196f3 50%, #009688 100%)' },
    { id: 'sunset', name: 'Sunset', type: 'gradient', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 50%, #ffa726 100%)' },
    { id: 'forest', name: 'Forest', type: 'gradient', value: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)' },
    { id: 'midnight', name: 'Midnight', type: 'gradient', value: 'linear-gradient(135deg, #232526 0%, #414345 100%)' },
    { id: 'aurora', name: 'Aurora', type: 'gradient', value: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 50%, #7c4dff 100%)' },
    { id: 'rose', name: 'Rose', type: 'gradient', value: 'linear-gradient(135deg, #ee9ca7 0%, #ffdde1 100%)' },
    { id: 'dark', name: 'Dark', type: 'solid', value: '#121218' },
    { id: 'purple', name: 'Deep Purple', type: 'gradient', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { id: 'cosmic', name: 'Cosmic', type: 'gradient', value: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' },
];

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
                database.createObjectStore(STORE_NAME, { keyPath: 'chatId' });
            }
        };
    });
}

/**
 * Get wallpaper for a specific chat
 */
export async function getWallpaper(chatId) {
    try {
        const database = await openDB();
        return new Promise((resolve) => {
            const tx = database.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(chatId);

            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    resolve(result.wallpaper);
                } else {
                    // Return default wallpaper
                    resolve(PRESET_WALLPAPERS[0]);
                }
            };

            request.onerror = () => {
                resolve(PRESET_WALLPAPERS[0]);
            };
        });
    } catch {
        return PRESET_WALLPAPERS[0];
    }
}

/**
 * Set wallpaper for a specific chat
 */
export async function setWallpaper(chatId, wallpaper) {
    try {
        const database = await openDB();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.put({ chatId, wallpaper });

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Failed to set wallpaper:', error);
        return false;
    }
}

/**
 * Remove wallpaper for a specific chat (revert to default)
 */
export async function removeWallpaper(chatId) {
    try {
        const database = await openDB();
        return new Promise((resolve) => {
            const tx = database.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.delete(chatId);

            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
        });
    } catch {
        return false;
    }
}

/**
 * Get global default wallpaper
 */
export async function getGlobalWallpaper() {
    return getWallpaper('__global__');
}

/**
 * Set global default wallpaper
 */
export async function setGlobalWallpaper(wallpaper) {
    return setWallpaper('__global__', wallpaper);
}

/**
 * Convert image file to data URL for storage
 */
export function imageToDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

export default {
    PRESET_WALLPAPERS,
    getWallpaper,
    setWallpaper,
    removeWallpaper,
    getGlobalWallpaper,
    setGlobalWallpaper,
    imageToDataURL
};
