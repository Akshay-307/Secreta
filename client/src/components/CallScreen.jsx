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
    const remoteAudioRef = useRef(null);
    const durationIntervalRef = useRef(null);
    const iceCandidatesBuffer = useRef([]); // Buffer for early candidates

    // ... (rest of refs)

    const cleanup = useCallback(() => {
        // ... (cleanup logic)
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
                const stream = event.streams[0];
                remoteStreamRef.current = stream;

                if (isVideo && remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = stream;
                } else if (!isVideo && remoteAudioRef.current) {
                    remoteAudioRef.current.srcObject = stream;
                }
            };

            // ... (rest of signaling)

            // Handle ICE candidates
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('generated ICE candidate', event.candidate);
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
                    if (!durationIntervalRef.current) {
                        durationIntervalRef.current = setInterval(() => {
                            setDuration(d => d + 1);
                        }, 1000);
                    }
                } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
                    console.log('Call connection failed/closed');
                }
            };

            // Handle ICE connection state specifically
            pc.oniceconnectionstatechange = () => {
                console.log('ICE connection state:', pc.iceConnectionState);
                if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                    // Backup connection check
                    if (callStatus !== 'connected') {
                        setCallStatus('connected');
                    }
                }
            };

            // Create and send offer (if initiating)
            if (!isIncoming) {
                console.log('Creating offer...');
                const offer = await pc.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: isVideo
                });
                await pc.setLocalDescription(offer);
                console.log('Sending call_offer...', offer);
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

    // Process buffered candidates once remote description is set
    const processBufferedCandidates = useCallback(async () => {
        const pc = peerConnectionRef.current;
        if (!pc || !pc.remoteDescription) return;

        console.log(`Processing ${iceCandidatesBuffer.current.length} buffered ICE candidates`);
        while (iceCandidatesBuffer.current.length > 0) {
            const candidate = iceCandidatesBuffer.current.shift();
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
                console.log('Successfully added buffered ICE candidate');
            } catch (error) {
                console.error('Error adding buffered ICE candidate:', error);
            }
        }
    }, []);

    // Handle offer (refactored for reuse)
    const handleOffer = useCallback(async (offerData) => {
        const pc = peerConnectionRef.current;
        if (pc && offerData) {
            try {
                // If we're already stable, we might be re-negotiating or in a weird state.
                if (pc.signalingState === 'stable') {
                    console.log('Received offer while stable, processing renegotiation...');
                }

                console.log('Setting remote description (offer)...', offerData);
                await pc.setRemoteDescription(new RTCSessionDescription(offerData));

                // Process any buffered candidates now that remote description is set
                await processBufferedCandidates();

                console.log('Creating answer...');
                const answer = await pc.createAnswer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: isVideo
                });
                await pc.setLocalDescription(answer);

                console.log('Sending call_answer...', answer);
                socket.emit('call_answer', {
                    recipientId: friend.id,
                    answer: pc.localDescription
                });
            } catch (error) {
                console.error('Error handling offer:', error);
                setCallStatus('error');
            }
        }
    }, [friend.id, socket, processBufferedCandidates, isVideo]);

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
                    console.log('Received answer, setting remote description', answer);
                    await pc.setRemoteDescription(new RTCSessionDescription(answer));
                    // Process buffered candidates
                    await processBufferedCandidates();
                } catch (error) {
                    console.error('Error setting remote description:', error);
                }
            }
        };

        const handleIceCandidate = async (data) => {
            const candidate = data.candidate;
            console.log('Received ICE candidate from remote');
            const pc = peerConnectionRef.current;

            if (!pc) {
                console.warn('PC not initialized yet, buffering candidate');
                iceCandidatesBuffer.current.push(candidate);
                return;
            }

            try {
                if (pc.remoteDescription && pc.remoteDescription.type) {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    console.log('Successfully added remote ICE candidate');
                } else {
                    console.log('Remote description not set, buffering candidate');
                    iceCandidatesBuffer.current.push(candidate);
                }
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
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
            {/* Remote Audio (for voice calls) */}
            {!isVideo && (
                <audio
                    ref={remoteAudioRef}
                    autoPlay
                    playsInline
                />
            )}

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
                        {callStatus === 'error' && (
                            <div className="error-status">
                                💔 Connection failed
                                <span className="error-hint">Check firewall or using fallback servers</span>
                            </div>
                        )}
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
