const videoElement = document.getElementById('video-input');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const startBtn = document.getElementById('start-btn');
const ui = document.getElementById('ui');

// --- CONFIGURAÇÃO THREE.JS ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.PointLight(0xffffff, 3, 100));
scene.add(new THREE.AmbientLight(0x404040));

const planets = [];
const raycaster = new THREE.Raycaster();
let selectedObject = null;
let lastDist = null;

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

camera.position.z = 25;

// --- MEDIAPIPE LOGIC ---
const hands = new Hands({locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`});
hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7 });

hands.onResults((res) => {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    if (res.multiHandLandmarks && res.multiHandLandmarks.length > 0) {
        // 1. Desenhar mãos
        res.multiHandLandmarks.forEach(marks => {
            drawConnectors(canvasCtx, marks, HAND_CONNECTIONS, {color: '#00FFCC', lineWidth: 3});
            drawLandmarks(canvasCtx, marks, {color: '#FF0000', radius: 2});
        });

        // 2. Lógica de ZOOM (Duas Mãos)
        if (res.multiHandLandmarks.length === 2) {
            const h1 = res.multiHandLandmarks[0][9];
            const h2 = res.multiHandLandmarks[1][9];
            const dist = Math.hypot(h1.x - h2.x, h1.y - h2.y);
            if (lastDist) {
                camera.position.z -= (dist - lastDist) * 50;
                camera.position.z = THREE.MathUtils.clamp(camera.position.z, 5, 60);
            }
            lastDist = dist;
        } else {
            lastDist = null;
            
            // 3. SELECIONAR E MOVER (Uma Mão - Gesto de Pinça)
            const hand = res.multiHandLandmarks[0];
            const thumb = hand[4];
            const index = hand[8];
            const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y);

            // Converter posição da mão para coordenadas 3D (-1 a 1)
            const mouse = new THREE.Vector2((index.x * 2 - 1), -(index.y * 2 - 1));
            raycaster.setFromCamera(mouse, camera);

            if (pinchDist < 0.05) { // Pinça fechada
                if (!selectedObject) {
                    const intersects = raycaster.intersectObjects(planets);
                    if (intersects.length > 0) selectedObject = intersects[0].object;
                }
                if (selectedObject) {
                    const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(camera);
                    const dir = vector.sub(camera.position).normalize();
                    const distance = -camera.position.z / dir.z;
                    const pos = camera.position.clone().add(dir.multiplyScalar(distance));
                    selectedObject.position.copy(pos);
                }
            } else {
                selectedObject = null;
            }
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
