/* ============================================================
   HABLA PANA! 🇻🇪 — MOTOR SENIOR FULL-STACK (v4.0)
   PeerJS Edition - Serverless & High Performance
   ============================================================ */

const HanaPana = {
    // --- ESTADO GLOBAL ---
    peer: null,
    currentCall: null,
    localStream: null,
    points: 100,
    nick: '',
    state: '',
    isMuted: false,
    isVideoOff: false,
    
    // --- INICIALIZACIÓN (PASO 2) ---
    async init() {
        const nickInput = document.getElementById('nick-input');
        const stateSelect = document.getElementById('state-select');
        const captchaInput = document.getElementById('captcha-input');

        // Validaciones Criollas
        if (!nickInput.value.trim()) return alert("¡Epa! No seas pichirre, pon un nickname.");
        if (!stateSelect.value) return alert("¿De dónde eres, chamo? Selecciona un estado.");
        if (captchaInput.value.toLowerCase().trim() !== "diablo") {
            return alert("❌ Nawara... te falta calle. Ese no es el refrán.");
        }

        // Guardar Datos
        this.nick = nickInput.value.trim();
        this.state = stateSelect.value;
        this.loadPoints();

        // Solicitar Permisos
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 1280, height: 720 }, 
                audio: true 
            });
            document.getElementById('local-video').srcObject = this.localStream;
            
            // Cambiar de Pantalla
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

    // --- CONFIGURACIÓN PEERJS (PASO 4) ---
    setupPeer() {
        // Generar un ID con prefijo para el "matchmaking"
        const randomId = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
        const myPeerId = `hablapana-${randomId}`;
        
        this.peer = new Peer(myPeerId);
        document.getElementById('my-peer-id').innerText = `ID: ${myPeerId.toUpperCase()}`;

        this.peer.on('open', (id) => {
            console.log('Mi ID de Pana es:', id);
            this.next(); // Buscar automáticamente al entrar
        });

        // Al recibir una llamada
        this.peer.on('call', (call) => {
            if (this.currentCall) this.currentCall.close();
            
            call.answer(this.localStream);
            this.handleCall(call);
        });

        this.peer.on('error', (err) => {
            console.error('PeerJS Error:', err.type);
            if (err.type === 'unavailable-id') this.setupPeer(); // Reintentar si el ID existe
        });
    },

    handleCall(call) {
        this.currentCall = call;
        this.showSearching(false);

        call.on('stream', (remoteStream) => {
            const remoteVideo = document.getElementById('remote-video');
            remoteVideo.srcObject = remoteStream;
            remoteVideo.play();
            
            // Simular datos del pana (En una versión Pro, estos vienen en el metadata de la llamada)
            document.getElementById('partner-nick').innerText = "PANA " + Math.floor(Math.random() * 100);
            document.getElementById('partner-state').innerText = "CONECTADO ⚡";
        });

        call.on('close', () => {
            this.addPoints(1); // Ganar 1 punto por terminar una charla bien
            this.next();
        });
    },

    // --- LÓGICA DE BÚSQUEDA (PASO 4) ---
    async next() {
        if (this.currentCall) this.currentCall.close();
        this.showSearching(true);
        
        document.getElementById('remote-video').srcObject = null;
        document.getElementById('partner-nick').innerText = "BUSCANDO...";
        document.getElementById('partner-state').innerText = "---";

        // Simulación de "Matchmaking" Aleatorio
        // PeerJS no tiene "listPeers", así que probaremos llamar a IDs aleatorios con nuestro prefijo
        // En producción se usaría un servidor de señalización (Signaling) más avanzado.
        setTimeout(() => {
            const targetId = `hablapana-${Math.floor(Math.random() * 99999).toString().padStart(5, '0')}`;
            const call = this.peer.call(targetId, this.localStream);
            
            if (call) {
                this.handleCall(call);
            } else {
                this.next(); // Reintentar si no contestan
            }
        }, 3000);
    },

    // --- PANA POINTS & REPUTACIÓN (PASO 5) ---
    loadPoints() {
        const stored = localStorage.getItem('hablapana_pts');
        this.points = stored ? parseInt(stored) : 100;
        this.updatePointsUI();
        this.checkBlock();
    },

    addPoints(val) {
        this.points += val;
        this.savePoints();
    },

    savePoints() {
        localStorage.setItem('hablapana_pts', this.points);
        this.updatePointsUI();
        this.checkBlock();
    },

    report() {
        if (!confirm("¿Seguro que este pana es un intenso? Le bajaremos la mecha.")) return;
        
        this.points -= 20;
        this.savePoints();
        alert("🤮 ¡REPORTE ENVIADO! Te descontamos 20 PanaPoints por andar con gente así.");
        this.next();
    },

    updatePointsUI() {
        document.getElementById('pana-points').innerText = this.points;
    },

    checkBlock() {
        if (this.points <= 0) {
            document.getElementById('block-screen').classList.remove('hidden');
            if (this.localStream) {
                this.localStream.getTracks().forEach(t => t.stop());
            }
        }
    },

    // --- CONTROLES (PASO 3) ---
    toggleAudio() {
        this.isMuted = !this.isMuted;
        this.localStream.getAudioTracks()[0].enabled = !this.isMuted;
        document.getElementById('btn-mic').innerHTML = this.isMuted ? '🔇' : '🎤';
        document.getElementById('btn-mic').classList.toggle('bg-red-500/20');
    },

    showSearching(show) {
        const overlay = document.getElementById('searching-overlay');
        overlay.style.opacity = show ? '1' : '0';
        overlay.style.pointerEvents = show ? 'auto' : 'none';
        
        if (show) overlay.classList.remove('hidden');
        else setTimeout(() => overlay.classList.add('hidden'), 500);
    }
};

// Configuración inicial de UI al cargar
window.onload = () => {
    // Escuchar el enter en el captcha para más rapidez
    document.getElementById('captcha-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') HanaPana.init();
    });
};
