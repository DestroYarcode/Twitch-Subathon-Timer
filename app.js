/**
 * Subathon Timer - Main App
 */

// Konfiguration laden oder Defaults verwenden
function loadConfig() {
    const saved = localStorage.getItem('subathonConfig');
    if (saved) {
        return JSON.parse(saved);
    }
    
    return {
        channel: '',              // Dein Twitch-Kanal
        timePerSub: 60,           // Sekunden pro Tier 1 Sub
        timePerSubTier2: 120,     // Sekunden pro Tier 2 Sub
        timePerSubTier3: 300,     // Sekunden pro Tier 3 Sub
        timePerGiftSub: 60,       // Sekunden pro Gift Sub
        timePerBits: 6,           // Sekunden pro 100 Bits
        bitsThreshold: 100,       // Minimum Bits
        startTime: 3600,          // Start-Zeit in Sekunden (1 Stunde)
    };
}

// Config speichern
function saveConfig(config) {
    localStorage.setItem('subathonConfig', JSON.stringify(config));
}

// App initialisieren
function initApp() {
    const config = loadConfig();
    
    // Timer erstellen
    timer = new SubathonTimer();
    
    // Twitch Integration
    twitchIntegration = new TwitchIntegration(config);
    
    // Sub-Events verarbeiten
    twitchIntegration.onSub((event) => {
        console.log('📨 Event empfangen:', event);
        
        // Zeit hinzufügen
        timer.addTime(event.timeAdded);
        timer.addSub(event.username, event.tier || 1);
        timer.showSubPopup(event.timeAdded);
    });
    
    // Mit Twitch verbinden wenn Kanal konfiguriert
    if (config.channel) {
        twitchIntegration.connect();
    } else {
        console.log('⚠️ Kein Twitch-Kanal konfiguriert. Öffne control.html um den Timer zu konfigurieren.');
    }
    
    // Preview-Modus (für Testing ohne OBS)
    if (!window.obsstudio) {
        document.body.classList.add('preview-mode');
    } else {
        document.body.classList.add('obs-mode');
    }
    
    // URL-Parameter verarbeiten
    const urlParams = new URLSearchParams(window.location.search);
    
    // Auto-Start
    if (urlParams.has('autostart')) {
        timer.start();
    }
    
    // Kanal per URL setzen
    if (urlParams.has('channel')) {
        const channel = urlParams.get('channel');
        config.channel = channel;
        saveConfig(config);
        twitchIntegration.updateConfig({ channel });
        twitchIntegration.connect();
    }
    
    console.log('🚀 Subathon Timer initialisiert');
}

// Globale Funktionen für Konsole/Control Panel
window.timerControl = {
    start: () => timer.start(),
    pause: () => timer.pause(),
    reset: () => timer.reset(),
    setTime: (seconds) => timer.setTime(seconds),
    setTimeMinutes: (minutes) => timer.setTime(minutes * 60),
    setTimeHours: (hours) => timer.setTime(hours * 3600),
    addTime: (seconds) => timer.addTime(seconds),
    addMinutes: (minutes) => timer.addTime(minutes * 60),
    
    // Twitch
    setChannel: (channel) => {
        const config = loadConfig();
        config.channel = channel;
        saveConfig(config);
        twitchIntegration.updateConfig({ channel });
        if (twitchIntegration.isConnected) {
            twitchIntegration.disconnect();
        }
        twitchIntegration.connect();
    },
    
    // Test-Funktionen
    testSub: (name = 'TestUser', tier = 1) => {
        const config = loadConfig();
        const times = { 1: config.timePerSub, 2: config.timePerSubTier2, 3: config.timePerSubTier3 };
        const timeToAdd = times[tier] || config.timePerSub;
        
        timer.addTime(timeToAdd);
        timer.addSub(name, tier);
        timer.showSubPopup(timeToAdd);
    },
    
    // Config
    getConfig: () => loadConfig(),
    setConfig: (newConfig) => {
        const config = { ...loadConfig(), ...newConfig };
        saveConfig(config);
        twitchIntegration.updateConfig(config);
        return config;
    }
};

// App starten wenn DOM geladen
document.addEventListener('DOMContentLoaded', initApp);
