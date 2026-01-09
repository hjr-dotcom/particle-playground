const videoElement = document.getElementById('video-input');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const startBtn = document.getElementById('start-btn');
const ui = document.getElementById('ui');

// --- SETUP THREE.JS ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.PointLight(0xffffff, 3, 100));
scene.add(new THREE.AmbientLight(0x404040));

const planets = [];
const raycaster = new THREE.Raycaster();
let hoveredObject = null;
let selectionTimer = 0;
const SELECTION_THRESHOLD = 90; // Reduzido para ~1.5 segundos para ser mais ágil

const createPlanet = (size, color, dist, name) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 32, 32), new THREE.MeshStandardMaterial({ color }));
    mesh.position.set(dist, 0, 0);
    mesh.name = name;
    scene.add(mesh);
    planets.push(mesh);
    return mesh;
};

// Planetas
createPlanet(2.5, 0xffcc00, 0, "Sol");
createPlanet(0.8, 0x00aaff, 8, "Terra");
createPlanet(1.2, 0xff9900, 14, "Marte");

camera.position.z = 35;

// --- MEDIAPIPE LOGIC ---
const hands = new Hands({locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7 });

hands.onResults((res) => {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    if (res.multiHandLandmarks && res.multiHandLandmarks.length > 0) {
        const marks = res.multiHandLandmarks[0];
        
        // 1. Desenhar o esqueleto (Tracker)
        drawConnectors(canvasCtx, marks, HAND_CONNECTIONS, {color: '#00FFCC', lineWidth: 2});
        drawLandmarks(canvasCtx, marks, {color: '#FF0000', radius: 1});

        const indexTip = marks[8]; // Ponta do indicador
        const screenX = indexTip.x * canvasElement.width;
        const screenY = indexTip.y * canvasElement.height;

        // 2. Lógica de Colisão (Raycasting)
        // Inverter X para compensar o espelhamento da câmera
        const mouse = new THREE.Vector2((indexTip.x * 2 - 1), -(indexTip.y * 2 - 1));
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(planets);

        if (intersects.length > 0) {
            const obj = intersects[0].object;
            if (hoveredObject === obj) {
                selectionTimer++;
                // Iniciar Zoom Progressivo após seleção
                if (selectionTimer >= SELECTION_THRESHOLD) {
                    const targetPos = new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld);
                    camera.position.lerp(new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z + 7), 0.05);
                    camera.lookAt(targetPos);
                }
            } else {
                hoveredObject = obj;
                selectionTimer = 0;
            }
        } else {
            hoveredObject = null;
            selectionTimer = 0;
            // Retornar à visão geral suavemente
            camera.position.lerp(new THREE.Vector3(0, 5, 35), 0.03);
            const targetCenter = new THREE.Vector3(0,0,0);
            camera.lookAt(targetCenter);
        }

        // 3. Desenhar a Mira UI
        canvasCtx.lineWidth = 4;
        canvasCtx.strokeStyle = hoveredObject ? '#FF0000' : '#00FFCC';
        
        // Círculo fixo da mira
        canvasCtx.beginPath();
        canvasCtx.arc(screenX, screenY, 20, 0, 2 * Math.PI);
        canvasCtx.stroke();

        // Círculo de progresso (Dwell Timer)
        if (hoveredObject && selectionTimer < SELECTION_THRESHOLD) {
            canvasCtx.beginPath();
            canvasCtx.strokeStyle = '#FFFFFF';
            canvasCtx.arc(screenX, screenY, 25, 0, (selectionTimer / SELECTION_THRESHOLD) * 2 * Math.PI);
            canvasCtx.stroke();
        }
    }
    canvasCtx.restore();
});

const cam = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 640, height: 480
});

startBtn.onclick = () => {
    ui.style.display = 'none';
    cam.start();
    canvasElement.width = 640;
    canvasElement.height = 480;
};

function animate() {
    requestAnimationFrame(animate);
    // Rotação básica para não ficar estático
    planets.forEach((p, i) => { if(i>0) p.rotation.y += 0.01 });
    renderer.render(scene, camera);
}
animate();
