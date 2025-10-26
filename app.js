// App Initialisierung
let mediaRecorder;
let audioChunks = [];
let recordedAudio = null;
let currentPracticeWord = null;

// DOM Elemente
const tabs = {
    add: document.getElementById('add-tab'),
    practice: document.getElementById('practice-tab'),
    list: document.getElementById('list-tab')
};

// Event Listeners nach DOM-Laden
document.addEventListener('DOMContentLoaded', async () => {
    await vocabularyDB.init();
    setupEventListeners();
    await updateWordList();
    await updatePracticeView();
});

// Event Listeners einrichten
function setupEventListeners() {
    // Tab Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Audio Aufnahme
    document.getElementById('record-btn').addEventListener('click', startRecording);
    document.getElementById('stop-btn').addEventListener('click', stopRecording);
    document.getElementById('play-preview-btn').addEventListener('click', playPreview);

    // Audio Upload
    document.getElementById('upload-audio-btn').addEventListener('click', () => {
        document.getElementById('audio-file-input').click();
    });
    document.getElementById('audio-file-input').addEventListener('change', handleAudioUpload);

    // Wort speichern
    document.getElementById('save-word-btn').addEventListener('click', saveWord);

    // Practice
    document.getElementById('show-answer-btn').addEventListener('click', showAnswer);
    document.getElementById('next-word-btn').addEventListener('click', nextWord);
    document.getElementById('play-audio-btn').addEventListener('click', playCurrentWordAudio);

    // Liste
    document.getElementById('delete-all-btn').addEventListener('click', deleteAllWords);
}

// Tab wechseln
function switchTab(tabName) {
    // Tab Buttons aktualisieren
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Tab Content aktualisieren
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const targetTab = document.getElementById(`${tabName}-tab`);
    if (targetTab) {
        targetTab.classList.add('active');
    }

    // Daten aktualisieren beim Tab-Wechsel
    if (tabName === 'list') {
        updateWordList();
    } else if (tabName === 'practice') {
        updatePracticeView();
    }
}

// === AUDIO AUFNAHME ===

// Audio-Datei hochladen
function handleAudioUpload(event) {
    const file = event.target.files[0];
    
    if (!file) return;

    // Prüfe ob es eine Audio-Datei ist
    if (!file.type.startsWith('audio/')) {
        alert('Bitte wähle eine Audio-Datei aus!');
        return;
    }

    // Konvertiere zu Blob und speichere
    recordedAudio = file;

    // UI aktualisieren
    document.getElementById('upload-status').textContent = `✓ ${file.name} hochgeladen`;
    document.getElementById('upload-status').classList.add('success');
    document.getElementById('play-preview-btn').disabled = false;
    
    // Recording Status zurücksetzen
    document.getElementById('recording-status').textContent = '';
    document.getElementById('recording-status').classList.remove('recording');
}

async function startRecording() {
    try {
        // Für iOS: Explizit Audio-Constraints setzen
        const constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Für iOS: Versuche verschiedene MIME-Types
        let options = { mimeType: 'audio/webm' };
        
        // Fallback für iOS - versuche MP4
        if (!MediaRecorder.isTypeSupported('audio/webm')) {
            if (MediaRecorder.isTypeSupported('audio/mp4')) {
                options = { mimeType: 'audio/mp4' };
            } else {
                // Kein MIME-Type angeben, Browser wählt automatisch
                options = {};
            }
        }

        mediaRecorder = new MediaRecorder(stream, options);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            // Erstelle Blob mit dem aufgenommenen Format
            const mimeType = mediaRecorder.mimeType || 'audio/webm';
            const audioBlob = new Blob(audioChunks, { type: mimeType });
            recordedAudio = audioBlob;
            
            // UI aktualisieren
            document.getElementById('play-preview-btn').disabled = false;
            document.getElementById('recording-status').textContent = '✓ Aufnahme gespeichert';
            document.getElementById('recording-status').classList.remove('recording');
            
            // Upload Status zurücksetzen
            document.getElementById('upload-status').textContent = '';
            document.getElementById('upload-status').classList.remove('success');
            
            // Stream stoppen
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();

        // UI aktualisieren
        document.getElementById('record-btn').disabled = true;
        document.getElementById('stop-btn').disabled = false;
        document.getElementById('record-btn').classList.add('recording');
        document.getElementById('recording-status').textContent = '🔴 Aufnahme läuft...';
        document.getElementById('recording-status').classList.add('recording');

    } catch (error) {
        console.error('Fehler bei Aufnahme:', error);
        alert('Fehler beim Zugriff auf das Mikrofon. Bitte Berechtigungen prüfen oder eine Audio-Datei hochladen.');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        
        // UI aktualisieren
        document.getElementById('record-btn').disabled = false;
        document.getElementById('stop-btn').disabled = true;
        document.getElementById('record-btn').classList.remove('recording');
    }
}

function playPreview() {
    if (recordedAudio) {
        const audio = new Audio(URL.createObjectURL(recordedAudio));
        audio.play();
    }
}

// === WORT SPEICHERN ===

