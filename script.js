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
const SELECTION_THRESHOLD = 180; // ~3 segundos a 60fps

const createPlanet = (size, color, dist, name) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 32, 32), new THREE.MeshStandardMaterial({ color }));
    mesh.position.x = dist;
    mesh.name = name;
    scene.add(mesh);
    planets.push(mesh);
};

createPlanet(2, 0xffcc00, 0, "Sol");
createPlanet(0.8, 0x00aaff, 8, "Terra");
createPlanet(0.6, 0xff4400, 12, "Marte");
createPlanet(1.2, 0xff9900, 16, "Saturno");

camera.position.z = 30;

// --- MEDIAPIPE LOGIC ---
const hands = new Hands({locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7 });

hands.onResults((res) => {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    if (res.multiHandLandmarks && res.multiHandLandmarks.length > 0) {
        const marks = res.multiHandLandmarks[0];
        drawConnectors(canvasCtx, marks, HAND_CONNECTIONS, {color: '#00FFCC', lineWidth: 2});
        
        const indexTip = marks[8];
        const screenX = indexTip.x * canvasElement.width;
        const screenY = indexTip.y * canvasElement.height;

        // Desenhar Mira (Crosshair)
        canvasCtx.strokeStyle = hoveredObject ? '#FF0000' : '#00FFCC';
        canvasCtx.lineWidth = 3;
        canvasCtx.beginPath();
        canvasCtx.arc(screenX, screenY, 20, 0, 2 * Math.PI);
        // Barra de progresso circular (3 segundos)
        if (hoveredObject) {
            canvasCtx.arc(screenX, screenY, 25, 0, (selectionTimer / SELECTION_THRESHOLD) * 2 * Math.PI);
        }
        canvasCtx.stroke();

        // Raycasting para detecção
        const mouse = new THREE.Vector2((indexTip.x * 2 - 1), -(indexTip.y * 2 - 1));
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(planets);

        if (intersects.length > 0) {
            const obj = intersects[0].object;
            if (hoveredObject === obj) {
                selectionTimer++;
                if (selectionTimer >= SELECTION_THRESHOLD) {
                    // Efeito de ZOOM ao selecionar
                    const targetZ = obj.position.x + 5;
                    camera.position.z += (targetZ - camera.position.z) * 0.1;
                    camera.lookAt(obj.position);
                }
            } else {
                hoveredObject = obj;
                selectionTimer = 0;
            }
        } else {
            hoveredObject = null;
            selectionTimer = 0;
            // Volta suavemente para a visão geral se nada for focado
            camera.position.z += (30 - camera.position.z) * 0.02;
        }
        
        // Rotação da cena se não houver seleção ativa
        if (selectionTimer < SELECTION_THRESHOLD) {
            scene.rotation.y += ((indexTip.x - 0.5) * 2 - scene.rotation.y) * 0.1;
        }
    }
    canvasCtx.restore();
});

const cam = new Camera(videoElement, { onFrame: async () => { await hands.send({image: videoElement}); } });

startBtn.onclick = () => {
    ui.style.display = 'none';
    cam.start();
    canvasElement.width = videoElement.videoWidth || 640;
    canvasElement.height = videoElement.videoHeight || 480;
};

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();
