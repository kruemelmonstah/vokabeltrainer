// App Initialisierung
let mediaRecorder;
let audioChunks = [];
let recordedAudio = null;

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

    // Wort speichern
    document.getElementById('save-word-btn').addEventListener('click', saveWord);

    // Tags - Vorhandene Tags anzeigen beim Focus
    document.getElementById('tags-input').addEventListener('focus', showExistingTags);

    // View Toggle (Baum vs. Liste)
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // Edit Modal Audio Recording
    document.getElementById('edit-record-btn').addEventListener('click', startEditRecording);
    document.getElementById('edit-stop-btn').addEventListener('click', stopEditRecording);
    document.getElementById('edit-play-preview-btn').addEventListener('click', playEditPreview);

    // Edit Modal Tag Input Focus
    document.getElementById('edit-tags-input').addEventListener('focus', showEditExistingTags);

    // Edit Modal Controls
    document.getElementById('close-modal-btn').addEventListener('click', closeEditModal);
    document.getElementById('cancel-edit-btn').addEventListener('click', closeEditModal);
    document.getElementById('save-edit-btn').addEventListener('click', saveEditedWord);
    
    // Modal Hintergrund schließt Modal
    document.getElementById('edit-modal').addEventListener('click', (e) => {
        if (e.target.id === 'edit-modal') {
            closeEditModal();
        }
    });

    // Playlist Controls
    document.getElementById('practice-all-btn').addEventListener('click', () => startPlaylist(null));
    document.getElementById('play-pause-btn').addEventListener('click', togglePlayPause);
    document.getElementById('prev-word-btn').addEventListener('click', previousWord);
    document.getElementById('next-playlist-btn').addEventListener('click', nextWord);
    document.getElementById('back-to-categories-btn').addEventListener('click', backToCategories);
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

