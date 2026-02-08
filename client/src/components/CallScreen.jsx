/**
 * Call Screen Component
 * 
 * Handles WebRTC voice/video calls with signaling via Socket.IO
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPeerConnection } from '../utils/webrtcConfig';
import './CallScreen.css';

export default function CallScreen({
    socket,
    friend,
    isIncoming = false,
    isVideo = false,
    offer = null, // Accept initial offer
    onEnd
}) {
    const [callStatus, setCallStatus] = useState(isIncoming ? 'incoming' : 'calling');
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(!isVideo);
    const [duration, setDuration] = useState(0);

    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const durationIntervalRef = useRef(null);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const cleanup = useCallback(() => {
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
        }
    }, []);

    const endCall = useCallback(() => {
        socket.emit('call_end', { recipientId: friend.id });
        cleanup();
        onEnd();
    }, [socket, friend.id, cleanup, onEnd]);

    const initializeCall = useCallback(async () => {
        try {
            // Get user media
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: isVideo ? { facingMode: 'user' } : false
            });
            localStreamRef.current = stream;

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            // Create peer connection
            const pc = await createPeerConnection();
            peerConnectionRef.current = pc;

            // Add local tracks
            stream.getTracks().forEach(track => {
                pc.addTrack(track, stream);
            });

            // Handle remote stream
            pc.ontrack = (event) => {
                if (remoteVideoRef.current && event.streams[0]) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                    remoteStreamRef.current = event.streams[0];
                }
            };

            // Handle ICE candidates
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('Sending ICE candidate');
                    socket.emit('ice_candidate', {
                        recipientId: friend.id,
                        candidate: event.candidate
                    });
                }
            };

            // Handle connection state
            pc.onconnectionstatechange = () => {
                console.log('Connection state changed:', pc.connectionState);
                if (pc.connectionState === 'connected') {
                    setCallStatus('connected');
                    durationIntervalRef.current = setInterval(() => {
                        setDuration(d => d + 1);
                    }, 1000);
                } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
                    // endCall(); // Don't auto-end immediately on disconnect, let user decide or retry
                    console.log('Call disconnected or failed');
                }
            };

            // Create and send offer (if initiating)
            if (!isIncoming) {
                console.log('Creating offer...');
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                console.log('Sending call_offer...');
                socket.emit('call_offer', {
                    recipientId: friend.id,
                    offer: pc.localDescription,
                    isVideo
                });
                setCallStatus('ringing');
            }

        } catch (error) {
            console.error('Failed to initialize call:', error);
            setCallStatus('error');
        }
    }, [isVideo, isIncoming, friend.id, socket, endCall]);

    const answerCall = useCallback(async () => {
        setCallStatus('connecting');
        await initializeCall();
    }, [initializeCall]);

    const toggleMute = () => {
        const audioTrack = localStreamRef.current?.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            setIsMuted(!audioTrack.enabled);
        }
    };

    const toggleVideo = () => {
        const videoTrack = localStreamRef.current?.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            setIsVideoOff(!videoTrack.enabled);
        }
    };

    // Handle offer (refactored for reuse)
    const handleOffer = useCallback(async (offerData) => {
        const pc = peerConnectionRef.current;
        if (pc && offerData) {
            try {
                // Check if we already have a remote description
                if (pc.signalingState !== 'stable') {
                    console.warn('Connection already in progress (signaling state: ' + pc.signalingState + ')');
                    return;
                }

                await pc.setRemoteDescription(new RTCSessionDescription(offerData));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                socket.emit('call_answer', {
                    recipientId: friend.id,
                    answer: pc.localDescription
                });
            } catch (error) {
                console.error('Error handling offer:', error);
            }
        }
    }, [socket, friend.id]);

    // Socket event handlers
    useEffect(() => {
        if (!socket) return;

        const onOffer = ({ offer, callerId }) => {
            if (callStatus === 'incoming' && callerId === friend.id) {
                handleOffer(offer);
            }
        };

        const handleAnswer = async ({ answer }) => {
            const pc = peerConnectionRef.current;
            if (pc) {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(answer));
                } catch (error) {
                    console.error('Error setting remote description:', error);
                }
            }
        };

        const handleIceCandidate = async ({ candidate }) => {
            const pc = peerConnectionRef.current;
            if (pc && candidate) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (error) {
                    console.error('Error adding ICE candidate:', error);
                }
            }
        };

        const handleCallEnd = () => {
            cleanup();
            onEnd();
        };

        // If we have an initial offer prop, handle it
        if (isIncoming && offer && !peerConnectionRef.current?.remoteDescription) {
            // We need to wait for PC to be initialized. 
            // initializeCall runs on mount, but it's async. 
            // We'll handle this in the initializeCall's promise chain or effect.
        }

        socket.on('call_offer', onOffer);
        socket.on('call_answer', handleAnswer);
        socket.on('ice_candidate', handleIceCandidate);
        socket.on('call_end', handleCallEnd);

        return () => {
            socket.off('call_offer', onOffer);
            socket.off('call_answer', handleAnswer);
            socket.off('ice_candidate', handleIceCandidate);
            socket.off('call_end', handleCallEnd);
        };
    }, [socket, friend.id, callStatus, cleanup, onEnd, isIncoming, offer, handleOffer]);

    // Initialize call and handle initial offer
    useEffect(() => {
        const init = async () => {
            await initializeCall();

            // If we have an initial offer, process it after initialization
            if (isIncoming && offer && peerConnectionRef.current) {
                await handleOffer(offer);
            }
        };

        init();

        return cleanup;
    }, []); // Run once on mount

    return (
        <div className="call-screen">
            {/* Remote video (full screen) */}
            {isVideo && (
                <video
                    ref={remoteVideoRef}
                    className="remote-video"
                    autoPlay
                    playsInline
                />
            )}

            {/* Local video (picture-in-picture) */}
            {isVideo && (
                <video
                    ref={localVideoRef}
                    className="local-video"
                    autoPlay
                    playsInline
                    muted
                />
            )}

            {/* Call info overlay */}
            <div className="call-overlay">
                <div className="call-info">
                    <div className="call-avatar">
                        {friend.avatar ? (
                            <img src={friend.avatar} alt={friend.username} />
                        ) : (
                            friend.username[0].toUpperCase()
                        )}
                    </div>
                    <div className="call-name">{friend.username}</div>
                    <div className="call-status">
                        {callStatus === 'calling' && 'Calling...'}
                        {callStatus === 'ringing' && 'Ringing...'}
                        {callStatus === 'incoming' && 'Incoming call'}
                        {callStatus === 'connecting' && 'Connecting...'}
                        {callStatus === 'connected' && formatTime(duration)}
                        {callStatus === 'error' && 'Call failed'}
                    </div>
                </div>

                {/* Incoming call actions */}
                {callStatus === 'incoming' && (
                    <div className="incoming-actions">
                        <button className="decline-btn" onClick={endCall}>
                            📞
                        </button>
                        <button className="accept-btn" onClick={answerCall}>
                            📞
                        </button>
                    </div>
                )}

                {/* In-call controls */}
                {['connected', 'connecting', 'calling', 'ringing'].includes(callStatus) && (
                    <div className="call-controls">
                        <button
                            className={`control-btn ${isMuted ? 'active' : ''}`}
                            onClick={toggleMute}
                        >
                            {isMuted ? '🔇' : '🎤'}
                        </button>

                        {isVideo && (
                            <button
                                className={`control-btn ${isVideoOff ? 'active' : ''}`}
                                onClick={toggleVideo}
                            >
                                {isVideoOff ? '📷' : '📹'}
                            </button>
                        )}

                        <button className="end-call-btn" onClick={endCall}>
                            📞
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
