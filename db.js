// IndexedDB Datenbank-Verwaltung
class VocabularyDB {
    constructor() {
        this.dbName = 'VocabularyDB';
        this.version = 1;
        this.db = null;
    }

    // Datenbank initialisieren
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Object Store für Vokabeln erstellen
                if (!db.objectStoreNames.contains('words')) {
                    const objectStore = db.createObjectStore('words', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    
                    // Indizes für Suche erstellen
                    objectStore.createIndex('german', 'german', { unique: false });
                    objectStore.createIndex('spanish', 'spanish', { unique: false });
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    // Neues Wort hinzufügen
    async addWord(german, spanish, audioBlob, tags = []) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['words'], 'readwrite');
            const objectStore = transaction.objectStore('words');

            const word = {
                german: german.trim(),
                spanish: spanish.trim(),
                audio: audioBlob,
                tags: tags, // Array von Tag-Strings
                timestamp: Date.now()
            };

            const request = objectStore.add(word);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Wörter nach Tag filtern
    async getWordsByTag(tag) {
        const allWords = await this.getAllWords();
        return allWords.filter(word => word.tags && word.tags.includes(tag));
    }

    // Alle verwendeten Tags abrufen
    async getAllTags() {
        const allWords = await this.getAllWords();
        const tagsSet = new Set();
        
        allWords.forEach(word => {
            if (word.tags) {
                word.tags.forEach(tag => tagsSet.add(tag));
            }
        });
        
        return Array.from(tagsSet).sort();
    }

    // Alle Wörter abrufen
    async getAllWords() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['words'], 'readonly');
            const objectStore = transaction.objectStore('words');
            const request = objectStore.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Einzelnes Wort abrufen
    async getWord(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['words'], 'readonly');
            const objectStore = transaction.objectStore('words');
            const request = objectStore.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Wort aktualisieren
    async updateWord(id, german, spanish, audioBlob, tags = []) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['words'], 'readwrite');
            const objectStore = transaction.objectStore('words');
            
            // Erst das alte Wort holen
            const getRequest = objectStore.get(id);
            
            getRequest.onsuccess = () => {
                const word = getRequest.result;
                
                if (!word) {
                    reject(new Error('Wort nicht gefunden'));
                    return;
                }
                
                // Update mit neuen Werten
                word.german = german.trim();
                word.spanish = spanish.trim();
                word.tags = tags;
                
                // Nur Audio updaten wenn neues vorhanden
                if (audioBlob) {
                    word.audio = audioBlob;
                }
                
                const updateRequest = objectStore.put(word);
                
                updateRequest.onsuccess = () => resolve(word);
                updateRequest.onerror = () => reject(updateRequest.error);
            };
            
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    // Wort löschen
    async deleteWord(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['words'], 'readwrite');
            const objectStore = transaction.objectStore('words');
            const request = objectStore.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Alle Wörter löschen
    async deleteAllWords() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['words'], 'readwrite');
            const objectStore = transaction.objectStore('words');
            const request = objectStore.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Anzahl der Wörter
    async getWordCount() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['words'], 'readonly');
            const objectStore = transaction.objectStore('words');
            const request = objectStore.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Zufälliges Wort für Übung
    async getRandomWord() {
        const words = await this.getAllWords();
        if (words.length === 0) return null;
        
        const randomIndex = Math.floor(Math.random() * words.length);
        return words[randomIndex];
    }
}

// Globale Datenbank-Instanz
const vocabularyDB = new VocabularyDB();