async function saveWord() {
    const germanWord = document.getElementById('german-word').value.trim();
    const spanishWord = document.getElementById('spanish-word').value.trim();

    // Validierung
    if (!germanWord || !spanishWord) {
        alert('Bitte beide Wörter eingeben!');
        return;
    }

    if (!recordedAudio) {
        alert('Bitte eine Audio-Datei hochladen oder eine Aufnahme machen!');
        return;
    }

    try {
        // Wort in Datenbank speichern
        await vocabularyDB.addWord(germanWord, spanishWord, recordedAudio);

        // Erfolgs-Feedback
        showSuccessMessage('Wort erfolgreich gespeichert! ✓');

        // Formular zurücksetzen
        document.getElementById('german-word').value = '';
        document.getElementById('spanish-word').value = '';
        document.getElementById('audio-file-input').value = '';
        recordedAudio = null;
        document.getElementById('play-preview-btn').disabled = true;
        document.getElementById('recording-status').textContent = '';
        document.getElementById('upload-status').textContent = '';
        document.getElementById('upload-status').classList.remove('success');

        // Liste aktualisieren
        await updateWordList();

    } catch (error) {
        console.error('Fehler beim Speichern:', error);
        alert('Fehler beim Speichern des Wortes.');
    }
}

function showSuccessMessage(message) {
    const existingMsg = document.querySelector('.success-message');
    if (existingMsg) existingMsg.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = 'success-message';
    msgDiv.textContent = message;
    
    const addTab = document.getElementById('add-tab');
    addTab.querySelector('.card').appendChild(msgDiv);

    setTimeout(() => msgDiv.remove(), 3000);
}

// === WORTLISTE ===

async function updateWordList() {
    const wordList = document.getElementById('word-list');
    const wordCount = document.getElementById('word-count');
    
    wordList.innerHTML = '';

    const words = await vocabularyDB.getAllWords();
    wordCount.textContent = words.length;

    words.forEach(word => {
        const wordItem = createWordListItem(word);
        wordList.appendChild(wordItem);
    });
}

function createWordListItem(word) {
    const div = document.createElement('div');
    div.className = 'word-item';

    div.innerHTML = `
        <div class="word-content">
            <div class="word-german">${escapeHtml(word.german)}</div>
            <div class="word-spanish">${escapeHtml(word.spanish)}</div>
        </div>
        <div class="word-actions">
            <button class="btn-icon play" onclick="playWordAudio(${word.id})">
                🔊
            </button>
            <button class="btn-icon delete" onclick="deleteWord(${word.id})">
                🗑️
            </button>
        </div>
    `;

    return div;
}

async function playWordAudio(id) {
    try {
        const word = await vocabularyDB.getWord(id);
        if (word && word.audio) {
            const audio = new Audio(URL.createObjectURL(word.audio));
            audio.play();
        }
    } catch (error) {
        console.error('Fehler beim Abspielen:', error);
    }
}

async function deleteWord(id) {
    if (confirm('Wort wirklich löschen?')) {
        try {
            await vocabularyDB.deleteWord(id);
            await updateWordList();
            await updatePracticeView();
        } catch (error) {
            console.error('Fehler beim Löschen:', error);
            alert('Fehler beim Löschen des Wortes.');
        }
    }
}

async function deleteAllWords() {
    if (confirm('Wirklich ALLE Wörter löschen? Dies kann nicht rückgängig gemacht werden!')) {
        try {
            await vocabularyDB.deleteAllWords();
            await updateWordList();
            await updatePracticeView();
        } catch (error) {
            console.error('Fehler beim Löschen:', error);
            alert('Fehler beim Löschen der Wörter.');
        }
    }
}

// === ÜBEN ===

async function updatePracticeView() {
    const count = await vocabularyDB.getWordCount();
    
    const noWordsMsg = document.getElementById('no-words-message');
    const practiceContent = document.getElementById('practice-content');

    if (count === 0) {
        noWordsMsg.style.display = 'block';
        practiceContent.style.display = 'none';
    } else {
        noWordsMsg.style.display = 'none';
        practiceContent.style.display = 'block';
        await loadNextPracticeWord();
    }
}

async function loadNextPracticeWord() {
    currentPracticeWord = await vocabularyDB.getRandomWord();
    
    if (currentPracticeWord) {
        document.getElementById('practice-german').textContent = currentPracticeWord.german;
        document.getElementById('practice-spanish').textContent = currentPracticeWord.spanish;
        
        // Antwort verbergen
        document.getElementById('show-answer-btn').style.display = 'block';
        document.getElementById('answer-section').style.display = 'none';

        // Counter aktualisieren
        const count = await vocabularyDB.getWordCount();
        document.getElementById('practice-counter').textContent = `1 / ${count}`;
    }
}

function showAnswer() {
    document.getElementById('show-answer-btn').style.display = 'none';
    document.getElementById('answer-section').style.display = 'block';
}

function nextWord() {
    loadNextPracticeWord();
}

function playCurrentWordAudio() {
    if (currentPracticeWord && currentPracticeWord.audio) {
        const audio = new Audio(URL.createObjectURL(currentPracticeWord.audio));
        audio.play();
    }
}

// === HILFSFUNKTIONEN ===

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Globale Funktionen für onclick-Handler
window.playWordAudio = playWordAudio;
window.deleteWord = deleteWord;
