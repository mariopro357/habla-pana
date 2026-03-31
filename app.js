/* ============================================================
   HABLA PANA! 🇻🇪 — MOTOR SENIOR FULL-STACK (v8.0 PREMIUM)
   Unified Game Center & Split Layout Engine
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
    { q: "¿En qué estado está el Salto Ángel?", a: "Bolívar", o: ["Amazonas", "Bolívar", "Lara"] },
    { q: "¿Qué define a la Reina Pepiada?", a: "Aguacate y Pollo", o: ["Mechada", "Aguacate y Pollo", "Caraotas"] },
    { q: "¿Ave nacional?", a: "Turpial", o: ["Cardenal", "Turpial", "Zamuro"] },
    { q: "¿Pico más alto?", a: "Pico Bolívar", o: ["Pico Bolívar", "Naiguatá", "Humboldt"] },
    { q: "¿Ciudad de El Resuelve?", a: "Caracas", o: ["Valencia", "Caracas", "Maracaibo"] },
    { q: "¿Significado de 'Pana'?", a: "Amigo", o: ["Amigo", "Pan", "Ropa"] }
];

const HanaPana = {
    // --- ESTADO GLOBAL ---
    peer: null, currentCall: null, localStream: null, 
    points: 100, nick: '', state: '', ig: '', myPeerId: '', 
    partnerData: null, isMicOn: true, isCamOn: true,
    processedSignalIds: new Set(),

    // --- INICIALIZACIÓN ---
    async init() {
        const nickInput = document.getElementById('nick-input');
        const igInput = document.getElementById('ig-input');
        
        if (nickInput.value.trim().split(' ').length < 2) return alert("❌ Nombre y apellido real, pana.");
        if (!igInput.value.includes('@')) return alert("❌ Danos tu Instagram real (@).");

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

            document.getElementById('screen-auth').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('screen-auth').classList.add('hidden');
                document.getElementById('screen-chat').classList.remove('hidden');
                this.setupPeer();
            }, 500);
        } catch (e) { alert("❌ Habilita la cámara."); }
    },

    // --- CHAT DUAL (SIDEBAR / OVERLAY) ---
    setupDualChat() {
        const ids = ['mobile', 'side'];
        ids.forEach(prefix => {
            const input = document.getElementById(`${prefix}-chat-input`);
            const btn = document.getElementById(`btn-${prefix}-chat-send`);
            if (!input || !btn) return;

            const send = () => {
                const txt = input.value.trim();
                if (txt) { this.sendSignal('chat', { text: txt }); input.value = ''; }
            };
            btn.onclick = send;
            input.onkeypress = (e) => { if (e.key === 'Enter') send(); };
        });
    },

    toggleChat() {
        const isMobile = window.innerWidth < 1024;
        if (isMobile) {
            const overlay = document.getElementById('mobile-chat-overlay');
            overlay.classList.toggle('hidden');
        } else {
            // En desktop, simplemente enfocamos el input de la barra lateral
            document.getElementById('side-chat-input').focus();
        }
    },

    // --- GAME CENTER (TRIVIA v8.0) ---
    shotTrivia() {
        const isSearching = !document.getElementById('searching-overlay').classList.contains('hidden');
        
        // Determinar qué caja de trivia usar (Sidebar o Overlay)
        const suffix = isSearching ? 'q' : 'side-trivia-q'; 
        const optSuffix = isSearching ? 'options' : 'side-trivia-options';
        
        const qElem = document.getElementById(isSearching ? 'trivia-q' : 'side-trivia-q');
        const optElem = document.getElementById(isSearching ? 'trivia-options' : 'side-trivia-options');
        
        if (!qElem) return; // Si no estamos en modo búsqueda y no hay sidebar (móvil)

        const q = TRIVIA_SET[Math.floor(Math.random() * TRIVIA_SET.length)];
        qElem.innerText = q.q;
        optElem.innerHTML = '';
        
        q.o.forEach(o => {
            const b = document.createElement('button');
            b.className = "trivia-option-btn";
            b.innerText = o;
            b.onclick = () => {
                if (o === q.a) { 
                    b.classList.add("correct"); 
                    this.points += 5; 
                    this.updatePointsUI();
                    setTimeout(() => this.shotTrivia(), 1000); 
                } else { 
                    b.classList.add("wrong"); 
                    setTimeout(() => this.shotTrivia(), 1000); 
                }
            };
            optElem.appendChild(b);
        });
    },

    // --- HANDSHAKE v7.0 & SIGNALS ---
    async startHandshake(remoteId) {
        const sId = [this.myPeerId, remoteId].sort().join('_');
        const myPath = ref(db, `v8_sessions/${sId}/${this.myPeerId}`);
        await set(myPath, { id: this.myPeerId, nick: this.nick, ig: this.ig, state: this.state });
        
        onValue(ref(db, `v8_sessions/${sId}/${remoteId}`), (snap) => {
            const data = snap.val();
            if (data && !this.partnerData) {
                this.partnerData = data;
                document.getElementById('partner-nick').innerText = data.nick;
                document.getElementById('partner-state').innerText = data.state.toUpperCase();
                this.listenToSignals();
                this.shotTrivia(); // Lanzar trivia en el Sidebar al conectar (si es laptop)
            }
        });
        onDisconnect(myPath).remove();
    },

    async sendSignal(type, data) {
        if (!this.partnerData) return;
        const msgId = `m-${Date.now()}-${Math.random().toString(16).substr(2,4)}`;
        const sRef = ref(db, `v8_signals/${this.partnerData.id}/${msgId}`);
        await set(sRef, { type, ...data, nick: this.nick, timestamp: Date.now() });
        if (type === 'chat') this.appendMsg("TÚ", data.text);
    },

    async sendMatchSignal(v) {
        if (!this.partnerData) return;
        const sId = [this.myPeerId, this.partnerData.id].sort().join('_');
        await set(ref(db, `v8_matches/${sId}/${this.myPeerId}`), v);
        this.sendSignal('interest', { v });
        this.appendMsg("SISTEMA", `Enviando ${v === 'heart' ? '❤️' : '⚽'}...`);
    },

    listenToSignals() {
        const sigRef = ref(db, `v8_signals/${this.myPeerId}`);
        off(sigRef);
        onValue(sigRef, (snap) => {
            const msgs = snap.val();
            if (msgs) {
                Object.keys(msgs).forEach(mid => {
                    if (this.processedSignalIds.has(mid)) return;
                    this.processedSignalIds.add(mid);
                    const d = msgs[mid];
                    if (d.type === 'interest') this.appendMsg("SISTEMA", `¡A ${d.nick} le gustas! Dale Match ❤️`);
                    else if (d.type === 'chat') this.appendMsg(d.nick, d.text);
                });
                remove(sigRef);
            }
        });

        // Match Mutuo
        const mRef = ref(db, `v8_matches/${[this.myPeerId, this.partnerData.id].sort().join('_')}`);
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
        ov.classList.remove('hidden');
        setTimeout(() => {
            ov.classList.add('hidden');
            document.getElementById('ig-val').innerText = this.partnerData.ig;
            pr.classList.remove('hidden');
        }, 2800);
    },

    // --- PEERJS & MOTOR ---
    setupPeer() {
        this.myPeerId = `hp-${Math.floor(Math.random()*99999).toString().padStart(5,'0')}`;
        this.peer = new Peer(this.myPeerId);
        this.peer.on('open', () => this.next());
        this.peer.on('call', (call) => {
            call.answer(this.localStream);
            this.handleCall(call, false);
        });
    },

    async next() {
        if (this.currentCall) this.currentCall.close();
        this.partnerData = null;
        this.processedSignalIds.clear();
        this.showSearching(true);
        this.shotTrivia(); 

        const lobby = ref(db, 'waiting_v8');
        const snap = await get(lobby);
        const waiters = snap.val();

        if (waiters) {
            const others = Object.keys(waiters).filter(i => i !== this.myPeerId);
            if (others.length > 0) {
                const tid = others[0];
                const call = this.peer.call(tid, this.localStream);
                if (call) {
                    await remove(ref(db, `waiting_v8/${tid}`));
                    this.handleCall(call, tid);
                    return;
                }
            }
        }

        const myRef = ref(db, `waiting_v8/${this.myPeerId}`);
        await set(myRef, { id: this.myPeerId });
        onDisconnect(myRef).remove();
    },

    handleCall(call, tid) {
        this.currentCall = call;
        this.showSearching(false);
        document.getElementById('match-prompt').classList.add('hidden');
        this.startHandshake(tid || call.peer);

        call.on('stream', (s) => {
            const video = document.getElementById('remote-video');
            video.srcObject = s;
            video.onloadedmetadata = () => video.play();
        });
        call.on('close', () => this.next());
    },

    // --- UI HELPERS ---
    toggleMic() {
        this.isMicOn = !this.isMicOn;
        this.localStream.getAudioTracks()[0].enabled = this.isMicOn;
        document.getElementById('btn-mic-toggle').classList.toggle('btn-off', !this.isMicOn);
    },
    toggleCam() {
        this.isCamOn = !this.isCamOn;
        this.localStream.getVideoTracks()[0].enabled = this.isCamOn;
        document.getElementById('btn-cam-toggle').classList.toggle('btn-off', !this.isCamOn);
    },
    appendMsg(n, t) {
        const scrollers = ['mobile-chat-scroller', 'side-chat-scroller'];
        scrollers.forEach(id => {
            const sc = document.getElementById(id);
            if (!sc) return;
            const d = document.createElement('p');
            d.innerHTML = `<b class="${n==='TÚ'?'text-blue-500':'text-red-600'}">${n}:</b> <span>${t}</span>`;
            sc.appendChild(d);
            sc.scrollTop = sc.scrollHeight;
        });
    },
    updatePointsUI() { document.getElementById('pana-points').innerText = this.points; },
    showSearching(s) { document.getElementById('searching-overlay').classList.toggle('hidden', !s); },
    report() { if(confirm("¿Reportar intenso?")) this.next(); }
};

window.HanaPana = HanaPana;
