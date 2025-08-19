// src/main.js

// --- OPTIMIZATION 1: Selective Imports ---
// Importing only the necessary classes from Three.js reduces the final bundle size.
import {
    Scene,
    Color,
    PerspectiveCamera,
    WebGLRenderer,
    SRGBColorSpace,
    SpotLight,
    DirectionalLight,
    PointLight,
    AmbientLight,
    Vector2,
    Vector3,
    Plane,
    Raycaster,
    Clock,
    AnimationMixer,
    MathUtils,
    MeshStandardMaterial,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';


// --- 1) Scene, Camera, Renderer ---
const scene = new Scene();
scene.background = new Color('#fafafa');

const camera = new PerspectiveCamera(13.9, window.innerWidth / window.innerHeight, 0.01, 100000);
camera.position.set(180, 43, 90);
camera.rotation.set(
    MathUtils.degToRad(-16.36),
    MathUtils.degToRad(63.35),
    MathUtils.degToRad(15.09),
    'YXZ'
);

const renderer = new WebGLRenderer({ antialias: true, alpha: true });
renderer.outputColorSpace = SRGBColorSpace;
renderer.setSize(window.innerWidth, window.innerHeight);
// --- OPTIMIZATION 2: Cap Pixel Ratio ---
// A major performance boost on high-resolution screens.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// --- OPTIMIZATION 3: Cleaned up unused shadow and renderer settings.
document.body.appendChild(renderer.domElement);


// --- 2) Post-processing ---
// The custom shader for the hover effect, kept from your original code.
const CustomAnaglyphShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'intensity': { value: 0.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float intensity;
        varying vec2 vUv;
        void main() {
            float shift = 0.003 * intensity;
            vec2 dirR = vec2(1.0, 0.0) * shift;
            vec2 dirG = vec2(-0.5, 0.866) * shift;
            vec2 dirB = vec2(-0.5, -0.866) * shift;
            float r = texture(tDiffuse, vUv + dirR).r;
            float g = texture(tDiffuse, vUv + dirG).g;
            float b = texture(tDiffuse, vUv + dirB).b;
            gl_FragColor = vec4(r, g, b, 1.0);
        }
    `
};

// --- FUNCTIONALITY RESTORED: WhiteOverlayPass is back ---
const WhiteOverlayPass = new ShaderPass({
    uniforms: {
        tDiffuse: { value: null },
        opacity:  { value: 0.2 }, // Default opacity
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float opacity;
        varying vec2 vUv;
        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            // Mix the original color with white based on opacity
            gl_FragColor = vec4(
                mix(color.rgb, vec3(1.0), opacity),
                color.a
            );
        }
    `
});


// --- OPTIMIZATION 4: Simplified Composer ---
// Using only the necessary passes for the hover effect.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const anaglyphPass = new ShaderPass(CustomAnaglyphShader);
composer.addPass(anaglyphPass);
// Add the overlay pass at the end of the chain
composer.addPass(WhiteOverlayPass);


// --- 3) Lights ---
const spotLight1 = new SpotLight(0x959595, 2, 240);
spotLight1.position.set(0, 60, 20);
spotLight1.decay = 0.1;
scene.add(spotLight1);

const spotLight2 = new SpotLight(0xffffff, 1, 240);
spotLight2.position.set(50, -10, 80);
spotLight2.decay = 0.1;
scene.add(spotLight2);

const dirLight = new DirectionalLight(0xffffff, 1);
dirLight.position.set(100, 140, 40);
scene.add(dirLight);

const fillLight = new PointLight(0xffffff, 0.2, 200);
fillLight.position.set(40, 25, 0);
scene.add(fillLight);

const ambientLight = new AmbientLight(0xffffff, 2.2);
scene.add(ambientLight);


// --- 4) Controls ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 24.65, 0);
controls.enableZoom = false;
controls.enableRotate = false;
controls.enablePan = false;


// --- 5) Model Loading & Interaction Setup ---
let mixer = null;
let model = null;
let headBone = null;
const clock = new Clock();
const loader = new GLTFLoader();

const raycaster = new Raycaster();
const mouse = new Vector2();
let isHovered = false;

const rawTarget = new Vector3(60, 110, 91); // The instant intersection point
const smoothTarget = new Vector3(60, 120, 91); // The filtered version for smooth movement
const SMOOTH_FACTOR = 0.02;

const interSectionPoint = new Vector3();
const planeNormal = new Vector3();
const plane = new Plane();

// Your original mapping and clamping values
const outMin = 60;
const outMax = 80;
const inMin = 130;
const inMax = 150;
const inMinY = 35;
const inMaxY = 58;
const outMinY = 60;
const outMaxY = 110;


loader.load('assets/models/fox24.glb', (gltf) => {
    model = gltf.scene;
    model.position.set(50, 17, 0);
    model.scale.set(6.7, 6.7, 6.7);
    
    const whiteMaterial = new MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0,
        roughness: 1,
    });

    model.traverse((child) => {
        if (child.isMesh) {
            child.material = whiteMaterial;
        }
    });
    scene.add(model);

    if (gltf.animations.length) {
        mixer = new AnimationMixer(model);
        gltf.animations.forEach((clip) => {
            const action = mixer.clipAction(clip);
            action.timeScale = 0.5;
            action.play();
        });
    }

    headBone = model.getObjectByName('spine011_metarig');
});


// --- 6) Event Listeners ---
window.addEventListener('pointermove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    planeNormal.copy(camera.position).normalize();
    const planeTargetPoint = new Vector3(100, 100, 100).add(scene.position);
    plane.setFromNormalAndCoplanarPoint(planeNormal, planeTargetPoint);

    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(plane, interSectionPoint);

    const rawX = interSectionPoint.x;
    const rawY = interSectionPoint.y;

    const mappedY = MathUtils.mapLinear(rawY, inMinY, inMaxY, outMinY, outMaxY);
    const clampedY = MathUtils.clamp(mappedY, outMinY, outMaxY);

    const mappedX = MathUtils.mapLinear(rawX, inMin, inMax, outMin, outMax);
    const clampedX = MathUtils.clamp(mappedX, outMin, outMax);

    rawTarget.set(clampedX, clampedY, interSectionPoint.z);

    if (model) {
        const intersects = raycaster.intersectObject(model, true);
        const currentlyHovered = intersects.length > 0;
        if (currentlyHovered !== isHovered) {
            isHovered = currentlyHovered;
            if (mixer) {
                mixer.timeScale = isHovered ? 1.5 : 0.5;
            }
        }
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});


// --- 7) Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    controls.update();

    if (headBone) {
        smoothTarget.lerp(rawTarget, SMOOTH_FACTOR);
        headBone.lookAt(smoothTarget);
        headBone.rotateX(Math.PI / 2); // Corrective rotation
    }

    // Smoothly interpolate the shader effect intensity on hover
    const targetIntensity = isHovered ? 2.5 : 0.0;
    const currentIntensity = anaglyphPass.uniforms.intensity.value;
    anaglyphPass.uniforms.intensity.value += (targetIntensity - currentIntensity) * 0.1;

    // --- FUNCTIONALITY RESTORED: Update overlay opacity in the loop ---
    WhiteOverlayPass.uniforms.opacity.value = 0.2; // Set your desired opacity here

    composer.render();
}

animate();
