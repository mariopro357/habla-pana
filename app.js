/* ============================================================
   HABLA PANA! 🇻🇪 — MOTOR SENIOR FULL-STACK (v4.5)
   Firebase + PeerJS Cloud Edition - Matchmaking Real
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getDatabase, ref, set, get, update, onValue, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCJwudpTsjQbQ7g72-3L4O4W8XKE8ojZNM",
  authDomain: "habla-pana.firebaseapp.com",
  databaseURL: "https://habla-pana-default-rtdb.firebaseio.com",
  projectId: "habla-pana",
  storageBucket: "habla-pana.firebasestorage.app",
  messagingSenderId: "41300827635",
  appId: "1:41300827635:web:c4b7711f37633bb5f98686",
  measurementId: "G-26ZYWWSZCP"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

const HanaPana = {
    // --- ESTADO GLOBAL ---
    peer: null,
    currentCall: null,
    localStream: null,
    points: 100,
    nick: '',
    state: '',
    myPeerId: '',
    isMuted: false,
    isVideoOff: false,
    isSearching: false,
    
    // --- INICIALIZACIÓN ---
    async init() {
        const nickInput = document.getElementById('nick-input');
        const stateSelect = document.getElementById('state-select');
        const captchaInput = document.getElementById('captcha-input');

        if (!nickInput.value.trim()) return alert("¡Epa! No seas pichirre, pon un nickname.");
        if (!stateSelect.value) return alert("¿De dónde eres, chamo? Selecciona un estado.");
        if (captchaInput.value.toLowerCase().trim() !== "diablo") {
            return alert("❌ Nawara... te falta calle. Ese no es el refrán.");
        }

        this.nick = nickInput.value.trim();
        this.state = stateSelect.value;

        // Pedir Permisos
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 1280, height: 720 }, 
                audio: true 
            });
            document.getElementById('local-video').srcObject = this.localStream;
            
            // Cargar Puntos desde Firebase/Local
            await this.loadPoints();

            // Cambiar Pantalla
            document.getElementById('screen-auth').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('screen-auth').classList.add('hidden');
                document.getElementById('screen-chat').classList.remove('hidden');
                this.setupPeer();
            }, 500);

        } catch (err) {
            console.error(err);
            alert("❌ ¡PANA! Activa la cámara y el micro arriba en el candadito 🔒 para poder entrar.");
        }
    },

    // --- CONFIGURACIÓN PEERJS ---
    setupPeer() {
        const randomId = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
        this.myPeerId = `hablapana-${randomId}`;
        
        this.peer = new Peer(this.myPeerId);
        document.getElementById('my-peer-id').innerText = `ID: ${this.myPeerId.toUpperCase()}`;

        this.peer.on('open', (id) => {
            console.log('Mi ID de Pana es:', id);
            this.next(); // Buscar automáticamente al entrar
        });

        this.peer.on('call', (call) => {
            if (this.currentCall) this.currentCall.close();
            call.answer(this.localStream);
            this.handleCall(call);
        });

        this.peer.on('error', (err) => {
            if (err.type === 'unavailable-id') this.setupPeer();
        });
    },

    handleCall(call) {
        this.currentCall = call;
        this.showSearching(false);
        this.isSearching = false;

        call.on('stream', (remoteStream) => {
            const remoteVideo = document.getElementById('remote-video');
            remoteVideo.srcObject = remoteStream;
            remoteVideo.play();
            
            // Info básica (En producción se pasaría por metadata)
            document.getElementById('partner-nick').innerText = "PANA ACTIVADO";
            document.getElementById('partner-state').innerText = "CONECTADO ⚡";
        });

        call.on('close', () => {
             // Limpiar al colgar
             this.addPoints(1);
             this.next();
        });
    },

    // --- MATCHMAKING CON FIREBASE (EL MOTOR REAL) ---
    async next() {
        this.isSearching = true;
        if (this.currentCall) this.currentCall.close();
        
        this.showSearching(true);
        document.getElementById('remote-video').srcObject = null;

        // 1. Quitarse de cualquier sala anterior por si acaso
        const lobbyRef = ref(db, 'waiting_room');
        const myLobbyRef = ref(db, `waiting_room/${this.myPeerId}`);
        
        // 2. Buscar a alguien en la sala de espera
        const snapshot = await get(lobbyRef);
        const waiters = snapshot.val();

        if (waiters) {
            // Filtrar para no llamarse a uno mismo
            const others = Object.keys(waiters).filter(id => id !== this.myPeerId);
            if (others.length > 0) {
                const targetId = others[0];
                console.log("Conectando con pana...", targetId);
                
                // Intentar conectarse
                const call = this.peer.call(targetId, this.localStream);
                if (call) {
                    // Si logramos conectar, eliminamos al otro de la sala
                    await remove(ref(db, `waiting_room/${targetId}`));
                    this.handleCall(call);
                    return;
                }
            }
        }

        // 3. Si no hay nadie, anotarse en la sala y esperar
        console.log("Nadie disponible. Esperando en el lobby...");
        await set(myLobbyRef, {
            nick: this.nick,
            state: this.state,
            timestamp: Date.now()
        });

        // Asegurar limpieza automática al desconectarse
        onDisconnect(myLobbyRef).remove();
    },

    // --- PANA POINTS EN LA NUBE ---
    async loadPoints() {
        const local = localStorage.getItem('hablapana_pts');
        const dbRef = ref(db, `users/${this.nick}/points`);
        
        try {
            const snapshot = await get(dbRef);
            if (snapshot.exists()) {
                this.points = snapshot.val();
            } else {
                this.points = local ? parseInt(local) : 100;
                await set(dbRef, this.points);
            }
            this.updatePointsUI();
        } catch(e) {
            this.points = local ? parseInt(local) : 100;
        }
    },

    async savePoints() {
        localStorage.setItem('hablapana_pts', this.points);
        try {
            await set(ref(db, `users/${this.nick}/points`), this.points);
        } catch(e) {}
        this.updatePointsUI();
        this.checkBlock();
    },

    addPoints(val) {
        this.points += val;
        this.savePoints();
    },

    report() {
        if (!confirm("¿Seguro que este pana es un intenso? Le bajaremos la mecha.")) return;
        this.points -= 20;
        this.savePoints();
        alert("🤮 ¡REPORTE ENVIADO! Te descontamos 20 PanaPoints.");
        this.next();
    },

    updatePointsUI() {
        const el = document.getElementById('pana-points');
        if (el) el.innerText = this.points;
    },

    checkBlock() {
        if (this.points <= 0) {
            document.getElementById('block-screen').classList.remove('hidden');
            if (this.localStream) {
                this.localStream.getTracks().forEach(t => t.stop());
            }
        }
    },

    // --- CONTROLES ---
    toggleAudio() {
        this.isMuted = !this.isMuted;
        if (this.localStream) {
            this.localStream.getAudioTracks()[0].enabled = !this.isMuted;
            document.getElementById('btn-mic').innerHTML = this.isMuted ? '🔇' : '🎤';
            document.getElementById('btn-mic').classList.toggle('bg-red-500/20');
        }
    },

    showSearching(show) {
        const overlay = document.getElementById('searching-overlay');
        if (!overlay) return;
        overlay.style.opacity = show ? '1' : '0';
        overlay.style.pointerEvents = show ? 'auto' : 'none';
        if (show) overlay.classList.remove('hidden');
        else setTimeout(() => overlay.classList.add('hidden'), 500);
    }
};

// EXPORTAR A GLOBAL (Para que funcionen los onclick del HTML)
window.HanaPana = HanaPana;

// Evento inicial
document.addEventListener('DOMContentLoaded', () => {
    const catchaInput = document.getElementById('captcha-input');
    if (catchaInput) {
        catchaInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') HanaPana.init();
        });
    }
});
