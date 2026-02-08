/**
 * WebRTC Configuration
 * 
 * Uses Metered TURN servers for reliable NAT traversal.
 * Get your free API key from https://www.metered.ca/
 */

// Metered TURN server configuration
// Set these in your .env file:
// VITE_METERED_API_KEY=your_api_key_here
// VITE_METERED_DOMAIN=your_domain.metered.live

const METERED_API_KEY = (import.meta.env.VITE_METERED_API_KEY || '').trim();
const METERED_DOMAIN = (import.meta.env.VITE_METERED_DOMAIN || '').trim();

/**
 * Fetch ICE servers from Metered API
 */
export async function getIceServers() {
    try {
        if (METERED_API_KEY && METERED_DOMAIN) {
            const response = await fetch(
                `https://${METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
            );

            if (response.ok) {
                const iceServers = await response.json();
                console.log('✓ Metered TURN servers configured');
                return iceServers;
            } else {
                console.warn(`✗ Metered API failed: ${response.status} ${response.statusText}`);
                if (response.status === 401) {
                    console.error('Check your VITE_METERED_API_KEY and VITE_METERED_DOMAIN in Vercel settings.');
                }
            }
        }

        // Fallback to free STUN servers (may not work behind strict NAT)
        console.warn('⚠ Using fallback STUN servers - calls may not work behind strict NATs');
        return [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ];
    } catch (error) {
        console.error('Failed to get ICE servers:', error);
        return [{ urls: 'stun:stun.l.google.com:19302' }];
    }
}

/**
 * Create RTCPeerConnection with proper configuration
 */
export async function createPeerConnection() {
    const iceServers = await getIceServers();

    return new RTCPeerConnection({
        iceServers,
        iceCandidatePoolSize: 10
    });
}

export default {
    getIceServers,
    createPeerConnection
};
