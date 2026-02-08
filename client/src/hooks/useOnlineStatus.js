/**
 * useOnlineStatus Hook
 * 
 * Tracks browser online/offline status and provides
 * event callbacks for status changes.
 */

import { useState, useEffect, useCallback } from 'react';

export default function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [wasOffline, setWasOffline] = useState(false);

    const handleOnline = useCallback(() => {
        if (!isOnline) {
            setWasOffline(true);
        }
        setIsOnline(true);
    }, [isOnline]);

    const handleOffline = useCallback(() => {
        setIsOnline(false);
    }, []);

    // Reset wasOffline flag after it's been processed
    const clearWasOffline = useCallback(() => {
        setWasOffline(false);
    }, []);

    useEffect(() => {
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [handleOnline, handleOffline]);

    return {
        isOnline,
        wasOffline,
        clearWasOffline
    };
}
