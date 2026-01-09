const videoElement = document.getElementById('video-input');
const startBtn = document.getElementById('start-btn');
const ui = document.getElementById('ui');

// Configuração da Cena 3D
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Criação das Partículas
const geometry = new THREE.BufferGeometry();
const count = 10000;
const pos = new Float32Array(count * 3);
for(let i=0; i<count*3; i++) pos[i] = (Math.random() - 0.5) * 30;
geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
const material = new THREE.PointsMaterial({ color: 0x00ffcc, size: 0.03 });
const particles = new THREE.Points(geometry, material);
scene.add(particles);
camera.position.z = 15;

// Configuração do MediaPipe (Deteção de Mãos)
const hands = new Hands({locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7 });

hands.onResults((res) => {
    if (res.multiHandLandmarks && res.multiHandLandmarks.length > 0) {
        const pt = res.multiHandLandmarks[0][9]; // Centro da mão
        particles.rotation.y = (pt.x - 0.5) * 6;
        particles.rotation.x = (pt.y - 0.5) * 6;
    }
});

const cam = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 640, height: 480
});

startBtn.onclick = () => {
    ui.style.display = 'none';
    cam.start();
};

function animate() {
    requestAnimationFrame(animate);
    particles.rotation.z += 0.001;
    renderer.render(scene, camera);
}
animate();