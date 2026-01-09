const videoElement = document.getElementById('video-input');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const startBtn = document.getElementById('start-btn');
const ui = document.getElementById('ui');

// 1. SETUP THREE.JS (Sistema Solar)
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const sunLight = new THREE.PointLight(0xffffff, 2, 100);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x404040));

const createPlanet = (size, color, dist) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 32, 32), new THREE.MeshStandardMaterial({ color }));
    const pivot = new THREE.Object3D();
    mesh.position.x = dist;
    pivot.add(mesh);
    scene.add(pivot);
    return { pivot };
};

const sun = new THREE.Mesh(new THREE.SphereGeometry(2, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffcc00 }));
scene.add(sun);
const planets = [createPlanet(0.4, 0xaaaaaa, 4), createPlanet(0.7, 0xff9900, 6), createPlanet(0.8, 0x00aaff, 9)];

camera.position.z = 20;
camera.position.y = 5;
camera.lookAt(0,0,0);

// 2. SETUP MEDIAPIPE (Deteção e Desenho)
const hands = new Hands({locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7 });

hands.onResults((res) => {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    if (res.multiHandLandmarks && res.multiHandLandmarks.length > 0) {
        for (const landmarks of res.multiHandLandmarks) {
            // Desenha o esqueleto (o que você pediu)
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00FFCC', lineWidth: 4});
            drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 2, radius: 3});
            
            // Move o sistema solar
            scene.rotation.y = (landmarks[9].x - 0.5) * 4;
            scene.rotation.x = (landmarks[9].y - 0.5) * 4;
        }
    }
    canvasCtx.restore();
});

const cam = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); }
});

startBtn.onclick = () => {
    ui.style.display = 'none';
    cam.start();
    canvasElement.width = videoElement.videoWidth || 640;
    canvasElement.height = videoElement.videoHeight || 480;
};

function animate() {
    requestAnimationFrame(animate);
    planets.forEach((p, i) => p.pivot.rotation.y += 0.01 * (1 / (i + 1)));
    renderer.render(scene, camera);
}
animate();
