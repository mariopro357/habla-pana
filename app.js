/* ============================================================
   HABLA, PANA! 🇻🇪 — MOTOR CRIOLLO P2P (v3.0 - Serverless)
   Reconstrucción Total - 100% Vercel Ready
   ============================================================ */

const REFRANES = [
    { p: "Más sabe el diablo por viejo que por...", r: "diablo" },
    { p: "Árbol que nace torcido, jamás su tronco...", r: "endereza" },
    { p: "Camarón que se duerme, se lo lleva la...", r: "corriente" },
    { p: "Hijo de gato, caza...", r: "ratón" },
    { p: "Perro que ladra, no...", r: "muerde" },
    { p: "Guerra avisada no mata...", r: "soldado" },
    { p: "Chivo que se devuelve se...", r: "esnuca" }
];

const App = {
    // --- Estado ---
    user: { nick: '', state: '', pts: 100, id: 'pana_' + Math.random().toString(36).substr(2, 9) },
    localStream: null,
    pc: null,
    client: null,
    partnerId: null,
    isLooking: false,
    currentCaptcha: null,

    // --- Init & UI ---
    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(`screen-${id}`).classList.add('active');
    },

    async startSetup() {
        const nick = document.getElementById('nick-input').value.trim();
        const state = document.getElementById('state-input').value;

        if (!nick || !state) return alert("¡Epa! Pon tus datos primero, pana.");

        this.user.nick = nick;
        this.user.state = state;

        // Pedir Cámara
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            this.showLocalPreview();
        } catch(e) {
            return alert("❌ ¡ACTIVA LA CÁMARA! Si no, ¿cómo te ven los panas?");
        }

        // Generar Captcha
        this.currentCaptcha = REFRANES[Math.floor(Math.random() * REFRANES.length)];
        document.getElementById('captcha-phrase').innerText = `"${this.currentCaptcha.p}"`;
        this.showScreen('captcha');
    },

    showLocalPreview() {
        const container = document.getElementById('local-container');
        container.innerHTML = '';
        const video = document.createElement('video');
        video.srcObject = this.localStream;
        video.autoplay = video.playsInline = video.muted = true;
        video.style.transform = "scaleX(-1)";
        container.appendChild(video);
        document.getElementById('mirror-nick').innerText = this.user.nick.toUpperCase();
        document.getElementById('mirror-loc').innerText = this.user.state.toUpperCase();
    },

    validateCaptcha() {
        const val = document.getElementById('captcha-input').value.toLowerCase().trim();
        if (val.includes(this.currentCaptcha.r)) {
            this.initP2P();
        } else {
            alert("¡Nawara! Te falta calle. Ese no es el refrán.");
        }
    },

    // --- MQTT Matchmaking (Signaling) ---
    initP2P() {
        this.showScreen('hud');
        this.addMsg("⚙️ Conectando al Barrio...", true);

        // HiveMQ Public Broker (Seguro vía WebSockets)
        this.client = new Paho.MQTT.Client("broker.hivemq.com", Number(8000), this.user.id);
        
        this.client.onConnectionLost = (e) => {
            console.warn("Lobby perdido", e);
            this.addMsg("⚠️ Conexión inestable", true);
        };

        this.client.onMessageArrived = (msg) => {
            this.onSignal(JSON.parse(msg.payloadString));
        };

        this.client.connect({
            onSuccess: () => {
                this.client.subscribe(`hablapana/user/${this.user.id}`);
                this.client.subscribe(`hablapana/lobby`); // Canal de escucha general
                this.addMsg("✅ ¡Estás en la calle! Buscando pana...", true);
                this.joinQueue();
            },
            useSSL: false
        });
    },

    joinQueue() {
        if (this.partnerId) return;
        this.isLooking = true;
        // Gritar al lobby que busco alguien
        const msg = new Paho.MQTT.Message(JSON.stringify({
            type: 'ping',
            from: this.user.id,
            nick: this.user.nick,
            state: this.user.state
        }));
        msg.destinationName = "hablapana/lobby";
        this.client.send(msg);
    },

    onSignal(data) {
        if (data.from === this.user.id) return; // Ignorarme

        // 1. Alguien grita ping y yo busco
        if (data.type === 'ping' && this.isLooking) {
            this.isLooking = false;
            this.partnerId = data.from;
            this.startConnection(true); // Yo inicio (Offer)
            return;
        }

        // 2. Señales directas
        if (data.target && data.target !== this.user.id) return;

        switch(data.type) {
            case 'offer': this.handleOffer(data); break;
            case 'answer': this.handleAnswer(data); break;
            case 'candidate': this.handleCandidate(data); break;
            case 'chat': this.appendMsg(data.nick, data.text, 'hero'); break;
        }
    },

    sendSignal(type, payload) {
        const msg = new Paho.MQTT.Message(JSON.stringify({
            type, ...payload, target: this.partnerId, from: this.user.id
        }));
        msg.destinationName = `hablapana/user/${this.partnerId}`;
        this.client.send(msg);
    },

    // --- WebRTC Logic ---
    async startConnection(isInitiator) {
        this.pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        this.localStream.getTracks().forEach(t => this.pc.addTrack(t, this.localStream));

        this.pc.ontrack = (e) => {
            const container = document.getElementById('remote-container');
            container.innerHTML = '';
            const video = document.createElement('video');
            video.srcObject = e.streams[0];
            video.autoplay = video.playsInline = true;
            container.appendChild(video);
            this.addMsg("🚀 ¡PANA CONECTADO!");
        };

        this.pc.onicecandidate = (e) => {
            if (e.candidate) this.sendSignal('candidate', { candidate: e.candidate });
        };

        if (isInitiator) {
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);
            this.sendSignal('offer', { sdp: offer });
        }
    },

    async handleOffer(data) {
        this.partnerId = data.from;
        this.isLooking = false;
        await this.startConnection(false);
        await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.sendSignal('answer', { sdp: answer });
    },

    async handleAnswer(data) {
        await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    },

    async handleCandidate(data) {
        await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    },

    // --- Acciones HUD ---
    next() {
        if (this.pc) this.pc.close();
        this.pc = null;
        this.partnerId = null;
        document.getElementById('remote-container').innerHTML = '<p class="placeholder-txt">BUSCANDO PANA...</p>';
        this.addMsg("🚌 Saltaste a otro bus...", true);
        this.joinQueue();
    },

    sendChatMsg() {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text || !this.partnerId) return;

        this.appendMsg("TÚ", text, 'me');
        this.sendSignal('chat', { text, nick: this.user.nick });
        input.value = '';
    },

    addMsg(text, isSys = false) {
        this.appendMsg("SISTEMA", text, isSys ? 'sys' : 'hero');
    },

    appendMsg(nick, text, type) {
        const box = document.getElementById('chat-scroller');
        const p = document.createElement('p');
        p.className = `msg ${type}`;
        p.innerText = (type === 'sys' ? '' : nick + ": ") + text;
        box.appendChild(p);
        box.scrollTop = box.scrollHeight;
    },

    fuchi() {
        alert("¡REPORTADO POR FUCO! Ganas 0 puntos.");
        this.next();
    }
};

// Auto-crecimiento de puntos
setInterval(() => {
    App.user.pts += 1;
    const el = document.getElementById('points-val');
    if (el) el.innerText = App.user.pts;
}, 30000);
