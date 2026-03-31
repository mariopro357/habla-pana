/* ============================================================
   HABLA PANA! 🇻🇪 — MOTOR SENIOR FULL-STACK (v7.0)
   The Handshake Edition - No More Signal Loss
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
    { q: "¿Pico más alto?", a: "Pico Bolívar", o: ["Pico Espejo", "Pico Bolívar", "Naiguatá"] },
    { q: "¿Ciudad de los Caballeros?", a: "Mérida", o: ["Coro", "Mérida", "Valencia"] }
];

const HanaPana = {
    // --- ESTADO GLOBAL ---
    peer: null, currentCall: null, localStream: null, 
    points: 100, nick: '', state: '', ig: '', myPeerId: '', 
    partnerData: null, isMicOn: true, isCamOn: true,
    processedSignalIds: new Set(),
    sessionRef: null,

    // --- INICIALIZACIÓN ---
    async init() {
        const nickInput = document.getElementById('nick-input');
        const igInput = document.getElementById('ig-input');
        const stateSelect = document.getElementById('state-select');
        const captchaInput = document.getElementById('captcha-input');

        if (nickInput.value.trim().split(' ').length < 2) return alert("❌ Pon nombre y apellido real.");
        if (!igInput.value.includes('@')) return alert("❌ Pon tu @ de Instagram real.");
        if (captchaInput.value.toLowerCase().trim() !== "diablo") return alert("❌ Refrán errado.");

        this.nick = nickInput.value.trim();
        this.ig = igInput.value.trim();
        this.state = stateSelect.value || "Venezuela";

        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 480, height: 640 }, 
                audio: true 
            });
            document.getElementById('local-video').srcObject = this.localStream;
            
            this.setupChatEvents();

            document.getElementById('screen-auth').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('screen-auth').classList.add('hidden');
                document.getElementById('screen-chat').classList.remove('hidden');
                this.setupPeer();
            }, 500);
        } catch (e) { alert("❌ Activa la cámara para entrar."); }
    },

    // --- CHAT TÁCTIL & EVENTOS ---
    setupChatEvents() {
        const input = document.getElementById('chat-input');
        const btn = document.getElementById('btn-chat-send');
        
        const send = () => {
            const txt = input.value.trim();
            if (txt) { this.sendSignal('chat', { text: txt }); input.value = ''; }
        };

        btn.onclick = (e) => { e.preventDefault(); send(); };
        input.onkeypress = (e) => { if (e.key === 'Enter') send(); };
    },

    toggleChat() {
        const napkin = document.getElementById('chat-napkin');
        napkin.classList.toggle('chat-open');
    },

    // --- TRIVIA MOTOR ---
    shotTrivia() {
        const ov = document.getElementById('searching-overlay');
        if (ov.classList.contains('hidden')) return;
        
        const q = TRIVIA_SET[Math.floor(Math.random() * TRIVIA_SET.length)];
        document.getElementById('trivia-q').innerText = q.q;
        const opts = document.getElementById('trivia-options');
        opts.innerHTML = '';
        
        q.o.forEach(o => {
            const b = document.createElement('button');
            b.className = "trivia-option-btn";
            b.innerText = o;
            b.onclick = () => {
                if (o === q.a) { b.classList.add("correct"); this.points += 5; setTimeout(() => this.shotTrivia(), 800); }
                else { b.classList.add("wrong"); setTimeout(() => this.shotTrivia(), 800); }
                this.updateUI();
            };
            opts.appendChild(b);
        });
    },

    // --- EL HANDSHAKE (LA CLAVE v7.0) 🤝 ---
    async startHandshake(partnerId) {
        // Generar ID de sesión único para ambos
        const sId = [this.myPeerId, partnerId].sort().join('_');
        const sPath = ref(db, `active_sessions/${sId}/${this.myPeerId}`);
        
        // Enviamos nuestra identidad al nodo de sesión
        await set(sPath, { id: this.myPeerId, nick: this.nick, ig: this.ig, state: this.state });
        
        // Escuchamos la identidad del otro en el mismo nodo
        const otherPath = ref(db, `active_sessions/${sId}/${partnerId}`);
        onValue(otherPath, (snap) => {
            const data = snap.val();
            if (data && !this.partnerData) {
                this.partnerData = data;
                document.getElementById('partner-nick').innerText = data.nick;
                document.getElementById('partner-state').innerText = data.state.toUpperCase();
                this.listenToSignals(); // Ahora que tenemos partnerID, escuchamos señales
                this.appendMsg("SISTEMA", `¡Conectado con ${data.nick}!`, 'sys');
            }
        });

        // Limpiar sesión al desconectar
        onDisconnect(sPath).remove();
    },

    // --- SEÑALES & MATCH MUTUO ---
    async sendSignal(type, data) {
        if (!this.partnerData) return;
        const msgId = Date.now().toString() + Math.random().toString(16).substr(2,4);
        const sRef = ref(db, `signals/${this.partnerData.id}/${msgId}`);
        await set(sRef, { type, ...data, nick: this.nick, timestamp: Date.now() });
        if (type === 'chat') this.appendMsg("TÚ", data.text);
    },

    async sendMatchSignal(v) {
        if (!this.partnerData) return;
        const sId = [this.myPeerId, this.partnerData.id].sort().join('_');
        await set(ref(db, `matches/${sId}/${this.myPeerId}`), v);
        this.sendSignal('interest', { v });
        this.appendMsg("SISTEMA", `Enviando ${v === 'heart' ? '❤️' : '⚽'}...`);
    },

    listenToSignals() {
        if (!this.partnerData) return;
        
        // Señales directas
        const sigRef = ref(db, `signals/${this.myPeerId}`);
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
        const sId = [this.myPeerId, this.partnerData.id].sort().join('_');
        const mRef = ref(db, `matches/${sId}`);
        off(mRef);
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
        }, 2500);
    },

    // --- MOTOR PEERJS v7.0 ---
    setupPeer() {
        const id = `hp-${Math.floor(Math.random()*99999).toString().padStart(5,'0')}`;
        this.myPeerId = id;
        this.peer = new Peer(id);
        this.peer.on('open', () => this.next());
        this.peer.on('call', (call) => {
            if (this.currentCall) this.currentCall.close();
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
        
        const lobby = ref(db, 'waiting_v7');
        const snap = await get(lobby);
        const waiters = snap.val();

        if (waiters) {
            const others = Object.keys(waiters).filter(i => i !== this.myPeerId);
            if (others.length > 0) {
                const tid = others[0];
                const call = this.peer.call(tid, this.localStream);
                if (call) {
                    await remove(ref(db, `waiting_v7/${tid}`));
                    this.handleCall(call, tid);
                    return;
                }
            }
        }

        const myRef = ref(db, `waiting_v7/${this.myPeerId}`);
        await set(myRef, { id: this.myPeerId });
        onDisconnect(myRef).remove();
    },

    handleCall(call, tid) {
        this.currentCall = call;
        this.showSearching(false);
        document.getElementById('match-prompt').classList.add('hidden');
        
        // IMPORTANTE: Handshake
        // Si yo llamé, tid es el ID. Si me llamaron, PeerJS lo tiene en call.peer
        const remotePeerId = tid || call.peer;
        this.startHandshake(remotePeerId);

        call.on('stream', (s) => {
            document.getElementById('remote-video').srcObject = s;
            document.getElementById('partner-nick').innerText = "CONECTANDO...";
        });
        call.on('close', () => this.next());
    },

    // --- CONTROLES & UI ---
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
        const sc = document.getElementById('chat-scroller');
        const d = document.createElement('div');
        d.innerHTML = `<b class="text-red-600 text-xs">${n}:</b> <span class="font-napkin">${t}</span>`;
        sc.appendChild(d);
        sc.scrollTop = sc.scrollHeight;
    },
    updateUI() { document.getElementById('pana-points').innerText = `${this.points} PT`; },
    showSearching(s) { document.getElementById('searching-overlay').classList.toggle('hidden', !s); },
    report() { if(confirm("¿Reportar?")) this.next(); }
};

window.HanaPana = HanaPana;
document.addEventListener('DOMContentLoaded', () => {
    // Evitar que el zoom de iOS moleste
    document.addEventListener('gesturestart', (e) => e.preventDefault());
});
