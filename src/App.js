import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
    const [canRecord, setCanRecord] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recorder, setRecorder] = useState(null);
    const [commandTranscript, setCommandTranscript] = useState('');
    const [responseTranscript, setResponseTranscript] = useState('');
    const chunksRef = useRef([]);
    const playbackRef = useRef(null);
    const responseSectionRef = useRef(null); // Ref for the response section
    const micSectionRef = useRef(null); // Ref for mic section

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

                    const base64Audio = await blobToBase64(blob);
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
            setCommandTranscript(finalTranscript);
        };

        recognition.start();

        return () => recognition.stop();
    }, [isRecording]);

    // Handle spacebar press to trigger the button and prevent page scroll
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.code === 'Space') { // Check if spacebar is pressed
                event.preventDefault(); // Prevent default spacebar scroll
                toggleMic(); // Trigger the microphone toggle
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isRecording, canRecord]); // Re-run the effect if the recording state changes

    const toggleMic = () => {
        if (!canRecord) return;

        setIsRecording(!isRecording);

        if (!isRecording) {
            setCommandTranscript('');  // Clear command transcript
            setResponseTranscript(''); // Clear response transcript
            recorder.start();
        } else {
            recorder.stop();
        }

        // Scroll up to the microphone button section
        if (micSectionRef.current) {
            micSectionRef.current.scrollIntoView({ behavior: 'smooth' });
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
                setResponseTranscript(data.message || ''); // Set response transcript

                // Smoothly scroll to the response section
                if (responseSectionRef.current) {
                    responseSectionRef.current.scrollIntoView({ behavior: 'smooth' });
                }
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
            {/* Microphone button section */}
            <section className="page" ref={micSectionRef}>
                <button className={`mic-toggle ${isRecording ? 'is-recording' : ''}`} onClick={toggleMic}>
                    <span className="material-symbols-outlined">
                        mic
                    </span>
                </button>

                <audio className="playback" controls ref={playbackRef}></audio>
            </section>

            {/* Response section */}
            <section className="page" ref={responseSectionRef}>
                <div className="transcription">
                    <p className="response">{responseTranscript}</p>
                </div>
            </section>
        </main>
    );
}

export default App;
