/**
 * Voice Recorder Component
 * 
 * Records audio with real-time waveform visualization
 * and prepares for E2EE upload
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import './VoiceRecorder.css';

export default function VoiceRecorder({ onRecord, onCancel }) {
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [audioBlob, setAudioBlob] = useState(null);
    const [waveformData, setWaveformData] = useState([]);

    const mediaRecorderRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationRef = useRef(null);
    const chunksRef = useRef([]);
    const startTimeRef = useRef(null);
    const durationIntervalRef = useRef(null);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const analyzeAudio = useCallback(() => {
        if (!analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Get average of frequency data for waveform bar
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalized = Math.min(average / 128, 1);

        setWaveformData(prev => {
            const newData = [...prev, normalized];
            // Keep last 50 bars
            if (newData.length > 50) {
                return newData.slice(-50);
            }
            return newData;
        });

        animationRef.current = requestAnimationFrame(analyzeAudio);
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Set up audio context for visualization
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            source.connect(analyserRef.current);

            // Set up media recorder
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start(100);
            startTimeRef.current = Date.now();
            setIsRecording(true);
            setWaveformData([]);

            // Start duration counter
            durationIntervalRef.current = setInterval(() => {
                setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 100);

            // Start waveform analysis
            analyzeAudio();

        } catch (error) {
            console.error('Microphone access denied:', error);
            onCancel();
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);

            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
            }
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        }
    };

    const handleSend = () => {
        if (audioBlob) {
            onRecord({
                blob: audioBlob,
                duration: duration,
                waveformData: waveformData.map(v => Math.round(v * 100) / 100)
            });
        }
    };

    const handleCancel = () => {
        stopRecording();
        setAudioBlob(null);
        setDuration(0);
        setWaveformData([]);
        onCancel();
    };

    // Start recording when component mounts
    useEffect(() => {
        startRecording();

        return () => {
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
            }
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    return (
        <div className="voice-recorder">
            <button className="cancel-btn" onClick={handleCancel}>
                ✕
            </button>

            <div className="waveform-container">
                {waveformData.map((height, i) => (
                    <div
                        key={i}
                        className="waveform-bar"
                        style={{ height: `${Math.max(height * 100, 10)}%` }}
                    />
                ))}
                {isRecording && (
                    <div className="recording-indicator">
                        <span className="recording-dot" />
                    </div>
                )}
            </div>

            <div className="duration">{formatTime(duration)}</div>

            {isRecording ? (
                <button className="stop-btn" onClick={stopRecording}>
                    ⏹️
                </button>
            ) : audioBlob ? (
                <button className="send-btn" onClick={handleSend}>
                    ➤
                </button>
            ) : null}
        </div>
    );
}

/**
 * Voice Message Display Component
 * Shows voice messages with playback controls
 */
export function VoiceMessage({ audioUrl, duration, waveformData = [], isMine }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const audioRef = useRef(null);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const togglePlay = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            setProgress((audio.currentTime / audio.duration) * 100);
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setProgress(0);
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', handleEnded);
        };
    }, []);

    return (
        <div className={`voice-message ${isMine ? 'mine' : ''}`}>
            <audio ref={audioRef} src={audioUrl} preload="metadata" />

            <button className="play-btn" onClick={togglePlay}>
                {isPlaying ? '⏸️' : '▶️'}
            </button>

            <div className="voice-waveform">
                {(waveformData.length > 0 ? waveformData : Array(30).fill(0.3)).map((height, i) => (
                    <div
                        key={i}
                        className="voice-bar"
                        style={{
                            height: `${Math.max(height * 100, 15)}%`,
                            opacity: (i / waveformData.length * 100) < progress ? 1 : 0.4
                        }}
                    />
                ))}
            </div>

            <span className="voice-duration">{formatTime(duration)}</span>
        </div>
    );
}
