/**
 * WebRTC Configuration
 * 
 * Uses free public STUN servers (Google) for basic NAT traversal.
 * No third-party accounts or API keys required.
 */

// Free public STUN servers
const STUN_SERVERS = [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302',
    'stun:stun3.l.google.com:19302',
    'stun:stun4.l.google.com:19302',
];

/**
 * Get ICE servers configuration
 * Returns static STUN servers for free P2P calling
 */
export async function getIceServers() {
    console.log('✓ Using free public STUN servers');
    return [
        {
            urls: STUN_SERVERS
        }
    ];
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