async function startRecording() {
    try {
        const constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        let options = { mimeType: 'audio/webm' };
        
        if (!MediaRecorder.isTypeSupported('audio/webm')) {
            if (MediaRecorder.isTypeSupported('audio/mp4')) {
                options = { mimeType: 'audio/mp4' };
            } else {
                options = {};
            }
        }

        mediaRecorder = new MediaRecorder(stream, options);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const mimeType = mediaRecorder.mimeType || 'audio/webm';
            const audioBlob = new Blob(audioChunks, { type: mimeType });
            recordedAudio = audioBlob;
            
            document.getElementById('play-preview-btn').disabled = false;
            document.getElementById('recording-status').textContent = '✓ Aufnahme gespeichert';
            document.getElementById('recording-status').classList.remove('recording');
            
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();

        document.getElementById('record-btn').disabled = true;
        document.getElementById('stop-btn').disabled = false;
        document.getElementById('record-btn').classList.add('recording');
        document.getElementById('recording-status').textContent = '🔴 Aufnahme läuft...';
        document.getElementById('recording-status').classList.add('recording');

    } catch (error) {
        console.error('Fehler bei Aufnahme:', error);
        alert('Fehler beim Zugriff auf das Mikrofon. Bitte Berechtigungen prüfen.');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        
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
    const tagsInput = document.getElementById('tags-input').value.trim();

    if (!germanWord || !spanishWord) {
        alert('Bitte beide Wörter eingeben!');
        return;
    }

    if (!recordedAudio) {
        alert('Bitte eine Audio-Aufnahme machen!');
        return;
    }

    const tags = tagsInput
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

    try {
        await vocabularyDB.addWord(germanWord, spanishWord, recordedAudio, tags);

        showSuccessMessage('Wort erfolgreich gespeichert! ✓');

        document.getElementById('german-word').value = '';
        document.getElementById('spanish-word').value = '';
        document.getElementById('tags-input').value = '';
        recordedAudio = null;
        document.getElementById('play-preview-btn').disabled = true;
        document.getElementById('recording-status').textContent = '';

        await updateWordList();

    } catch (error) {
        console.error('Fehler beim Speichern:', error);
        alert('Fehler beim Speichern des Wortes.');
    }
}

async function showExistingTags() {
    const existingTagsDiv = document.getElementById('existing-tags');
    const tags = await vocabularyDB.getAllTags();
    
    if (tags.length === 0) {
        existingTagsDiv.innerHTML = '';
        return;
    }
    
    existingTagsDiv.innerHTML = tags.map(tag => 
        `<span class="tag-chip" onclick="addTagToInput('${escapeHtml(tag)}')">${escapeHtml(tag)}</span>`
    ).join('');
}

function addTagToInput(tag) {
    const input = document.getElementById('tags-input');
    const currentValue = input.value.trim();
    
    if (currentValue) {
        if (!currentValue.endsWith(',')) {
            input.value = currentValue + ', ' + tag;
        } else {
            input.value = currentValue + ' ' + tag;
        }
    } else {
        input.value = tag;
    }
    
    input.focus();
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

// === BEARBEITEN ===

let editingWordId = null;
let editRecordedAudio = null;
let editMediaRecorder = null;
let editAudioChunks = [];

async function editWord(id) {
    try {
        const word = await vocabularyDB.getWord(id);
        
        if (!word) {
            alert('Wort nicht gefunden!');
            return;
        }
        
        editingWordId = id;
        editRecordedAudio = null;
        
        document.getElementById('edit-german-word').value = word.german;
        document.getElementById('edit-spanish-word').value = word.spanish;
        document.getElementById('edit-tags-input').value = word.tags ? word.tags.join(', ') : '';
        
        document.getElementById('edit-recording-status').textContent = '';
        document.getElementById('edit-recording-status').classList.remove('recording');
        document.getElementById('edit-play-preview-btn').disabled = true;
        
        await showEditExistingTags();
        
        document.getElementById('edit-modal').classList.add('active');
        
    } catch (error) {
        console.error('Fehler beim Laden:', error);
        alert('Fehler beim Laden des Wortes.');
    }
}

function closeEditModal() {
    if (editMediaRecorder && editMediaRecorder.state !== 'inactive') {
        editMediaRecorder.stop();
    }
    
    document.getElementById('edit-modal').classList.remove('active');
    editingWordId = null;
    editRecordedAudio = null;
    editMediaRecorder = null;
    editAudioChunks = [];
    
    document.getElementById('edit-record-btn').disabled = false;
    document.getElementById('edit-stop-btn').disabled = true;
    document.getElementById('edit-record-btn').classList.remove('recording');
}

async function startEditRecording() {
    try {
        const constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        let options = { mimeType: 'audio/webm' };
        
        if (!MediaRecorder.isTypeSupported('audio/webm')) {
            if (MediaRecorder.isTypeSupported('audio/mp4')) {
                options = { mimeType: 'audio/mp4' };
            } else {
                options = {};
            }
        }

        editMediaRecorder = new MediaRecorder(stream, options);
        editAudioChunks = [];

        editMediaRecorder.ondataavailable = (event) => {
            editAudioChunks.push(event.data);
        };

        editMediaRecorder.onstop = () => {
            const mimeType = editMediaRecorder.mimeType || 'audio/webm';
            const audioBlob = new Blob(editAudioChunks, { type: mimeType });
            editRecordedAudio = audioBlob;
            
            document.getElementById('edit-play-preview-btn').disabled = false;
            document.getElementById('edit-recording-status').textContent = '✓ Aufnahme gespeichert';
            document.getElementById('edit-recording-status').classList.remove('recording');
            
            stream.getTracks().forEach(track => track.stop());
        };

        editMediaRecorder.start();

        document.getElementById('edit-record-btn').disabled = true;
        document.getElementById('edit-stop-btn').disabled = false;
        document.getElementById('edit-record-btn').classList.add('recording');
        document.getElementById('edit-recording-status').textContent = '🔴 Aufnahme läuft...';
        document.getElementById('edit-recording-status').classList.add('recording');

    } catch (error) {
        console.error('Fehler bei Aufnahme:', error);
        alert('Fehler beim Zugriff auf das Mikrofon. Bitte Berechtigungen prüfen.');
    }
}

function stopEditRecording() {
    if (editMediaRecorder && editMediaRecorder.state !== 'inactive') {
        editMediaRecorder.stop();
        
        document.getElementById('edit-record-btn').disabled = false;
        document.getElementById('edit-stop-btn').disabled = true;
        document.getElementById('edit-record-btn').classList.remove('recording');
    }
}

function playEditPreview() {
    if (editRecordedAudio) {
        const audio = new Audio(URL.createObjectURL(editRecordedAudio));
        audio.play();
    }
}

async function showEditExistingTags() {
    const existingTagsDiv = document.getElementById('edit-existing-tags');
    const tags = await vocabularyDB.getAllTags();
    
    if (tags.length === 0) {
        existingTagsDiv.innerHTML = '';
        return;
    }
    
    existingTagsDiv.innerHTML = tags.map(tag => 
        `<span class="tag-chip" onclick="addEditTagToInput('${escapeHtml(tag)}')">${escapeHtml(tag)}</span>`
    ).join('');
}

function addEditTagToInput(tag) {
    const input = document.getElementById('edit-tags-input');
    const currentValue = input.value.trim();
    
    if (currentValue) {
        if (!currentValue.endsWith(',')) {
            input.value = currentValue + ', ' + tag;
        } else {
            input.value = currentValue + ' ' + tag;
        }
    } else {
        input.value = tag;
    }
    
    input.focus();
}

async function saveEditedWord() {
    const germanWord = document.getElementById('edit-german-word').value.trim();
    const spanishWord = document.getElementById('edit-spanish-word').value.trim();
    const tagsInput = document.getElementById('edit-tags-input').value.trim();

    if (!germanWord || !spanishWord) {
        alert('Bitte beide Felder ausfüllen!');
        return;
    }

    const tags = tagsInput
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

    try {
        await vocabularyDB.updateWord(editingWordId, germanWord, spanishWord, editRecordedAudio, tags);

        closeEditModal();

        alert('✓ Änderungen gespeichert!');

        // FIX 1: Liste bleibt an gleicher Position (expandedFolders wird beibehalten)
        await updateWordList();
        await updatePracticeView();

    } catch (error) {
        console.error('Fehler beim Speichern:', error);
        alert('Fehler beim Speichern der Änderungen.');
    }
}

// === WORTLISTE ===

let currentView = 'tree';
let expandedFolders = new Set(); // FIX 1: Speichert welche Ordner aufgeklappt sind

function switchView(view) {
    currentView = view;
    
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    if (view === 'tree') {
        document.getElementById('tree-view').style.display = 'block';
        document.getElementById('flat-view').style.display = 'none';
    } else {
        document.getElementById('tree-view').style.display = 'none';
        document.getElementById('flat-view').style.display = 'block';
    }
    
    updateWordList();
}

async function updateWordList() {
    const wordCount = document.getElementById('word-count');
    const words = await vocabularyDB.getAllWords();
    wordCount.textContent = words.length;
    
    if (currentView === 'tree') {
        await updateTreeView(words);
    } else {
        await updateFlatView(words);
    }
}

async function updateTreeView(words) {
    const categoryTree = document.getElementById('category-tree');
    categoryTree.innerHTML = '';
    
    const categorizedWords = {};
    const uncategorized = [];
    
    words.forEach(word => {
        if (word.tags && word.tags.length > 0) {
            word.tags.forEach(tag => {
                if (!categorizedWords[tag]) {
                    categorizedWords[tag] = [];
                }
                categorizedWords[tag].push(word);
            });
        } else {
            uncategorized.push(word);
        }
    });
    
    const sortedCategories = Object.keys(categorizedWords).sort();
    
    sortedCategories.forEach(category => {
        const folder = createCategoryFolder(category, categorizedWords[category]);
        categoryTree.appendChild(folder);
    });
    
    if (uncategorized.length > 0) {
        const folder = createCategoryFolder('📝 Ohne Kategorie', uncategorized);
        categoryTree.appendChild(folder);
    }
    
    if (words.length === 0) {
        categoryTree.innerHTML = '<div class="info-message">Noch keine Wörter gespeichert.</div>';
    }
}

function createCategoryFolder(categoryName, words) {
    const folder = document.createElement('div');
    folder.className = 'category-folder';
    
    folder.innerHTML = `
        <div class="folder-header">
            <span class="folder-icon">▶</span>
            <span class="folder-name">${escapeHtml(categoryName)}</span>
            <span class="folder-count">${words.length}</span>
        </div>
        <div class="folder-content">
            ${words.map(word => createWordListItemHTML(word)).join('')}
        </div>
    `;
    
    const header = folder.querySelector('.folder-header');
    const content = folder.querySelector('.folder-content');
    
    // FIX 1: Stelle Zustand wieder her
    if (expandedFolders.has(categoryName)) {
        header.classList.add('expanded');
        content.classList.add('expanded');
    }
    
    header.addEventListener('click', () => {
        const isExpanding = !header.classList.contains('expanded');
        
        header.classList.toggle('expanded');
        content.classList.toggle('expanded');
        
        // FIX 1: Speichere Zustand
        if (isExpanding) {
            expandedFolders.add(categoryName);
        } else {
            expandedFolders.delete(categoryName);
        }
    });
    
    return folder;
}

async function updateFlatView(words) {
    const wordList = document.getElementById('word-list');
    wordList.innerHTML = '';
    
    words.forEach(word => {
        const wordItem = createWordListItem(word);
        wordList.appendChild(wordItem);
    });
}

function createWordListItemHTML(word) {
    const tags = word.tags && word.tags.length > 0 
        ? `<div class="word-tags">${word.tags.map(tag => `<span class="tag-badge">${escapeHtml(tag)}</span>`).join('')}</div>`
        : '';
    
    return `
        <div class="word-item">
            <div class="word-content">
                <div class="word-german">${escapeHtml(word.german)}</div>
                <div class="word-spanish">${escapeHtml(word.spanish)}</div>
                ${tags}
            </div>
            <div class="word-actions">
                <button class="btn-icon play" onclick="playWordAudio(${word.id})" title="Abspielen">
                    🔊
                </button>
                <button class="btn-icon edit" onclick="editWord(${word.id})" title="Bearbeiten">
                    ✏️
                </button>
                <button class="btn-icon delete" onclick="deleteWord(${word.id})" title="Löschen">
                    🗑️
                </button>
            </div>
        </div>
    `;
}

function createWordListItem(word) {
    const div = document.createElement('div');
    div.className = 'word-item';
    div.innerHTML = createWordListItemHTML(word);
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

// === ÜBEN / PLAYLIST ===

let playlistWords = [];
let currentWordIndex = 0;
let isPlaying = false;
let playlistAudio = null;
let playlistTimeout = null;

async function updatePracticeView() {
    const count = await vocabularyDB.getWordCount();
    
    const noWordsMsg = document.getElementById('no-words-message');
    const categorySelection = document.getElementById('category-selection');

    if (count === 0) {
        noWordsMsg.style.display = 'block';
        categorySelection.style.display = 'none';
    } else {
        noWordsMsg.style.display = 'none';
        categorySelection.style.display = 'block';
        await loadCategories();
    }
}

async function loadCategories() {
    const categoryList = document.getElementById('category-list');
    const tags = await vocabularyDB.getAllTags();
    
    categoryList.innerHTML = '';
    
    for (const tag of tags) {
        const words = await vocabularyDB.getWordsByTag(tag);
        const card = document.createElement('div');
        card.className = 'category-card';
        card.innerHTML = `
            <div class="category-icon">📁</div>
            <div class="category-name">${escapeHtml(tag)}</div>
            <div class="category-word-count">${words.length} Wörter</div>
        `;
        card.addEventListener('click', () => startPlaylist(tag));
        categoryList.appendChild(card);
    }
}

async function startPlaylist(tag) {
    if (tag) {
        playlistWords = await vocabularyDB.getWordsByTag(tag);
        document.getElementById('playlist-title').textContent = tag;
    } else {
        playlistWords = await vocabularyDB.getAllWords();
        document.getElementById('playlist-title').textContent = 'Alle Wörter';
    }
    
    if (playlistWords.length === 0) {
        alert('Keine Wörter in dieser Kategorie!');
        return;
    }
    
    playlistWords = shuffleArray(playlistWords);
    
    currentWordIndex = 0;
    isPlaying = false;
    
    document.getElementById('category-selection').style.display = 'none';
    document.getElementById('playlist-mode').style.display = 'block';
    
    loadPlaylistWord();
}

function loadPlaylistWord() {
    if (currentWordIndex >= playlistWords.length) {
        const repeatMode = document.getElementById('repeat-mode').checked;
        
        if (repeatMode) {
            currentWordIndex = 0;
            playlistWords = shuffleArray(playlistWords);
            loadPlaylistWord();
            return;
        } else {
            stopPlaylist();
            alert('Playlist beendet! 🎉');
            backToCategories();
            return;
        }
    }
    
    const word = playlistWords[currentWordIndex];
    
    document.getElementById('playlist-german').textContent = word.german;
    document.getElementById('playlist-spanish').textContent = word.spanish;
    document.getElementById('playlist-counter').textContent = 
        `${currentWordIndex + 1} / ${playlistWords.length}`;
    
    const progress = ((currentWordIndex + 1) / playlistWords.length) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
    
    if (isPlaying) {
        playCurrentAudio();
    }
}

function playCurrentAudio() {
    const word = playlistWords[currentWordIndex];
    
    if (word && word.audio) {
        if (playlistAudio) {
            playlistAudio.pause();
            playlistAudio = null;
        }
        
        playlistAudio = new Audio(URL.createObjectURL(word.audio));
        
        // FIX 2: Warte bis Audio KOMPLETT fertig ist
        playlistAudio.onended = () => {
            const pauseDuration = parseInt(document.getElementById('pause-duration').value) * 1000;
            
            if (isPlaying) {
                if (pauseDuration > 0) {
                    playlistTimeout = setTimeout(() => {
                        nextWord();
                    }, pauseDuration);
                } else {
                    // Kleine Verzögerung auch bei "Keine"
                    playlistTimeout = setTimeout(() => {
                        nextWord();
                    }, 100);
                }
            }
        };
        
        // FIX 2: Fehlerbehandlung
        playlistAudio.onerror = (error) => {
            console.error('Audio-Fehler:', error);
            if (isPlaying) {
                setTimeout(() => nextWord(), 500);
            }
        };
        
        playlistAudio.play().catch(err => {
            console.error('Play-Fehler:', err);
            if (isPlaying) {
                setTimeout(() => nextWord(), 500);
            }
        });
    } else {
        if (isPlaying) {
            setTimeout(() => nextWord(), 500);
        }
    }
}

function togglePlayPause() {
    const btn = document.getElementById('play-pause-btn');
    
    if (isPlaying) {
        isPlaying = false;
        btn.textContent = '▶️';
        btn.classList.remove('playing');
        
        if (playlistAudio) {
            playlistAudio.pause();
        }
        
        if (playlistTimeout) {
            clearTimeout(playlistTimeout);
            playlistTimeout = null;
        }
    } else {
        isPlaying = true;
        btn.textContent = '⏸️';
        btn.classList.add('playing');
        
        playCurrentAudio();
    }
}

function previousWord() {
    stopCurrentPlayback();
    
    if (currentWordIndex > 0) {
        currentWordIndex--;
    } else {
        currentWordIndex = playlistWords.length - 1;
    }
    
    loadPlaylistWord();
}

function nextWord() {
    stopCurrentPlayback();
    currentWordIndex++;
    loadPlaylistWord();
}

function stopCurrentPlayback() {
    if (playlistAudio) {
        playlistAudio.pause();
        playlistAudio = null;
    }
    
    if (playlistTimeout) {
        clearTimeout(playlistTimeout);
        playlistTimeout = null;
    }
}

function stopPlaylist() {
    isPlaying = false;
    stopCurrentPlayback();
    
    const btn = document.getElementById('play-pause-btn');
    btn.textContent = '▶️';
    btn.classList.remove('playing');
}

function backToCategories() {
    stopPlaylist();
    
    document.getElementById('playlist-mode').style.display = 'none';
    document.getElementById('category-selection').style.display = 'block';
    
    loadCategories();
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
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
window.addTagToInput = addTagToInput;
window.addEditTagToInput = addEditTagToInput;
window.editWord = editWord;
