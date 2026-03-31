/* ============================================================
   HABLA PANA! 🇻🇪 — MOTOR SENIOR FULL-STACK (v6.0 PRO)
   Anti-Eco Signal System & Mutual Match Engine
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, onDisconnect, remove, off } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCJwudpTsjQbQ7g72-3L4O4W8XKE8ojZNM",
  authDomain: "habla-pana.firebaseapp.com",
  databaseURL: "https://habla-pana-default-rtdb.firebaseio.com",
  projectId: "habla-pana"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const TRIVIA_SET = [
    { q: "¿En qué estado está el Salto Ángel?", a: "Bolívar", o: ["Amazonas", "Bolívar", "Zulia", "Lara"] },
    { q: "¿Qué ingrediente define a la Reina Pepiada?", a: "Aguacate y Pollo", o: ["Mechada", "Aguacate y Pollo", "Caraotas", "Pernil"] },
    { q: "¿Ave nacional de Venezuela?", a: "Turpial", o: ["Cardenal", "Turpial", "Zamuro", "Coleo"] },
    { q: "¿Pico más alto del país?", a: "Pico Bolívar", o: ["Pico Espejo", "Naiguatá", "Pico Bolívar", "Águila"] },
    { q: "¿Ciudad de los Caballeros?", a: "Mérida", o: ["Trujillo", "Mérida", "Valencia", "Coro"] },
    { q: "¿Cómo se llama el dulce de leche de Coro?", a: "Dulce de Leche", o: ["Manjar", "Dulce de Leche", "Arequipe", "Arroz con Leche"] }
];

const HanaPana = {
    // --- ESTADO GLOBAL ---
    peer: null, currentCall: null, localStream: null, 
    points: 100, nick: '', state: '', ig: '', myPeerId: '', 
    partnerData: null, isMicOn: true, isCamOn: true,
    processedSignalIds: new Set(), // Para evitar duplicidad de mensajes (Eco Fix)

    // --- INICIALIZACIÓN ---
    async init() {
        const nickInput = document.getElementById('nick-input');
        const igInput = document.getElementById('ig-input');
        const stateSelect = document.getElementById('state-select');
        const captchaInput = document.getElementById('captcha-input');

        const nameParts = nickInput.value.trim().split(' ');
        if (nameParts.length < 2) return alert("❌ ¡EPALE! Pon nombre y apellido real.");
        if (!igInput.value.includes('@')) return alert("❌ Danos tu Instagram real (con @).");
        if (captchaInput.value.toLowerCase().trim() !== "diablo") return alert("❌ Refrán errado.");

        this.nick = nickInput.value.trim();
        this.ig = igInput.value.trim();
        this.state = stateSelect.value || "Venezuela";

        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480, frameRate: 24 }, 
                audio: true 
            });
            document.getElementById('local-video').srcObject = this.localStream;
            
            this.setupChatMobile();

            document.getElementById('screen-auth').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('screen-auth').classList.add('hidden');
                document.getElementById('screen-chat').classList.remove('hidden');
                this.setupPeer();
            }, 500);
        } catch (e) { alert("❌ ¡Habilita la cámara, pana!"); }
    },

    // --- CHAT ROBUSTO (MÓVIL) ---
    setupChatMobile() {
        const input = document.getElementById('chat-input');
        const btn = document.getElementById('btn-chat-send');
        
        const handleSend = () => {
            const text = input.value.trim();
            if (text) {
                this.sendSignal('chat', { text });
                input.value = '';
                input.focus();
            }
        };

        btn.onclick = (e) => { e.preventDefault(); handleSend(); };
        input.onkeypress = (e) => { if (e.key === 'Enter') handleSend(); };
    },

    // --- TRIVIA ENGINE ---
    shotTrivia() {
        const overlay = document.getElementById('searching-overlay');
        if (overlay.classList.contains('hidden')) return;
        
        const qData = TRIVIA_SET[Math.floor(Math.random() * TRIVIA_SET.length)];
        document.getElementById('trivia-q').innerText = qData.q;
        const optBox = document.getElementById('trivia-options');
        optBox.innerHTML = '';
        
        qData.o.forEach(opt => {
            const b = document.createElement('button');
            b.className = "trivia-option-btn";
            b.innerText = opt;
            b.onclick = () => {
                if (opt === qData.a) {
                    b.classList.add("correct");
                    this.points += 5;
                    setTimeout(() => this.shotTrivia(), 800);
                } else {
                    b.classList.add("wrong");
                    setTimeout(() => this.shotTrivia(), 800);
                }
                this.updatePointsUI();
            };
            optBox.appendChild(b);
        });
    },

    // --- MATCH MUTUO & SEÑALES (FIX ECO) ---
    async sendMatchSignal(type) {
        if (!this.partnerData) return;
        this.sendSignal('interest', { type });
        const sessionPath = [this.myPeerId, this.partnerData.id].sort().join('_');
        await set(ref(db, `session_matches/${sessionPath}/${this.myPeerId}`), type);
        this.appendMsg("SISTEMA", `Enviando ${type === 'heart' ? '❤️' : '⚽'}...`, 'sys');
    },

    listenToSignals() {
        const signalRef = ref(db, `signals/${this.myPeerId}`);
        
        // Limpiamos listener previo para evitar multiplicidad (Eco Fix)
        off(signalRef);
        
        onValue(signalRef, (snap) => {
            const signals = snap.val();
            if (signals) {
                Object.keys(signals).forEach(sid => {
                    // Si ya procesamos este ID único de señal, lo ignoramos
                    if (this.processedSignalIds.has(sid)) return;
                    this.processedSignalIds.add(sid);

                    const data = signals[sid];
                    if (data.type === 'interest') {
                        const icon = data.type === 'heart' ? '❤️' : '⚽';
                        this.appendMsg("SISTEMA", `¡A ${data.nick} le gustas! Dale ${icon}`, 'sys');
                    } else if (data.type === 'chat') {
                        this.appendMsg(data.nick, data.text, 'hero');
                    }
                });
                remove(signalRef).catch(() => {}); // Limpiar de DB
            }
        });

        // Mutuo Match Listener
        if (this.partnerData) {
            const sPath = [this.myPeerId, this.partnerData.id].sort().join('_');
            const sRef = ref(db, `session_matches/${sPath}`);
            off(sRef);
            onValue(sRef, (snap) => {
                const votes = snap.val();
                if (votes && Object.keys(votes).length === 2) {
                    const vals = Object.values(votes);
                    if (vals[0] === vals[1]) {
                        this.triggerMutualMatch(vals[0]);
                        remove(sRef).catch(() => {});
                    }
                }
            });
        }
    },

    triggerMutualMatch(type) {
        const overlay = document.getElementById(`mutual-match-${type}`);
        const prompt = document.getElementById('match-prompt');
        const igVal = document.getElementById('ig-val');
        
        overlay.classList.remove('hidden');
        setTimeout(() => {
            overlay.classList.add('hidden');
            igVal.innerText = this.partnerData.ig;
            prompt.classList.remove('hidden');
            this.appendMsg("LOGRADO", "¡MATCH REAL! IG Revelado.", 'sys');
        }, 2800);
    },

    async sendSignal(type, data) {
        if (!this.partnerData) return;
        const msgId = Date.now().toString() + Math.random().toString(16).substr(2, 4);
        const sRef = ref(db, `signals/${this.partnerData.id}/${msgId}`);
        await set(sRef, { type, ...data, nick: this.nick, timestamp: Date.now() });
        if (type === 'chat') this.appendMsg("TÚ", data.text, 'me');
    },

    // --- PEERJS MOTOR PRO ---
    setupPeer() {
        const rid = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
        this.myPeerId = `hp-${rid}`;
        this.peer = new Peer(this.myPeerId);
        
        this.peer.on('open', () => { 
            this.next(); 
        });
        this.peer.on('call', (call) => {
            if (this.currentCall) this.currentCall.close();
            call.answer(this.localStream);
            this.handleCall(call);
        });
    },

    async next() {
        if (this.currentCall) this.currentCall.close();
        this.processedSignalIds.clear(); // Reset eco fix en cada pana nuevo
        this.showSearching(true);
        this.shotTrivia();
        
        const lobbyRef = ref(db, 'waiting_v6');
        const snap = await get(lobbyRef);
        const waiters = snap.val();

        if (waiters) {
            const others = Object.keys(waiters).filter(id => id !== this.myPeerId);
            if (others.length > 0) {
                const targetId = others[0];
                this.partnerData = waiters[targetId];
                const call = this.peer.call(targetId, this.localStream);
                if (call) {
                    await remove(ref(db, `waiting_v6/${targetId}`));
                    this.handleCall(call);
                    return;
                }
            }
        }

        const myLobbyRef = ref(db, `waiting_v6/${this.myPeerId}`);
        await set(myLobbyRef, { id: this.myPeerId, nick: this.nick, state: this.state, ig: this.ig });
        onDisconnect(myLobbyRef).remove();
    },

    handleCall(call) {
        this.currentCall = call;
        this.showSearching(false);
        document.getElementById('match-prompt').classList.add('hidden');
        this.listenToSignals();
        
        call.on('stream', (st) => {
            document.getElementById('remote-video').srcObject = st;
            document.getElementById('partner-nick').innerText = this.partnerData ? this.partnerData.nick : "PANA NUEVO";
            document.getElementById('partner-state').innerText = (this.partnerData ? this.partnerData.state : "---").toUpperCase();
        });
        call.on('close', () => { this.next(); });
    },

    // --- CONTROLES MUTE ---
    toggleMic() {
        this.isMicOn = !this.isMicOn;
        this.localStream.getAudioTracks()[0].enabled = this.isMicOn;
        const btn = document.getElementById('btn-mic-toggle');
        btn.innerHTML = this.isMicOn ? '🎤' : '🔇';
        btn.classList.toggle('btn-off', !this.isMicOn);
    },

    toggleCam() {
        this.isCamOn = !this.isCamOn;
        this.localStream.getVideoTracks()[0].enabled = this.isCamOn;
        const btn = document.getElementById('btn-cam-toggle');
        btn.innerHTML = this.isCamOn ? '🎥' : '❌';
        btn.classList.toggle('btn-off', !this.isCamOn);
    },

    appendMsg(nick, text, type) {
        const box = document.getElementById('chat-scroller');
        const d = document.createElement('div');
        d.className = "border-b border-gray-100 py-2";
        d.innerHTML = `<span class="font-bold text-red-600 text-[14px]">${nick}:</span> <span class="font-napkin text-[16px]">${text}</span>`;
        box.appendChild(d);
        box.scrollTop = box.scrollHeight;
    },

    updatePointsUI() { 
        document.getElementById('pana-points').innerText = this.points + " PTS"; 
    },
    showSearching(s) { 
        document.getElementById('searching-overlay').classList.toggle('hidden', !s);
    }
};

window.HanaPana = HanaPana;
