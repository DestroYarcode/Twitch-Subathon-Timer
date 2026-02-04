/**
 * Subathon Timer - Sync Server
 * Hält Timer und OBS synchron
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const DATA_FILE = path.join(__dirname, 'timer-data.json');

// Standard-Daten
let timerData = {
    totalSeconds: 0,
    isRunning: false,
    totalSubs: 0,
    totalTimeAdded: 0,
    lastUpdate: Date.now(),
    config: {
        channel: '',
        timePerSub: 60,
        timePerSubTier2: 120,
        timePerSubTier3: 300,
        timePerGiftSub: 60,
        timePerBits: 6
    }
};

// Daten laden
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            // Zeit korrigieren wenn Timer lief
            if (saved.isRunning && saved.lastUpdate) {
                const elapsed = Math.floor((Date.now() - saved.lastUpdate) / 1000);
                saved.totalSeconds = Math.max(0, saved.totalSeconds - elapsed);
                if (saved.totalSeconds === 0) saved.isRunning = false;
            }
            timerData = { ...timerData, ...saved };
            console.log('📂 Daten geladen');
        }
    } catch (e) {
        console.error('Fehler beim Laden:', e);
    }
}

// Daten speichern
function saveData() {
    timerData.lastUpdate = Date.now();
    fs.writeFileSync(DATA_FILE, JSON.stringify(timerData, null, 2));
}

// Timer tick
setInterval(() => {
    if (timerData.isRunning && timerData.totalSeconds > 0) {
        timerData.totalSeconds--;
        if (timerData.totalSeconds <= 0) {
            timerData.isRunning = false;
            console.log('⏰ Timer abgelaufen!');
        }
        // Alle 10 Sekunden speichern
        if (timerData.totalSeconds % 10 === 0) {
            saveData();
        }
    }
}, 1000);

// MIME Types
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Server
const server = http.createServer((req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    
    // API Endpunkte
    if (url.pathname === '/api/timer') {
        if (req.method === 'GET') {
            // Timer-Daten abrufen
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(timerData));
            return;
        }
        
        if (req.method === 'POST') {
            // Timer-Daten aktualisieren
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const update = JSON.parse(body);
                    timerData = { ...timerData, ...update };
                    saveData();
                    console.log('💾 Daten aktualisiert:', update);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, data: timerData }));
                } catch (e) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }
    }

    // API: Zeit hinzufügen (für Subs)
    if (url.pathname === '/api/addtime' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { seconds, reason, subInfo } = JSON.parse(body);
                timerData.totalSeconds += seconds;
                timerData.totalTimeAdded += seconds;
                
                // Subs zählen: Bei Gift Bombs die Anzahl, sonst 1
                if (reason === 'sub') {
                    const subCount = (subInfo && subInfo.giftCount > 0) ? subInfo.giftCount : 1;
                    timerData.totalSubs += subCount;
                    console.log(`➕ +${seconds}s (${reason}) | +${subCount} Sub(s)`);
                } else {
                    console.log(`➕ +${seconds}s (${reason || 'manual'})`);
                }
                
                saveData();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data: timerData }));
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // API: Start/Pause/Reset
    if (url.pathname === '/api/start' && req.method === 'POST') {
        timerData.isRunning = true;
        saveData();
        console.log('▶️ Timer gestartet');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    if (url.pathname === '/api/pause' && req.method === 'POST') {
        timerData.isRunning = false;
        saveData();
        console.log('⏸️ Timer pausiert');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    if (url.pathname === '/api/reset' && req.method === 'POST') {
        timerData.totalSeconds = 0;
        timerData.isRunning = false;
        timerData.totalSubs = 0;
        timerData.totalTimeAdded = 0;
        saveData();
        console.log('🔄 Timer zurückgesetzt');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    if (url.pathname === '/api/settime' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { seconds } = JSON.parse(body);
                timerData.totalSeconds = seconds;
                saveData();
                console.log(`⏱️ Zeit gesetzt: ${seconds}s`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data: timerData }));
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // Statische Dateien
    let filePath = url.pathname === '/' ? '/control.html' : url.pathname;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 - Datei nicht gefunden');
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
            return;
        }

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    });
});

// Start
loadData();
server.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('   🎮 SUBATHON TIMER SERVER');
    console.log('═══════════════════════════════════════════');
    console.log('');
    console.log(`   Kontrollzentrum: http://localhost:${PORT}/`);
    console.log(`   Timer (für OBS): http://localhost:${PORT}/timer.html`);
    console.log('');
    console.log('   Kanal: ' + (timerData.config.channel || 'Nicht konfiguriert'));
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('');
});
