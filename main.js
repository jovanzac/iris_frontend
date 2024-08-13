const mic_btn = document.querySelector('#mic');
const playback = document.querySelector(".playback");

mic_btn.addEventListener('click', ToggleMic);

let can_record = false;
let is_recording = false;
let recorder = null;
let chunks = [];

function SetupAudio() {
    console.log("Setup");
    if (navigator.mediaDevices && navigator.getUserMedia) {
        navigator.mediaDevices
            .getUserMedia({
                audio: true
            })
            .then(SetupStream)
            .catch(err => {
                console.error(err);
            });
    }
}

function SetupStream(stream) {
    recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

    recorder.ondataavailable = e => {
        chunks.push(e.data);
    }

    recorder.onstop = async e => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        chunks = [];
        const audio_url = window.URL.createObjectURL(blob);
        playback.src = audio_url;

        // Convert blob to base64
        const base64Audio = await blobToBase64(blob);

        // Send the base64 audio to the Flask backend
        sendAudio(base64Audio);
    }

    can_record = true;
}

function ToggleMic() {
    if (!can_record) return;

    is_recording = !is_recording;

    if (is_recording) {
        recorder.start();
        mic_btn.classList.add('is-recording');
    } else {
        recorder.stop();
        mic_btn.classList.remove("is-recording");
    }
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function sendAudio(base64Audio) {
    fetch('http://127.0.0.1:5000/prompt', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ audio: base64Audio })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Success:', data);
        if (data.audio) {
            playAudioResponse(data.audio);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function playAudioResponse(base64Audio) {
    const audioBlob = base64ToBlob(base64Audio, 'audio/webm');
    const audioUrl = URL.createObjectURL(audioBlob);
    playback.src = audioUrl;
    playback.play();
}

function base64ToBlob(base64, mime) {
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
}

SetupAudio();
