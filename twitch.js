/**
 * Subathon Timer - Twitch Integration
 * Verwendet TMI.js für Chat-Events (inkl. Sub-Notifications)
 */

class TwitchIntegration {
    constructor(config) {
        this.config = {
            channel: config.channel || '',
            // Zeit pro Sub in Sekunden
            timePerSub: config.timePerSub || 60,          // Tier 1: 1 Minute
            timePerSubTier2: config.timePerSubTier2 || 120, // Tier 2: 2 Minuten
            timePerSubTier3: config.timePerSubTier3 || 300, // Tier 3: 5 Minuten
            timePerGiftSub: config.timePerGiftSub || 60,   // Gift Sub
            timePerBits: config.timePerBits || 0,          // Zeit pro 100 Bits
            bitsThreshold: config.bitsThreshold || 100,    // Ab wieviel Bits
        };
        
        this.client = null;
        this.isConnected = false;
        this.onSubCallback = null;
    }
    
    /**
     * Mit Twitch verbinden
     */
    connect() {
        if (!this.config.channel) {
            console.error('❌ Kein Twitch-Kanal konfiguriert!');
            return;
        }
        
        console.log(`🔌 Verbinde mit Twitch-Kanal: ${this.config.channel}`);
        
        this.client = new tmi.Client({
            options: { debug: false },
            connection: {
                secure: true,
                reconnect: true
            },
            channels: [this.config.channel]
        });
        
        // Event Handlers registrieren
        this.setupEventHandlers();
        
        // Verbinden
        this.client.connect()
            .then(() => {
                this.isConnected = true;
                console.log(`✅ Verbunden mit #${this.config.channel}`);
            })
            .catch(err => {
                console.error('❌ Verbindungsfehler:', err);
            });
    }
    
    /**
     * Verbindung trennen
     */
    disconnect() {
        if (this.client) {
            this.client.disconnect();
            this.isConnected = false;
            console.log('🔌 Verbindung getrennt');
        }
    }
    
    /**
     * Event Handlers
     */
    setupEventHandlers() {
        // Subscription (normale Subs)
        this.client.on('subscription', (channel, username, method, message, userstate) => {
            console.log(`🎉 Sub: ${username}`);
            this.handleSub(username, 1, 1);
        });
        
        // Resub
        this.client.on('resub', (channel, username, months, message, userstate, methods) => {
            const tier = this.getTierFromPlan(methods.plan);
            console.log(`🔄 Resub: ${username} (${months} Monate, Tier ${tier})`);
            this.handleSub(username, tier, months);
        });
        
        // Gift Sub (einzeln)
        this.client.on('subgift', (channel, username, streakMonths, recipient, methods, userstate) => {
            const tier = this.getTierFromPlan(methods.plan);
            console.log(`🎁 Gift Sub: ${username} → ${recipient} (Tier ${tier})`);
            this.handleGiftSub(username, recipient, tier);
        });
        
        // Mystery Gift (Community Gift Subs)
        this.client.on('submysterygift', (channel, username, numOfSubs, methods, userstate) => {
            const tier = this.getTierFromPlan(methods.plan);
            console.log(`🎁 Mystery Gift: ${username} verschenkt ${numOfSubs} Subs (Tier ${tier})`);
            // Einzelne Gift Subs werden separat durch 'subgift' getriggert
        });
        
        // Bits (Cheer)
        this.client.on('cheer', (channel, userstate, message) => {
            const bits = parseInt(userstate.bits);
            console.log(`💎 Bits: ${userstate.username} - ${bits} Bits`);
            this.handleBits(userstate.username, bits);
        });
        
        // Raid
        this.client.on('raided', (channel, username, viewers) => {
            console.log(`🚀 Raid: ${username} mit ${viewers} Viewern`);
            // Optional: Zeit für Raids hinzufügen
        });
    }
    
    /**
     * Tier aus Plan-ID ermitteln
     */
    getTierFromPlan(plan) {
        switch(plan) {
            case '2000': return 2;
            case '3000': return 3;
            case 'Prime':
            case '1000':
            default: return 1;
        }
    }
    
    /**
     * Zeit basierend auf Tier berechnen
     */
    getTimeForTier(tier) {
        switch(tier) {
            case 2: return this.config.timePerSubTier2;
            case 3: return this.config.timePerSubTier3;
            default: return this.config.timePerSub;
        }
    }
    
    /**
     * Sub verarbeiten
     */
    handleSub(username, tier, months) {
        const timeToAdd = this.getTimeForTier(tier);
        
        if (this.onSubCallback) {
            this.onSubCallback({
                type: 'sub',
                username: username,
                tier: tier,
                months: months,
                timeAdded: timeToAdd
            });
        }
    }
    
    /**
     * Gift Sub verarbeiten
     */
    handleGiftSub(gifter, recipient, tier) {
        const timeToAdd = this.config.timePerGiftSub * (tier === 2 ? 2 : tier === 3 ? 5 : 1);
        
        if (this.onSubCallback) {
            this.onSubCallback({
                type: 'giftsub',
                username: gifter,
                recipient: recipient,
                tier: tier,
                timeAdded: timeToAdd
            });
        }
    }
    
    /**
     * Bits verarbeiten
     */
    handleBits(username, bits) {
        if (this.config.timePerBits <= 0 || bits < this.config.bitsThreshold) return;
        
        // Zeit pro 100 Bits
        const timeToAdd = Math.floor(bits / 100) * this.config.timePerBits;
        
        if (timeToAdd > 0 && this.onSubCallback) {
            this.onSubCallback({
                type: 'bits',
                username: username,
                bits: bits,
                timeAdded: timeToAdd
            });
        }
    }
    
    /**
     * Callback setzen
     */
    onSub(callback) {
        this.onSubCallback = callback;
    }
    
    /**
     * Config aktualisieren
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('⚙️ Config aktualisiert:', this.config);
    }
}

// Global instance
let twitchIntegration;
