/* ============================================================
   HABLA PANA! 🇻🇪 — MOTOR SENIOR FULL-STACK (v10.0 SEGURIDAD)
   AI Safety Engine & Emoji Injection
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
    { q: "¿En qué estado está el Salto Ángel?", a: "Bolívar", o: ["Bolívar", "Lara", "Amazonas"] },
    { q: "¿Qué define a la Reina Pepiada?", a: "Aguacate y Pollo", o: ["Mechada", "Aguacate y Pollo", "Caraotas"] },
    { q: "¿Ave nacional?", a: "Turpial", o: ["Turpial", "Cardenal", "Tucán"] },
    { q: "¿Significado de 'Chamo'?", a: "Muchacho", o: ["Muchacho", "Amigo", "Pan"] }
];

const HanaPana = {
    // --- ESTADO GLOBAL ---
    peer: null, currentCall: null, localStream: null, 
    points: 100, nick: '', state: '', ig: '', myPeerId: '', 
    partnerData: null, isMicOn: true, isCamOn: true,
    processedSignalIds: new Set(),
    nsfwModel: null, safetyStrikes: 0,

    // --- INICIALIZACIÓN ---
    async init() {
        const nickInput = document.getElementById('nick-input');
        const igInput = document.getElementById('ig-input');
        
        if (nickInput.value.trim().split(' ').length < 2) return this.showToast("❌ Nombre y apellido real, Pana.");
        if (!igInput.value.includes('@')) return this.showToast("❌ Necesitamos tu Instagram real (@).");
        if (!document.getElementById('captcha-input').value.trim()) return this.showToast("❌ Responde la pregunta de seguridad.");

        this.nick = nickInput.value.trim();
        this.ig = igInput.value.trim();
        this.state = document.getElementById('state-select').value || "Venezuela";

        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480 }, 
                audio: true 
            });
            document.getElementById('local-video').srcObject = this.localStream;
            
            this.setupDualChat();
            this.loadSafetyModel();

            document.getElementById('screen-auth').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('screen-auth').classList.add('hidden');
                document.getElementById('screen-chat').classList.remove('hidden');
                this.setupPeer();
            }, 500);
        } catch (e) { this.showToast("❌ Activa la cámara para entrar."); }
    },

    // --- SEGURIDAD IA (NSFW) ---
    async loadSafetyModel() {
        try {
            this.nsfwModel = await nsfwjs.load();
            console.log("🛡️ Seguridad Criolla: Modelo IA Cargado.");
            this.startSafetyEngine();
        } catch (e) { console.warn("Falló carga de IA, operando sin escudo."); }
    },

    startSafetyEngine() {
        setInterval(async () => {
            if (!this.partnerData || !this.nsfwModel) return;
            const video = document.getElementById('remote-video');
            if (video.readyState < 2) return;

            const predictions = await this.nsfwModel.classify(video);
            const top = predictions[0];

            if (top.className === 'Porn' || top.className === 'Hentai' || (top.className === 'Sexy' && top.probability > 0.8)) {
                this.safetyStrikes++;
                this.showToast(`⚠️ ¡Epa! Gente Seria, ${this.partnerData.nick}. Te tenemos en la mira.`, "error");
                if (this.safetyStrikes >= 3) {
                    this.showToast("🚫 EXPULSADO POR INTENSO.", "error");
                    this.next();
                }
            }
        }, 5000); // Escáner silencioso cada 5 segundos
    },

    // --- EMOJIS & CHAT ---
    setupDualChat() {
        const p = ['mobile', 'side'];
        p.forEach(id => {
            const input = document.getElementById(`${id}-chat-input`);
            const btn = document.getElementById(`btn-${id}-chat-send`);
            if (!input || !btn) return;
            const send = () => {
                const txt = input.value.trim();
                if (txt) { this.sendSignal('chat', { text: txt }); input.value = ''; }
            };
            btn.onclick = send;
            input.onkeypress = (e) => { if (e.key === 'Enter') send(); };
        });
    },

    addEmoji(char, target) {
        const input = document.getElementById(`${target}-chat-input`);
        if (input) {
            input.value += char;
            input.focus();
        }
    },

    toggleChat() {
        if (window.innerWidth < 1024) {
            document.getElementById('mobile-chat-overlay').classList.toggle('hidden');
        } else {
            document.getElementById('side-chat-input').focus();
        }
    },

    // --- SIGNALS & LOGIC ---
    showToast(msg, type = "info") {
        const center = document.getElementById('toast-center');
        const toast = document.createElement('div');
        toast.className = `toast-msg glass-premium px-6 py-4 rounded-3xl text-sm font-bold shadow-2xl border border-white/10 ${type === 'error' ? 'bg-red-600/30 text-red-100' : 'bg-white/10'}`;
        toast.innerText = msg;
        center.appendChild(toast);
        setTimeout(() => toast.remove(), 4500);
    },

    async startHandshake(remoteId) {
        const sId = [this.myPeerId, remoteId].sort().join('_');
        const myPath = ref(db, `v10_sessions/${sId}/${this.myPeerId}`);
        await set(myPath, { id: this.myPeerId, nick: this.nick, ig: this.ig, state: this.state });
        
        onValue(ref(db, `v10_sessions/${sId}/${remoteId}`), (snap) => {
            const data = snap.val();
            if (data && !this.partnerData) {
                this.partnerData = data;
                this.safetyStrikes = 0;
                document.getElementById('partner-nick').innerText = data.nick;
                document.getElementById('partner-state').innerText = data.state.toUpperCase();
                this.listenToSignals();
                this.shotTrivia(); 
                this.showToast(`🤝 Conectado con ${data.nick}`);
            }
        });
        onDisconnect(myPath).remove();
    },

    async sendSignal(type, data) {
        if (!this.partnerData) return;
        const msgId = `m-${Date.now()}`;
        const sRef = ref(db, `v10_signals/${this.partnerData.id}/${msgId}`);
        await set(sRef, { type, ...data, nick: this.nick });
        if (type === 'chat') this.appendMsg("TÚ", data.text);
    },

    async sendMatchSignal(v) {
        if (!this.partnerData) return;
        const sId = [this.myPeerId, this.partnerData.id].sort().join('_');
        await set(ref(db, `v10_matches/${sId}/${this.myPeerId}`), v);
        this.sendSignal('interest', { v });
        this.showToast(`Enviando ${v === 'heart' ? '❤️' : '⚽'}...`);
    },

    listenToSignals() {
        const sigRef = ref(db, `v10_signals/${this.myPeerId}`);
        off(sigRef);
        onValue(sigRef, (snap) => {
            const msgs = snap.val();
            if (msgs) {
                Object.keys(msgs).forEach(mid => {
                    if (this.processedSignalIds.has(mid)) return;
                    this.processedSignalIds.add(mid);
                    const d = msgs[mid];
                    if (d.type === 'interest') this.showToast(`🔥 ¡A ${d.nick} le gustas!`, "match");
                    else if (d.type === 'chat') this.appendMsg(d.nick, d.text);
                });
                remove(sigRef);
            }
        });

        const mRef = ref(db, `v10_matches/${[this.myPeerId, this.partnerData.id].sort().join('_')}`);
        onValue(mRef, (snap) => {
            const v = snap.val();
            if (v && Object.keys(v).length === 2) {
                const vals = Object.values(v);
                if (vals[0] === vals[1]) {
                    this.triggerMatch(vals[0]);
                    remove(mRef);
                }
            }
        });
    },

    triggerMatch(t) {
        const ov = document.getElementById(`mutual-match-${t}`);
        const pr = document.getElementById('match-prompt');
        this.showToast("✨ MATCH MUTUO ⚡", "match");
        ov.classList.remove('hidden');
        setTimeout(() => {
            ov.classList.add('hidden');
            document.getElementById('ig-val').innerText = this.partnerData.ig;
            pr.classList.remove('hidden');
        }, 3000);
    },

    // --- PEER & FLOW ---
    setupPeer() {
        this.myPeerId = `hp-${Math.floor(Math.random()*99999)}`;
        this.peer = new Peer(this.myPeerId);
        this.peer.on('open', () => this.next());
        this.peer.on('call', (c) => {
            c.answer(this.localStream);
            this.handleCall(c, false);
        });
    },

    async next() {
        if (this.currentCall) this.currentCall.close();
        this.partnerData = null;
        this.safetyStrikes = 0;
        this.processedSignalIds.clear();
        this.showSearching(true);
        this.shotTrivia(); 

        const lobby = ref(db, 'waiting_v10');
        const snap = await get(lobby);
        const waiters = snap.val();

        if (waiters) {
            const others = Object.keys(waiters).filter(i => i !== this.myPeerId);
            if (others.length > 0) {
                const tid = others[0];
                const call = this.peer.call(tid, this.localStream);
                if (call) {
                    await remove(ref(db, `waiting_v10/${tid}`));
                    this.handleCall(call, tid);
                    return;
                }
            }
        }

        const myRef = ref(db, `waiting_v10/${this.myPeerId}`);
        await set(myRef, { id: this.myPeerId });
        onDisconnect(myRef).remove();
    },

    handleCall(call, tid) {
        this.currentCall = call;
        this.showSearching(false);
        document.getElementById('match-prompt').classList.add('hidden');
        this.startHandshake(tid || call.peer);

        call.on('stream', (s) => {
            const v = document.getElementById('remote-video');
            v.srcObject = s;
            v.onloadedmetadata = () => v.play().catch(()=>{});
        });
        call.on('close', () => this.next());
    },

    // --- GAME ---
    shotTrivia() {
        const isSearching = !document.getElementById('searching-overlay').classList.contains('hidden');
        const qElem = document.getElementById(isSearching ? 'trivia-q' : 'side-trivia-q');
        const optElem = document.getElementById(isSearching ? 'trivia-options' : 'side-trivia-options');
        if (!qElem) return;
        const q = TRIVIA_SET[Math.floor(Math.random() * TRIVIA_SET.length)];
        qElem.innerText = q.q;
        optElem.innerHTML = '';
        q.o.forEach(o => {
            const b = document.createElement('button');
            b.className = "trivia-option-btn"; b.innerText = o;
            b.onclick = () => {
                if (o === q.a) { b.classList.add("correct"); this.points += 5; this.updateUI(); setTimeout(() => this.shotTrivia(), 800); }
                else { b.classList.add("wrong"); setTimeout(() => this.shotTrivia(), 800); }
            };
            optElem.appendChild(b);
        });
    },

    // --- TACTILE & UI ---
    toggleMic() { this.isMicOn = !this.isMicOn; this.localStream.getAudioTracks()[0].enabled = this.isMicOn; document.getElementById('btn-mic-toggle').classList.toggle('btn-off', !this.isMicOn); },
    toggleCam() { this.isCamOn = !this.isCamOn; this.localStream.getVideoTracks()[0].enabled = this.isCamOn; document.getElementById('btn-cam-toggle').classList.toggle('btn-off', !this.isCamOn); },
    appendMsg(n, t) {
        const slots = ['mobile-chat-scroller', 'side-chat-scroller'];
        slots.forEach(id => {
            const sc = document.getElementById(id);
            if (!sc) return;
            const d = document.createElement('p');
            d.innerHTML = `<b class="${n==='TÚ'?'text-blue-500':'text-red-600'}">${n}:</b> <span>${t}</span>`;
            sc.appendChild(d);
            sc.scrollTop = sc.scrollHeight;
        });
    },
    updateUI() { document.getElementById('pana-points').innerText = this.points; },
    showSearching(s) { document.getElementById('searching-overlay').classList.toggle('hidden', !s); }
};

window.HanaPana = HanaPana;
document.addEventListener('gesturestart', (e) => e.preventDefault());
