<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sistema Solar Controlado por Mão</title>
    <style>
        body { margin: 0; overflow: hidden; background: #000; font-family: sans-serif; }
        
        /* Interface de Usuário */
        #ui { 
            position: absolute; top: 50%; left: 50%; 
            transform: translate(-50%, -50%); 
            text-align: center; color: white; z-index: 20; 
        }
        
        button { 
            padding: 15px 40px; font-size: 20px; cursor: pointer; 
            background: #00ffcc; border: none; border-radius: 50px; 
            font-weight: bold; text-transform: uppercase;
            box-shadow: 0 0 20px rgba(0,255,204,0.5);
        }

        /* Container do Vídeo e Canvas (Espelhado) */
        #container { 
            position: absolute; bottom: 20px; right: 20px; 
            width: 320px; height: 240px;
            border: 3px solid #333; border-radius: 15px; 
            overflow: hidden; background: #111;
        }

        /* Importante: Ambos espelhados para a mira funcionar intuitivamente */
        #video-input, #output-canvas { 
            position: absolute; top: 0; left: 0; 
            width: 100%; height: 100%; 
            transform: scaleX(-1); /* Espelhamento */
            object-fit: cover;
        }
    </style>
</head>
<body>

    <div id="ui">
        <h1>Sistema Solar Interativo</h1>
        <p>Aponte o indicador para um planeta e aguarde para dar Zoom</p>
        <button id="start-btn">INICIAR SISTEMA</button>
    </div>

    <div id="container">
        <video id="video-input" autoplay playsinline></video>
        <canvas id="output-canvas"></canvas>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"></script>

    <script>
        // --- 1. CONFIGURAÇÃO DA CENA 3D ---
        const scene = new THREE.Scene();
        // Fundo estrelado simples
        const loader = new THREE.TextureLoader();
        scene.background = new THREE.Color(0x050505);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        // Luzes
        const sunLight = new THREE.PointLight(0xffffff, 2, 300);
        scene.add(sunLight);
        scene.add(new THREE.AmbientLight(0x404040));

        // Criar Planetas
        const planets = [];
        const createPlanet = (size, color, x, name) => {
            const geo = new THREE.SphereGeometry(size, 32, 32);
            const mat = new THREE.MeshStandardMaterial({ 
                color: color, 
                emissive: color, 
                emissiveIntensity: 0.2 
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, 0, 0);
            mesh.name = name;
            scene.add(mesh);
            planets.push(mesh);
        };

        createPlanet(4, 0xffcc00, 0, "Sol");       // Centro
        createPlanet(1.2, 0x00aaff, 12, "Terra");  // Direita
        createPlanet(1, 0xff4400, -12, "Marte");   // Esquerda

        camera.position.set(0, 5, 30);
        camera.lookAt(0, 0, 0);

        // --- 2. CONFIGURAÇÃO MEDIAPIPE E MIRA ---
        const videoElement = document.getElementById('video-input');
        const canvasElement = document.getElementById('output-canvas');
        const canvasCtx = canvasElement.getContext('2d');
        const raycaster = new THREE.Raycaster();
        
        let hoveredObj = null;
        let timer = 0;
        const TIMER_MAX = 60; // Duração para ativar zoom (aprox 1-2 seg)

        const hands = new Hands({locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`});
        
        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.6
        });

        hands.onResults((results) => {
            // Limpa o canvas 2D
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                const marks = results.multiHandLandmarks[0];
                const indexTip = marks[8]; // Ponta do indicador

                // Desenha esqueleto
                drawConnectors(canvasCtx, marks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
                
                // Coordenadas para desenho 2D (Mira)
                const x = indexTip.x * canvasElement.width;
                const y = indexTip.y * canvasElement.height;

                // --- RAYCASTING (Lógica de Seleção) ---
                // Transforma coord 2D da mão em vetor 3D
                // Importante: (x * 2 - 1) para X e Inverso para Y
                const mouse3D = new THREE.Vector2(
                    (indexTip.x * 2 - 1), 
                    -(indexTip.y * 2 - 1)
                );

                raycaster.setFromCamera(mouse3D, camera);
                const intersects = raycaster.intersectObjects(planets);

                // Lógica de Estado
                if (intersects.length > 0) {
                    const obj = intersects[0].object;
                    
                    if (hoveredObj === obj) {
                        timer++;
                        // ZOOM ATIVADO
                        if (timer >= TIMER_MAX) {
                            const target = new THREE.Vector3().copy(obj.position);
                            target.z += 6; // Distância do zoom
                            target.y += 2;
                            camera.position.lerp(target, 0.05);
                            camera.lookAt(obj.position);
                        }
                    } else {
                        hoveredObj = obj;
                        timer = 0;
                    }
                } else {
                    hoveredObj = null;
                    timer = 0;
                    // Reset Suave da Câmera
                    camera.position.lerp(new THREE.Vector3(0, 5, 30), 0.05);
                    camera.lookAt(0, 0, 0);
                }

                // --- DESENHO DA MIRA UI ---
                canvasCtx.beginPath();
                canvasCtx.lineWidth = 4;
                canvasCtx.strokeStyle = hoveredObj ? '#FF0000' : '#00FFFF'; // Vermelho se focado, Ciano normal
                canvasCtx.arc(x, y, 15, 0, 2 * Math.PI);
                canvasCtx.stroke();

                // Barra de Progresso Circular
                if (hoveredObj) {
                    canvasCtx.beginPath();
                    canvasCtx.strokeStyle = 'white';
                    canvasCtx.arc(x, y, 20, 0, (timer / TIMER_MAX) * 2 * Math.PI);
                    canvasCtx.stroke();
                }
            }
        });

        // --- 3. INICIALIZAÇÃO ---
        const startBtn = document.getElementById('start-btn');
        const ui = document.getElementById('ui');

        const cam = new Camera(videoElement, {
            onFrame: async () => { await hands.send({image: videoElement}); },
            width: 320, height: 240
        });

        startBtn.onclick = () => {
            ui.style.display = 'none';
            cam.start().then(() => {
                // Sincronizar tamanho do canvas com o vídeo real
                canvasElement.width = videoElement.videoWidth;
                canvasElement.height = videoElement.videoHeight;
            });
        };

        // Loop de Animação 3D
        function animate() {
            requestAnimationFrame(animate);
            // Rotação leve dos planetas
            planets.forEach(p => p.rotation.y += 0.005);
            renderer.render(scene, camera);
        }
        animate();

        // Ajuste de Janela
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    </script>
</body>
</html>
