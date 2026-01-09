const videoElement = document.getElementById('video-input');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const startBtn = document.getElementById('start-btn');
const ui = document.getElementById('ui');

// --- 1. CONFIGURAÇÃO SCENE 3D ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const light = new THREE.PointLight(0xffffff, 5, 100);
light.position.set(0, 0, 10);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040, 2));

const planets = [];
const raycaster = new THREE.Raycaster();
let hoveredObject = null;
let selectionTimer = 0;
const SELECTION_THRESHOLD = 90; 

const createPlanet = (size, color, dist, name) => {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(size, 32, 32), 
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2 })
    );
    mesh.position.set(dist, 0, 0);
    mesh.name = name;
    scene.add(mesh);
    planets.push(mesh);
    return mesh;
};

// Criar Sol e Planetas
createPlanet(3, 0xffcc00, 0, "Sol");
createPlanet(1, 0x00aaff, 10, "Terra");
createPlanet(1.5, 0xff4400, 18, "Marte");

camera.position.z = 40;

// --- 2. CONFIGURAÇÃO MEDIAPIPE ---
const hands = new Hands({locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`});
hands.setOptions({ 
    maxNumHands: 2, // Ativado para evitar perda de tracking
    modelComplexity: 1, 
    minDetectionConfidence: 0.5, 
    minTrackingConfidence: 0.5 
});

hands.onResults((res) => {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    if (res.multiHandLandmarks && res.multiHandLandmarks.length > 0) {
        // Usar a primeira mão detectada para a mira
        const marks = res.multiHandLandmarks[0];
        
        // Desenhar Tracker Visual
        drawConnectors(canvasCtx, marks, HAND_CONNECTIONS, {color: '#00FFCC', lineWidth: 2});

        const indexTip = marks[8];
        const screenX = indexTip.x * canvasElement.width;
        const screenY = indexTip.y * canvasElement.height;

        // --- LÓGICA DE SELEÇÃO (RAYCASTING) ---
        // Ajuste crucial: Inverter o X do raycaster devido ao espelhamento da câmera
        const mouse = new THREE.Vector2((indexTip.x * 2 - 1), -(indexTip.y * 2 - 1));
        raycaster.setFromCamera(mouse, camera);
        
        const intersects = raycaster.intersectObjects(planets);

        if (intersects.length > 0) {
            const obj = intersects[0].object;
            if (hoveredObject === obj) {
                selectionTimer++;
                // --- LÓGICA DE ZOOM ---
                if (selectionTimer >= SELECTION_THRESHOLD) {
                    const worldPos = new THREE.Vector3();
                    obj.getWorldPosition(worldPos);
                    camera.position.lerp(new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z + 8), 0.05);
                }
            } else {
                hoveredObject = obj;
                selectionTimer = 0;
            }
        } else {
            hoveredObject = null;
            selectionTimer = 0;
            // Resetar Câmera
            camera.position.lerp(new THREE.Vector3(0, 5, 40), 0.03);
            camera.lookAt(0, 0, 0);
        }

        // --- DESENHAR MIRA VISUAL ---
        canvasCtx.lineWidth = 5;
        canvasCtx.strokeStyle = hoveredObject ? '#FF3333' : '#00FFCC';
        
        // Mira central
        canvasCtx.beginPath();
        canvasCtx.arc(screenX, screenY, 15, 0, 2 * Math.PI);
        canvasCtx.stroke();

        // Anel de carregamento (Dwell)
        if (hoveredObject) {
            canvasCtx.beginPath();
            canvasCtx.strokeStyle = '#FFFFFF';
            canvasCtx.lineWidth = 3;
            const progress = Math.min(selectionTimer / SELECTION_THRESHOLD, 1);
            canvasCtx.arc(screenX, screenY, 22, 0, progress * 2 * Math.PI);
            canvasCtx.stroke();
        }
    }
    canvasCtx.restore();
});

const cam = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 640, height: 480
});

// Inicialização correta dos tamanhos
startBtn.onclick = () => {
    ui.style.display = 'none';
    cam.start().then(() => {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
    });
};

function animate() {
    requestAnimationFrame(animate);
    planets.forEach(p => p.rotation.y += 0.005);
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
