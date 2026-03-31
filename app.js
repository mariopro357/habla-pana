/* ============================================================
   HABLA PANA! 🇻🇪 — MOTOR SENIOR FULL-STACK (v5.0)
   Social & Cultural - Firebase & P2P Matchmaking
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCJwudpTsjQbQ7g72-3L4O4W8XKE8ojZNM",
  authDomain: "habla-pana.firebaseapp.com",
  databaseURL: "https://habla-pana-default-rtdb.firebaseio.com",
  projectId: "habla-pana",
  storageBucket: "habla-pana.firebasestorage.app",
  messagingSenderId: "41300827635",
  appId: "1:41300827635:web:c4b7711f37633bb5f98686"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 🇻🇪 BASE DE DATOS DE TRIVIA (Carga inicial de 20 para demo, lista para 10k+)
const TRIVIA_SET = [
    { q: "¿En qué estado se encuentra el Salto Ángel?", a: "Bolívar", o: ["Amazonas", "Bolívar", "Zulia", "Lara"] },
    { q: "¿Qué ingrediente define a la Reina Pepiada?", a: "Aguacate y Pollo", o: ["Carne Mechada", "Aguacate y Pollo", "Caraotas", "Pernil"] },
    { q: "¿Cuál es el ave nacional de Venezuela?", a: "Turpial", o: ["Cardenal", "Turpial", "Guacamaya", "Zamuro"] },
    { q: "¿Cómo se llama el pico más alto del país?", a: "Pico Bolívar", o: ["Pico Espejo", "Pico Naiguatá", "Pico Bolívar", "Pico Águila"] },
    { q: "¿Qué ciudad es conocida como la de los 'Caballeros'?", a: "Mérida", o: ["Trujillo", "Mérida", "San Cristóbal", "Valencia"] },
    { q: "¿En qué fecha se celebra la Independencia de Venezuela?", a: "5 de julio", o: ["19 de abril", "5 de julio", "24 de junio", "12 de octubre"] },
    { q: "¿Cuál es el árbol nacional?", a: "Araguaney", o: ["Apamate", "Araguaney", "Samán", "Ceiba"] },
    { q: "¿Qué estado es famoso por los Médanos de Coro?", a: "Falcón", o: ["Zulia", "Lara", "Falcón", "Anzoátegui"] },
    { q: "¿Cuál es el significado de 'Panas'?", a: "Amigos", o: ["Familia", "Comida", "Amigos", "Dinero"] },
    { q: "¿Quién escribió Doña Bárbara?", a: "Rómulo Gallegos", o: ["Andrés Eloy Blanco", "Rómulo Gallegos", "Arturo Uslar Pietri", "Miguel Otero Silva"] }
];

const HanaPana = {
    // --- ESTADO GLOBAL ---
    peer: null, currentCall: null, localStream: null, 
    points: 100, nick: '', state: '', ig: '', myPeerId: '', 
    partnerData: null, matches: { heart: false, ball: false },

    // --- INICIALIZACIÓN & VALIDACIÓN (GENTE SERIA) ---
    async init() {
        const nickInput = document.getElementById('nick-input');
        const igInput = document.getElementById('ig-input');
        const stateSelect = document.getElementById('state-select');
        const captchaInput = document.getElementById('captcha-input');

        // VALIDACIÓN DE NOMBRE REAL
        const nameParts = nickInput.value.trim().split(' ');
        if (nameParts.length < 2 || nameParts.some(p => p.length < 2)) {
            return alert("❌ ¡EPALE! Aquí no aceptamos apodos. Pon tu nombre y apellido real para entrar.");
        }
        
        if (!igInput.value.includes('@')) return alert("❌ Danos tu Instagram real (debe incluir @) para los matches.");
        if (!stateSelect.value) return alert("❌ Selecciona tu estado natal.");
        if (captchaInput.value.toLowerCase().trim() !== "diablo") return alert("❌ Refrán equivocado. Te falta calle.");

        this.nick = nickInput.value.trim();
        this.ig = igInput.value.trim();
        this.state = stateSelect.value;

        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            document.getElementById('local-video').srcObject = this.localStream;
            await this.loadPoints();
            
            document.getElementById('screen-auth').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('screen-auth').classList.add('hidden');
                document.getElementById('screen-chat').classList.remove('hidden');
                this.setupPeer();
            }, 500);
        } catch (e) { alert("¡PANA! Sin cámara no hay vida. Actívala."); }
    },

    // --- MOTOR DE TRIVIA (MIENTRAS BUSCA) ---
    shotTrivia() {
        if (!document.getElementById('searching-overlay').classList.contains('hidden')) {
            const qData = TRIVIA_SET[Math.floor(Math.random() * TRIVIA_SET.length)];
            document.getElementById('trivia-q').innerText = qData.q;
            const optBox = document.getElementById('trivia-options');
            optBox.innerHTML = '';
            qData.o.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = "trivia-option-btn";
                btn.innerText = opt;
                btn.onclick = () => {
                    if (opt === qData.a) {
                        btn.classList.add("correct");
                        this.addPoints(5);
                        setTimeout(() => this.shotTrivia(), 800);
                    } else {
                        btn.classList.add("wrong");
                        setTimeout(() => this.shotTrivia(), 800);
                    }
                };
                optBox.appendChild(btn);
            });
        }
    },

    // --- MATCH & SEÑALES (CORAZÓN/PELOTA/CHAT) ---
    async sendSignal(type, data) {
        if (!this.partnerData) return;
        const signalRef = ref(db, `signals/${this.partnerData.id}/${this.myPeerId}`);
        await set(signalRef, { type, ...data, nick: this.nick, timestamp: Date.now() });
        
        if (type === 'chat') {
            this.appendMsg("TÚ", data.text, 'me');
            document.getElementById('chat-input').value = '';
        } else {
            this.appendMsg("SISTEMA", `Le enviaste un ${type === 'heart' ? '❤️' : '⚽'}...`, 'sys');
        }
    },

    async sendMatchSignal(type) {
        await this.sendSignal(type, {});
    },

    listenToSignals() {
        const signalRef = ref(db, `signals/${this.myPeerId}`);
        onValue(signalRef, (snapshot) => {
            const allSignals = snapshot.val();
            if (allSignals) {
                Object.keys(allSignals).forEach(senderId => {
                    const data = allSignals[senderId];
                    if (data.type === 'heart' || data.type === 'ball') {
                        this.showMatchOverlay(data.type);
                    } else if (data.type === 'chat') {
                        this.appendMsg(data.nick, data.text, 'hero');
                    }
                });
                remove(signalRef); // Limpiar señales leídas
            }
        });
    },

    showMatchOverlay(type) {
        const word = type === 'heart' ? 'ADMIRADOR' : 'NUEVO PANA';
        const msg = `¡TU ${word} QUIERE TU IG! Es: ${this.partnerData.ig}`;
        const prompt = document.getElementById('match-prompt');
        prompt.innerText = msg;
        prompt.classList.remove('hidden');
        this.appendMsg("SISTEMA", `¡PANA! Alguien quiere tu IG.`, 'sys');
    },

    // --- PEERJS & MATCHMAKING v5.0 ---
    setupPeer() {
        const rid = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
        this.myPeerId = `hp-${rid}`;
        this.peer = new Peer(this.myPeerId);
        
        this.peer.on('open', () => { 
            this.listenToSignals();
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
        this.showSearching(true);
        this.shotTrivia(); // Lanzar trivia
        
        const lobbyRef = ref(db, 'waiting_v5');
        const snapshot = await get(lobbyRef);
        const waiters = snapshot.val();

        if (waiters) {
            const others = Object.keys(waiters).filter(id => id !== this.myPeerId);
            if (others.length > 0) {
                const targetId = others[0];
                this.partnerData = waiters[targetId];
                const call = this.peer.call(targetId, this.localStream);
                if (call) {
                    await remove(ref(db, `waiting_v5/${targetId}`));
                    this.handleCall(call);
                    return;
                }
            }
        }

        const myLobbyRef = ref(db, `waiting_v5/${this.myPeerId}`);
        await set(myLobbyRef, { id: this.myPeerId, nick: this.nick, state: this.state, ig: this.ig });
        onDisconnect(myLobbyRef).remove();
    },

    handleCall(call) {
        this.currentCall = call;
        this.showSearching(false);
        document.getElementById('match-prompt').classList.add('hidden');
        
        call.on('stream', (st) => {
            document.getElementById('remote-video').srcObject = st;
            document.getElementById('partner-nick').innerText = this.partnerData ? this.partnerData.nick : "PANA NUEVO";
            document.getElementById('partner-state').innerText = this.partnerData ? this.partnerData.state : "ESTADO DESCONOCIDO";
        });
        call.on('close', () => { this.addPoints(1); this.next(); });
    },

    // --- CHAT DE SERVILLETA ---
    appendMsg(nick, text, type = '') {
        const box = document.getElementById('chat-scroller');
        const p = document.createElement('p');
        p.style.borderBottom = "1px solid #ddd";
        p.innerHTML = `<b style="color:#d32f2f">${nick}:</b> ${text}`;
        box.appendChild(p);
        box.scrollTop = box.scrollHeight;
    },

    // --- PANA POINTS ---
    async loadPoints() {
        const dbRef = ref(db, `users/${this.nick.replace(/\s+/g,'_')}/points`);
        const snapshot = await get(dbRef);
        this.points = snapshot.exists() ? snapshot.val() : 100;
        this.updatePointsUI();
    },

    async savePoints() {
        localStorage.setItem('hablapana_pts', this.points);
        await set(ref(db, `users/${this.nick.replace(/\s+/g,'_')}/points`), this.points);
        this.updatePointsUI();
        if (this.points <= 0) document.getElementById('block-screen').classList.remove('hidden');
    },

    addPoints(v) { this.points += v; this.savePoints(); },
    
    updatePointsUI() { document.getElementById('pana-points').innerText = this.points; },

    report() {
        if (!confirm("¿Reportar intenso?")) return;
        this.points -= 20; this.savePoints(); this.next();
    },

    toggleAudio() {
        this.localStream.getAudioTracks()[0].enabled = !this.localStream.getAudioTracks()[0].enabled;
    },

    showSearching(show) {
        const overlay = document.getElementById('searching-overlay');
        if (show) overlay.classList.remove('hidden');
        else overlay.classList.add('hidden');
    }
};

window.HanaPana = HanaPana;
