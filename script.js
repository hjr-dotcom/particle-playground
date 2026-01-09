const videoElement = document.getElementById('video-input');
const startBtn = document.getElementById('start-btn');
const ui = document.getElementById('ui');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Luz Central (Sol)
const sunLight = new THREE.PointLight(0xffffff, 2, 100);
scene.add(sunLight);
const ambientLight = new THREE.AmbientLight(0x404040); 
scene.add(ambientLight);

// Criar o Sol e Planetas
const createPlanet = (size, color, distance) => {
    const geo = new THREE.SphereGeometry(size, 32, 32);
    const mat = new THREE.MeshStandardMaterial({ color: color });
    const mesh = new THREE.Mesh(geo, mat);
    const pivot = new THREE.Object3D(); // Pivô para órbita
    mesh.position.x = distance;
    pivot.add(mesh);
    scene.add(pivot);
    return { mesh, pivot, distance };
};

const sunGeo = new THREE.SphereGeometry(2, 32, 32);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
const sun = new THREE.Mesh(sunGeo, sunMat);
scene.add(sun);

const planets = [
    createPlanet(0.4, 0xaaaaaa, 4),  // Mercúrio
    createPlanet(0.7, 0xff9900, 6),  // Vénus
    createPlanet(0.8, 0x00aaff, 9),  // Terra
    createPlanet(0.6, 0xff4400, 12)  // Marte
];

camera.position.z = 20;
camera.position.y = 10;
camera.lookAt(0,0,0);

// Configuração MediaPipe
const hands = new Hands({locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7 });

hands.onResults((res) => {
    if (res.multiHandLandmarks && res.multiHandLandmarks.length > 0) {
        const pt = res.multiHandLandmarks[0][9];
        // Roda o sistema solar inteiro com a mão
        scene.rotation.y = (pt.x - 0.5) * 4;
        scene.rotation.x = (pt.y - 0.5) * 4;
    }
});

const cam = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 640, height: 480
});

startBtn.onclick = () => { ui.style.display = 'none'; cam.start(); };

function animate() {
    requestAnimationFrame(animate);
    // Movimento orbital automático
    planets.forEach((p, i) => {
        p.pivot.rotation.y += 0.01 * (1 / (i + 1));
        p.mesh.rotation.y += 0.02;
    });
    renderer.render(scene, camera);
}
animate();
