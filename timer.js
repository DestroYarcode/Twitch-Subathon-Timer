/**
 * Subathon Timer - Timer Logic
 */

class SubathonTimer {
    constructor() {
        this.totalSeconds = 0;
        this.isRunning = false;
        this.interval = null;
        this.totalSubs = 0;
        this.totalTimeAdded = 0;
        this.warningThreshold = 300; // 5 Minuten Warnung
        
        // DOM Elements
        this.hoursEl = document.getElementById('hours');
        this.minutesEl = document.getElementById('minutes');
        this.secondsEl = document.getElementById('seconds');
        this.totalSubsEl = document.getElementById('total-subs');
        this.timeAddedEl = document.getElementById('time-added');
        this.timerContainer = document.querySelector('.timer-container');
        
        // Load saved state
        this.loadState();
    }
    
    /**
     * Timer starten
     */
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.interval = setInterval(() => this.tick(), 1000);
        this.saveState();
        console.log('⏱️ Timer gestartet');
    }
    
    /**
     * Timer pausieren
     */
    pause() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        clearInterval(this.interval);
        this.saveState();
        console.log('⏸️ Timer pausiert');
    }
    
    /**
     * Timer zurücksetzen
     */
    reset() {
        this.pause();
        this.totalSeconds = 0;
        this.totalSubs = 0;
        this.totalTimeAdded = 0;
        this.updateDisplay();
        this.saveState();
        console.log('🔄 Timer zurückgesetzt');
    }
    
    /**
     * Zeit setzen (in Sekunden)
     */
    setTime(seconds) {
        this.totalSeconds = Math.max(0, seconds);
        this.updateDisplay();
        this.saveState();
    }
    
    /**
     * Zeit hinzufügen (in Sekunden)
     */
    addTime(seconds, triggerAnimation = true) {
        this.totalSeconds += seconds;
        this.totalTimeAdded += seconds;
        this.updateDisplay();
        this.saveState();
        
        if (triggerAnimation) {
            this.animateTimeAdd();
        }
        
        console.log(`➕ ${this.formatTime(seconds)} hinzugefügt`);
    }
    
    /**
     * Sub registrieren
     */
    addSub(username, tier = 1, months = 1) {
        this.totalSubs++;
        this.updateDisplay();
        
        // Letzten Sub anzeigen
        document.getElementById('recent-name').textContent = username;
        
        console.log(`🎉 Neuer Sub: ${username} (Tier ${tier}, ${months} Monate)`);
    }
    
    /**
     * Jede Sekunde
     */
    tick() {
        if (this.totalSeconds > 0) {
            this.totalSeconds--;
            this.updateDisplay();
            
            // Auto-save alle 10 Sekunden
            if (this.totalSeconds % 10 === 0) {
                this.saveState();
            }
        } else {
            // Timer abgelaufen
            this.onTimerEnd();
        }
    }
    
    /**
     * Display aktualisieren
     */
    updateDisplay() {
        const hours = Math.floor(this.totalSeconds / 3600);
        const minutes = Math.floor((this.totalSeconds % 3600) / 60);
        const seconds = this.totalSeconds % 60;
        
        this.hoursEl.textContent = hours.toString().padStart(2, '0');
        this.minutesEl.textContent = minutes.toString().padStart(2, '0');
        this.secondsEl.textContent = seconds.toString().padStart(2, '0');
        
        // Subs und hinzugefügte Zeit
        this.totalSubsEl.textContent = this.totalSubs;
        this.timeAddedEl.textContent = '+' + this.formatTime(this.totalTimeAdded);
        
        // Warnung bei wenig Zeit
        if (this.totalSeconds <= this.warningThreshold && this.totalSeconds > 0) {
            this.timerContainer.classList.add('warning');
        } else {
            this.timerContainer.classList.remove('warning');
        }
    }
    
    /**
     * Zeit formatieren
     */
    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        
        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
    
    /**
     * Animation beim Zeit hinzufügen
     */
    animateTimeAdd() {
        const timeValues = document.querySelectorAll('.time-value');
        timeValues.forEach(el => {
            el.classList.add('adding');
            setTimeout(() => el.classList.remove('adding'), 500);
        });
    }
    
    /**
     * Sub-Popup Animation
     */
    showSubPopup(timeAdded) {
        const popup = document.getElementById('sub-animation');
        const popupTime = document.getElementById('popup-time');
        
        popupTime.textContent = this.formatTime(timeAdded);
        popup.classList.add('active');
        
        setTimeout(() => {
            popup.classList.remove('active');
        }, 1500);
    }
    
    /**
     * Timer abgelaufen
     */
    onTimerEnd() {
        this.pause();
        console.log('⏰ TIMER ABGELAUFEN!');
        // Hier könnte man einen Sound abspielen oder eine Benachrichtigung senden
    }
    
    /**
     * State speichern
     */
    saveState() {
        const state = {
            totalSeconds: this.totalSeconds,
            isRunning: this.isRunning,
            totalSubs: this.totalSubs,
            totalTimeAdded: this.totalTimeAdded,
            savedAt: Date.now()
        };
        localStorage.setItem('subathonTimer', JSON.stringify(state));
    }
    
    /**
     * State laden
     */
    loadState() {
        try {
            const saved = localStorage.getItem('subathonTimer');
            if (saved) {
                const state = JSON.parse(saved);
                
                // Zeit korrigieren falls Timer lief
                if (state.isRunning && state.savedAt) {
                    const elapsed = Math.floor((Date.now() - state.savedAt) / 1000);
                    state.totalSeconds = Math.max(0, state.totalSeconds - elapsed);
                }
                
                this.totalSeconds = state.totalSeconds || 0;
                this.totalSubs = state.totalSubs || 0;
                this.totalTimeAdded = state.totalTimeAdded || 0;
                
                this.updateDisplay();
                
                if (state.isRunning) {
                    this.start();
                }
                
                console.log('📂 Timer-State geladen');
            }
        } catch (e) {
            console.error('Fehler beim Laden des States:', e);
        }
    }
}

// Global instance
let timer;
