# 🎮 Subathon Timer für Twitch

Ein stylischer Subathon-Timer für deinen Twitch-Stream mit automatischer Zeit-Hinzufügung bei Subs!

![Timer Preview](https://via.placeholder.com/800x400/0a0a0f/00f5d4?text=SUBATHON+TIMER)

## ✨ Features

- 🎨 **Modernes Cyberpunk-Design** - Sieht auf jedem Stream gut aus
- 📺 **OBS-Ready** - Transparenter Hintergrund für Browser Sources
- 🔄 **Auto-Sync** - Timer speichert sich automatisch (überlebt Browser-Neustarts)
- 🎉 **Sub-Animationen** - Coole Popup-Effekte bei neuen Subs
- ⚡ **Live-Updates** - Reagiert sofort auf Twitch-Events
- 🎮 **Kontrollzentrum** - Einfache Steuerung über Web-Interface

## 🚀 Schnellstart

### 1. Dateien hosten

Du brauchst einen lokalen Server oder hostest die Dateien. Am einfachsten:

```bash
# Mit Python 3
python -m http.server 8000

# Mit Node.js (npx)
npx serve

# Mit PHP
php -S localhost:8000
```

### 2. Kontrollzentrum öffnen

Öffne `control.html` im Browser:
```
http://localhost:8000/control.html
```

### 3. Twitch-Kanal eintragen

1. Gib deinen Twitch-Kanalnamen ein
2. Stelle die Zeit pro Sub-Tier ein
3. Klicke "Verbinden"

### 4. In OBS einbinden

1. Füge eine neue **Browser Source** hinzu
2. URL: `http://localhost:8000/index.html`
3. Breite: **800**, Höhe: **400**
4. Custom CSS: `body { background: transparent; }`

## ⚙️ Konfiguration

### Zeit pro Event (Standard)

| Event | Zeit |
|-------|------|
| Tier 1 Sub | 60 Sekunden |
| Tier 2 Sub | 120 Sekunden |
| Tier 3 Sub | 300 Sekunden |
| Gift Sub | 60 Sekunden |
| 100 Bits | 6 Sekunden |

### URL-Parameter

Du kannst den Kanal auch per URL setzen:
```
index.html?channel=deinkanal&autostart
```

## 🎛️ Steuerung

### Über Kontrollzentrum

- **Start/Pause/Reset** - Timer-Kontrolle
- **Quick-Buttons** - Schnell Zeit setzen (30 Min, 1h, 2h, etc.)
- **Manuell** - Exakte Zeit eingeben
- **Test-Buttons** - Sub-Animationen testen

### Über Browser-Konsole

```javascript
// Timer starten/pausieren
timerControl.start()
timerControl.pause()

// Zeit setzen (in Sekunden)
timerControl.setTime(3600)  // 1 Stunde
timerControl.setTimeHours(2) // 2 Stunden

// Zeit hinzufügen
timerControl.addTime(300)    // 5 Minuten
timerControl.addMinutes(10)  // 10 Minuten

// Test-Sub
timerControl.testSub('TestUser', 1)  // Tier 1
timerControl.testSub('VIP', 3)       // Tier 3

// Kanal ändern
timerControl.setChannel('neuerkanal')
```

## 📁 Dateistruktur

```
twitch-timer/
├── index.html      # Timer-Display (für OBS)
├── control.html    # Kontrollzentrum
├── styles.css      # Timer-Styling
├── timer.js        # Timer-Logik
├── twitch.js       # Twitch-Integration (TMI.js)
├── app.js          # Haupt-App
└── README.md       # Diese Datei
```

## 🔧 Anpassungen

### Farben ändern

In `styles.css` findest du die CSS-Variablen:

```css
:root {
    --primary: #00f5d4;    /* Hauptfarbe (Cyan) */
    --secondary: #7b2cbf;  /* Sekundär (Lila) */
    --accent: #ff006e;     /* Akzent (Pink) */
}
```

### Warnung bei wenig Zeit

Standard: 5 Minuten. Ändern in `timer.js`:

```javascript
this.warningThreshold = 300; // Sekunden
```

## 🐛 Troubleshooting

### Timer zeigt sich nicht in OBS
- Prüfe ob der lokale Server läuft
- Teste die URL im normalen Browser
- Aktiviere "Refresh browser when scene becomes active"

### Subs werden nicht erkannt
- Der Kanal muss exakt geschrieben sein (Kleinbuchstaben)
- TMI.js braucht einige Sekunden zum Verbinden
- Prüfe die Browser-Konsole auf Fehler

### Timer springt nach Browser-Neustart
- Der Timer speichert automatisch und rechnet verstrichene Zeit ab
- Das ist gewollt für Crash-Recovery

## 📜 Lizenz

Frei verwendbar für deinen Stream! 🎉

---

Made with 💜 für Twitch Streamer
