import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
    const [canRecord, setCanRecord] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recorder, setRecorder] = useState(null);
    const [transcript, setTranscript] = useState('');
    const chunksRef = useRef([]);
    const playbackRef = useRef(null);

    useEffect(() => {
        async function setupAudio() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const newRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

                newRecorder.ondataavailable = e => {
                    chunksRef.current.push(e.data);
                }

                newRecorder.onstop = async () => {
                    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                    chunksRef.current = [];
                    const audioUrl = window.URL.createObjectURL(blob);
                    if (playbackRef.current) playbackRef.current.src = audioUrl;

                    // Convert blob to base64
                    const base64Audio = await blobToBase64(blob);

                    // Send the base64 audio to the Flask backend
                    sendAudio(base64Audio);
                }

                setRecorder(newRecorder);
                setCanRecord(true);
            } catch (err) {
                console.error(err);
            }
        }

        setupAudio();
    }, []);

    useEffect(() => {
        if (!isRecording) return;

        // Check for SpeechRecognition API support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.error("Speech Recognition API is not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = true;

        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                finalTranscript += event.results[i][0].transcript;
            }
            setTranscript(finalTranscript);
        };

        recognition.start();

        return () => recognition.stop();
    }, [isRecording]);

    const toggleMic = () => {
        if (!canRecord) return;

        setIsRecording(!isRecording);

        if (!isRecording) {
            recorder.start();
        } else {
            recorder.stop();
        }
    };

    const blobToBase64 = (blob) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const sendAudio = (base64Audio) => {
        fetch('http://127.0.0.1:5000/prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ audio: base64Audio }),
        })
        .then(response => response.json())
        .then(data => {
            console.log('Success:', data);
            if (data.audio) {
                playAudioResponse(data.audio);
                // Assuming the backend returns a transcribed text
                setTranscript(data.transcript || '');
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
    };

    const playAudioResponse = (base64Audio) => {
        const audioBlob = base64ToBlob(base64Audio, 'audio/webm');
        const audioUrl = URL.createObjectURL(audioBlob);
        if (playbackRef.current) {
            playbackRef.current.src = audioUrl;
            playbackRef.current.play();
        }
    };

    const base64ToBlob = (base64, mime) => {
        const byteChars = atob(base64);
        const byteArrays = [];

        for (let offset = 0; offset < byteChars.length; offset += 512) {
            const slice = byteChars.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);

            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }

            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }

        return new Blob(byteArrays, { type: mime });
    };

    return (
        <main>
            <button className={`mic-toggle ${isRecording ? 'is-recording' : ''}`} onClick={toggleMic}>
                <span className="material-symbols-outlined">
                    mic
                </span>
            </button>

            <audio className="playback" controls ref={playbackRef}></audio>

            <div className="transcription">
                <p>{transcript}</p>
            </div>
        </main>
    );
}

export default App;
