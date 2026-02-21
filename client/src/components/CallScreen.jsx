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
        console.log('Cleaning up call resources...');

        // Stop all local tracks (Release camera/mic)
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                track.stop();
                console.log(`Stopped local track: ${track.kind}`);
            });
            localStreamRef.current = null;
        }

        // Close peer connection
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
            console.log('Closed peer connection');
        }

        // Clear refs
        localVideoRef.current = null;
        remoteVideoRef.current = null;
        remoteAudioRef.current = null;
        remoteStreamRef.current = null;

        // Clear interval
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
        }

        iceCandidatesBuffer.current = [];
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
                } else if (pc.iceConnectionState === 'failed') {
                    console.error('ICE connection failed. This usually means a direct path or TURN server could not be reached.');
                }
            };

            // Handle ICE gathering state
            pc.onicegatheringstatechange = () => {
                console.log('ICE gathering state:', pc.iceGatheringState);
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
        if (offer) {
            await handleOffer(offer);
        }
    }, [initializeCall, offer, handleOffer]);

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

    const processBufferedCandidates = useCallback(async () => {
        if (!peerConnectionRef.current || !peerConnectionRef.current.remoteDescription) return;

        console.log(`Processing ${iceCandidatesBuffer.current.length} buffered ICE candidates`);
        for (const candidate of iceCandidatesBuffer.current) {
            try {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                console.error('Error adding buffered ICE candidate', e);
            }
        }
        iceCandidatesBuffer.current = [];
    }, []);

    const handleOffer = useCallback(async (offer) => {
        try {
            if (!peerConnectionRef.current) return;
            console.log('Handling offer...');
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));

            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(answer);

            socket.emit('call_answer', {
                recipientId: friend.id,
                answer: peerConnectionRef.current.localDescription
            });

            await processBufferedCandidates();
        } catch (error) {
            console.error('Error handling offer:', error);
            setCallStatus('error');
        }
    }, [friend.id, socket, processBufferedCandidates]);

    const handleAnswer = useCallback(async (answer) => {
        try {
            if (!peerConnectionRef.current) return;
            console.log('Handling answer...');
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
            await processBufferedCandidates();
        } catch (error) {
            console.error('Error handling answer:', error);
            setCallStatus('error');
        }
    }, [processBufferedCandidates]);

    useEffect(() => {
        if (!socket) return;

        const onCallAnswer = async ({ answer }) => {
            console.log('Received call_answer');
            await handleAnswer(answer);
        };

        const onIceCandidate = async ({ candidate }) => {
            if (!peerConnectionRef.current || !peerConnectionRef.current.remoteDescription) {
                console.log('Buffering ICE candidate');
                iceCandidatesBuffer.current.push(candidate);
            } else {
                try {
                    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                    console.error('Error adding ICE candidate', e);
                }
            }
        };

        const onCallEnd = () => {
            console.log('Call ended by remote user');
            cleanup();
            onEnd();
        };

        socket.on('call_answer', onCallAnswer);
        socket.on('ice_candidate', onIceCandidate);
        socket.on('call_end', onCallEnd);

        return () => {
            socket.off('call_answer', onCallAnswer);
            socket.off('ice_candidate', onIceCandidate);
            socket.off('call_end', onCallEnd);
        };
    }, [handleAnswer, cleanup, onEnd, socket]);

    // Initialize call ONLY if outgoing
    useEffect(() => {
        const init = async () => {
            if (!isIncoming) {
                await initializeCall();
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
