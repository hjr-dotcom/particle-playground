const videoElement = document.getElementById('video-input');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const startBtn = document.getElementById('start-btn');
const ui = document.getElementById('ui');

// --- 1. CONFIGURAÇÃO THREE.JS ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const light = new THREE.PointLight(0xffffff, 10, 100);
light.position.set(5, 5, 10);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040, 3));

const planets = [];
const raycaster = new THREE.Raycaster();
let hoveredObject = null;
let selectionTimer = 0;
const SELECTION_THRESHOLD = 90; 

const createPlanet = (size, color, dist, name) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 32, 32), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.1 }));
    mesh.position.set(dist, 0, 0);
    mesh.name = name;
    scene.add(mesh);
    planets.push(mesh);
    return mesh;
};

createPlanet(3, 0xffcc00, 0, "Sol");
createPlanet(1, 0x00aaff, 10, "Terra");
createPlanet(1.2, 0xff4400, 18, "Marte");

camera.position.z = 40;

// --- 2. CONFIGURAÇÃO MEDIAPIPE ---
const hands = new Hands({locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`});
hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });

hands.onResults((res) => {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    if (res.multiHandLandmarks && res.multiHandLandmarks.length > 0) {
        const marks = res.multiHandLandmarks[0];
        drawConnectors(canvasCtx, marks, HAND_CONNECTIONS, {color: '#00FFCC', lineWidth: 3});
        
        const indexTip = marks[8];
        const screenX = indexTip.x * canvasElement.width;
        const screenY = indexTip.y * canvasElement.height;

        // --- LÓGICA DE SELEÇÃO ---
        const mouse = new THREE.Vector2((indexTip.x * 2 - 1), -(indexTip.y * 2 - 1));
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(planets);

        if (intersects.length > 0) {
            const obj = intersects[0].object;
            if (hoveredObject === obj) {
                selectionTimer++;
                if (selectionTimer >= SELECTION_THRESHOLD) {
                    const worldPos = new THREE.Vector3();
                    obj.getWorldPosition(worldPos);
                    camera.position.lerp(new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z + 8), 0.05);
                }
            } else { hoveredObject = obj; selectionTimer = 0; }
        } else {
            hoveredObject = null; selectionTimer = 0;
            camera.position.lerp(new THREE.Vector3(0, 5, 40), 0.03);
            camera.lookAt(0, 0, 0);
        }

        // --- DESENHAR MIRA ---
        canvasCtx.lineWidth = 5;
        canvasCtx.strokeStyle = hoveredObject ? '#FF3333' : '#00FFCC';
        canvasCtx.beginPath();
        canvasCtx.arc(screenX, screenY, 15, 0, 2 * Math.PI);
        canvasCtx.stroke();

        if (hoveredObject) {
            canvasCtx.beginPath();
            canvasCtx.strokeStyle = '#FFFFFF';
            canvasCtx.lineWidth = 3;
            canvasCtx.arc(screenX, screenY, 22, 0, Math.min(selectionTimer/SELECTION_THRESHOLD, 1) * 2 * Math.PI);
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
    cam.start().then(() => {
        canvasElement.width = videoElement.videoWidth || 640;
        canvasElement.height = videoElement.videoHeight || 480;
    });
};

function animate() {
    requestAnimationFrame(animate);
    planets.forEach(p => p.rotation.y += 0.005);
    renderer.render(scene, camera);
}
animate();
