/**
 * WebRTC Configuration
 * 
 * Uses free public STUN servers (Google) for basic NAT traversal.
 * No third-party accounts or API keys required.
 */

const STUN_SERVERS = [
    'stun:stun.l.google.com:19302',
    'stun:stun.services.mozilla.com',
];

let cachedIceServers = null;

/**
 * Get ICE servers configuration
 * Fetches TURN credentials from Metered if available, 
 * otherwise falls back to public STUN servers.
 */
export async function getIceServers() {
    if (cachedIceServers) return cachedIceServers;

    const apiKey = import.meta.env.VITE_METERED_API_KEY;
    const domain = import.meta.env.VITE_METERED_DOMAIN;

    if (apiKey && domain) {
        try {
            console.log('📡 Fetching TURN servers from Metered...');
            // Robust domain handling: remove suffix if already present in env var
            const machineName = domain.replace('.metered.live', '');
            const response = await fetch(
                `https://${machineName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`
            );
            const iceServers = await response.json();
            cachedIceServers = iceServers;
            console.log('✓ Successfully loaded Metered TURN servers');
            return iceServers;
        } catch (error) {
            console.error('✗ Failed to fetch Metered TURN servers:', error);
        }
    }

    console.log('⚠️ Falling back to public STUN servers');
    cachedIceServers = [
        {
            urls: STUN_SERVERS
        }
    ];
    return cachedIceServers;
}

/**
 * Create a new RTCPeerConnection
 */
export async function createPeerConnection() {
    const iceServers = await getIceServers();

    const config = {
        iceServers,
        iceCandidatePoolSize: 10,
    };

    const pc = new RTCPeerConnection(config);

    return pc;
}
