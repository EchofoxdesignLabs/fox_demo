// src/main.js

import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { AnaglyphEffect } from 'three/examples/jsm/effects/AnaglyphEffect.js';



import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';










//--- Helper Button for Camera Positioning ---

// const logButton = document.createElement('button');

// logButton.textContent = 'Log Camera Position';

// Object.assign(logButton.style, {

// position: 'absolute',

// top: '15px',

// left: '15px',

// zIndex: '100',

// padding: '10px',

// backgroundColor: '#007bff',

// color: 'white',

// border: 'none',

// borderRadius: '5px',

// cursor: 'pointer'

// });

// document.body.appendChild(logButton);





// 1) Scene, Camera, Renderer

const scene = new THREE.Scene();

scene.background = new THREE.Color(0xfafafa); // White background



// Updated camera settings from your Spline screenshot

const camera = new THREE.PerspectiveCamera(

  13.9, // FOV from Spline

  window.innerWidth / window.innerHeight,

  0.01, // Near plane from Spline

  100000 // Far plane from Spline

);



// Set camera position from Spline

camera.position.set(200, 61.4, 107.57);



// Set camera rotation from Spline (converted from degrees to radians)

// Euler order 'YXZ' is often a good default to avoid gimbal lock, matching many 3D tools.

camera.rotation.set(

  THREE.MathUtils.degToRad(-16.36), // X rotation

  THREE.MathUtils.degToRad(63.35), // Y rotation

  THREE.MathUtils.degToRad(15.09), // Z rotation

  'YXZ' // Setting the order of rotations

);





const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setPixelRatio(window.devicePixelRatio);

renderer.setSize(window.innerWidth, window.innerHeight);

renderer.setClearColor(0xffffff, 1);

renderer.useLegacyLights = false;

renderer.outputColorSpace = THREE.SRGBColorSpace;

renderer.shadowMap.enabled = false;

renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.body.appendChild(renderer.domElement);



// const composer = new EffectComposer(renderer);

// const size = new THREE.Vector2(window.innerWidth, window.innerHeight);

// composer.addPass(new RenderPass(scene, camera));
// 2) Post-processing Setup with EffectComposer
let composer, anaglyphPass, bokehPass;
composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// Add SAOPass for Ambient Occlusion - THIS CREATES THE SOFT CONTACT SHADOWS
// const ssao = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
// ssao.kernelRadius = 0.1;        // how far to sample
// ssao.minDistance = 0.005;      
// ssao.maxDistance = 1;        
// composer.addPass(ssao);

// Add Bloom Pass
// const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.08, 1, 1);
// composer.addPass(bloomPass);

// Add Bokeh (Depth of Field) Pass
bokehPass = new BokehPass(scene, camera, {
  focus: 50,      // Will be updated once model is loaded
  aperture: 0.005, // Lower value for subtle blur, increase for more
  maxblur: 0.001,  // Maximum blur amount
});
composer.addPass(bokehPass);
const film = new FilmPass(0.02, 0, 0, false);
composer.addPass(film);

// Add custom Anaglyph Pass - CORRECTED IMPLEMENTATION
// This shader is now self-contained and does not rely on the removed AnaglyphShader.js
const CustomAnaglyphShader = {
  uniforms: {
    'tDiffuse': { value: null }, // This is the input texture from the previous pass
    'intensity': { value: 0.0 }  // Our custom uniform to control the effect strength
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
            vec2 shift = vec2(0.005 * intensity, 0.0);
            vec4 colorL = texture(tDiffuse, vUv - shift); // Sample for the left eye (red channel)
            vec4 colorR = texture(tDiffuse, vUv + shift); // Sample for the right eye (green/blue channels)
            gl_FragColor = vec4(colorL.r, colorR.g, colorR.b, 1.0);
        }
    `
};

// 1) Define the overlay pass
const WhiteOverlayPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },        // the input render
    opacity:  { value: 0.5 },          // 50% white
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
      // mix(color, white, opacity)
      gl_FragColor = vec4(
        mix(color.rgb, vec3(1.0), opacity),
        color.a
      );
    }
  `
});
// 2) Add it at the very end of your composer
composer.addPass(WhiteOverlayPass);



// 2) Anaglyph Effect Setup

// const effect = new AnaglyphEffect(renderer);

// effect.setSize(window.innerWidth, window.innerHeight);

let useEffect = false;

anaglyphPass = new ShaderPass(CustomAnaglyphShader);
composer.addPass(anaglyphPass);



// 3) Lights

// const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);

// dirLight.position.set(5, 10, 7.5);

// scene.add(dirLight);

// const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);

// scene.add(ambientLight);

// Point Light 1

const spotLight1 = new THREE.SpotLight(0x959595, 2, 240);

spotLight1.position.set(0, 60, 20);

spotLight1.decay = 0.1;

spotLight1.castShadow = false;

scene.add(spotLight1);
scene.add(spotLight1.target); // Add target for the spotlight
spotLight1.target.position.set(30, 60, 20); // Adjust target position as needed

// const pointLight1Helper = new THREE.SpotLightHelper(spotLight1, 20, 0xff0000); // Red

// scene.add(pointLight1Helper);



// Point Light 2

const spotLight2 = new THREE.SpotLight(0xffffff, 1, 240);

spotLight2.position.set(50, -10, 80);

spotLight2.decay = 0.1;
spotLight2.castShadow = false;

scene.add(spotLight2);
scene.add(spotLight2.target); // Add target for the spotlight
spotLight2.target.position.set(30, 60, 20); // Adjust target position as needed

// const spotLight2Helper = new THREE.SpotLightHelper(spotLight2, 20, 0x0000ff); // Blue

// scene.add(spotLight2Helper);



// // Directional Light (updated position and rotation from screenshot)

const dirLight = new THREE.DirectionalLight(0xffffff, 1);

dirLight.position.set(100,140,40);



dirLight.castShadow = false; // Enable shadows for this light

dirLight.shadow.mapSize.width = 4096; // Increased resolution for crisper shadows

dirLight.shadow.mapSize.height = 4096;

// with PCFSoftShadowMap active on your renderer:

renderer.shadowMap.type = THREE.PCFSoftShadowMap;

dirLight.shadow.radius = 20;

dirLight.shadow.camera.near = 0.5;

dirLight.shadow.camera.far = 400;

// CORRECTED: Increased shadow camera frustum size to ensure it covers the model and ground

dirLight.shadow.camera.left = -150;

dirLight.shadow.camera.right = 150;

dirLight.shadow.camera.top = 150;

dirLight.shadow.camera.bottom = -150;

dirLight.shadow.bias = -0.0001; // push the shadow map sample back onto the surface

dirLight.shadow.normalBias = 0.05; // helps even out stretched shadows



scene.add(dirLight);

scene.add(dirLight.target);

dirLight.target.position.set(50, 60, 20);
//dirLight.target.rotation.set(90, 0, 0); // Ensure the target is looking at the model



const fill = new THREE.PointLight(0xffffff, 0.2, 200);

fill.position.set(40, 25, 0); // just above/behind the fox’s neck

fill.castShadow = false; // no shadows, just gentle fill

scene.add(fill);



// const dirLightHelper = new THREE.DirectionalLightHelper(dirLight, 100, 0x00ff00); // Green

// scene.add(dirLightHelper);







// Optional: Slight ambient to fill shadows softly

const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);

scene.add(ambientLight);



// 4) OrbitControls - Re-enabled for positioning

const controls = new OrbitControls(camera, renderer.domElement);

controls.enableDamping = true;

// Set the controls target to the model's position for intuitive rotation

controls.target.set(0, 24.65, 0);





// -- TO LOCK THE CAMERA VIEW LATER --

// After you confirm the view, uncomment the three lines below.

controls.enableZoom = false;

controls.enableRotate = false;

controls.enablePan = false;



// For Smooth head movement

const rawTarget = new THREE.Vector3(); // the instant intersection point

const smoothTarget = new THREE.Vector3(60, 120, 91); // the filtered version

const SMOOTH_FACTOR = 0.02;





// 5) Load animated glTF model

let mixer = null;

let model = null;

let headBone = null;

let neckBones = [];

let baseQuaternions = [];

const clock = new THREE.Clock();

const loader = new GLTFLoader();

const whiteMaterial = new THREE.MeshStandardMaterial({

  color: 0xffffff,

  metalness: 0,

  roughness: 1,

});



loader.load(

  'Assets/models/fox23.glb',

  (gltf) => {

    model = gltf.scene;

    model.traverse((child) => {

      if (child.isMesh) {

        child.material = whiteMaterial;
        //child.material.wireframe = true;

        child.castShadow = false;

        child.receiveShadow = false;

      }

    });



    // Set model position and scale from your Spline screenshot

    model.position.set(50, 17, 0);

    model.scale.set(6.7, 6.7,6.7);



    scene.add(model);

    if (gltf.animations && gltf.animations.length > 0) {

      console.log('Animations found:', gltf.animations);

      mixer = new THREE.AnimationMixer(model);

      gltf.animations.forEach((clip) => {

        const action = mixer.clipAction(clip);

        action.play();

        action.timeScale = 0.5;

      });

    }



    // grab the spine bones in order

    // neckBones = [

    // model.getObjectByName('spine009_metarig'),

    // model.getObjectByName('spine010_metarig'),

    // model.getObjectByName('spine011_metarig'),

    // ].filter(b => b);

    headBone = model.getObjectByName('spine011_metarig');

    console.log('Neck bones:', headBone);
    // Update DoF focus after model is loaded
    const modelWorldPosition = new THREE.Vector3();
    model.getWorldPosition(modelWorldPosition);
    const distanceToModel = camera.position.distanceTo(modelWorldPosition);
    bokehPass.uniforms.focus.value = distanceToModel;
  },

  undefined,

  (error) => {

    console.error('Error loading glTF model:', error);

  }

);









// 6) Raycaster and Event Listeners

const raycaster = new THREE.Raycaster();

const mouse = new THREE.Vector2();

let isHovered = false;

const target = new THREE.Object3D();

rawTarget.x = 60; // Initial position for the target

rawTarget.y = 110; // Initial position for the target

rawTarget.z = 91; // Initial position for the target

const interSectionPoint = new THREE.Vector3();

const planeNormal = new THREE.Vector3();

const plane = new THREE.Plane(); // Plane for intersection

const outMin = 60;

const outMax = 80;

const inMin = 130;

const inMax = 150;

const inMinY = 35;

const inMaxY = 58;

const outMinY = 60;

const outMaxY = 110;



window.addEventListener('pointermove', (event) => {

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;

  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  planeNormal.copy(camera.position).normalize(); // Use camera position as normal

  const someValue = new THREE.Vector3(100, 100, 100).add(scene.position);

  plane.setFromNormalAndCoplanarPoint(planeNormal, someValue); // Create a plane from the camera position

  // const planeHelper = new THREE.PlaneHelper(plane, 100, 0x00ffff); // 5 = size, cyan color

  // scene.add(planeHelper);

  raycaster.setFromCamera(mouse, camera);

  raycaster.ray.intersectPlane(plane, interSectionPoint); // Get intersection point with the plane

  const rawX = interSectionPoint.x;

  const rawY = interSectionPoint.y;

  const mappedY = THREE.MathUtils.mapLinear(rawY, inMinY, inMaxY, outMinY, outMaxY);

  const clampedY = THREE.MathUtils.clamp(mappedY, outMinY, outMaxY);

  const mappedX = THREE.MathUtils.mapLinear(rawX, inMin, inMax, outMin, outMax);

  const clampedX = THREE.MathUtils.clamp(mappedX, outMin, outMax);



  target.position.set(clampedX, clampedY, interSectionPoint.z);

  rawTarget.copy(target.position); // Copy the target position for smoothing

  if (model) {

    //raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObject(model, true);

    const currentlyHovered = intersects.length > 0;

    if (currentlyHovered !== isHovered) {

      isHovered = currentlyHovered;

      if (mixer) {

        mixer.timeScale = isHovered ? 1.0 : 0.5;

      }

      useEffect = isHovered;

    }

  }

});



// --- Event listener for our new button ---

// logButton.addEventListener('click', () => {

// const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');

// console.clear();

// console.log("--- Current Camera State ---");

// console.log("Instructions: Copy these values back into your code.");

// console.log(camera.position.set(${camera.position.x.toFixed(4)}, ${camera.position.y.toFixed(4)}, ${camera.position.z.toFixed(4)}););

// console.log(camera.rotation.set(THREE.MathUtils.degToRad(${THREE.MathUtils.radToDeg(euler.x).toFixed(4)}), THREE.MathUtils.degToRad(${THREE.MathUtils.radToDeg(euler.y).toFixed(4)}), THREE.MathUtils.degToRad(${THREE.MathUtils.radToDeg(euler.z).toFixed(4)}), 'YXZ'););

// console.log("\n// --- For Reference (Alternative) ---");

// console.log(// Or use lookAt: camera.lookAt(${controls.target.x.toFixed(4)}, ${controls.target.y.toFixed(4)}, ${controls.target.z.toFixed(4)}));

// console.log("--------------------------");

// alert("Camera position and rotation logged to the developer console (F12).");

// });





// 7) Handle window resize

window.addEventListener('resize', () => {

  camera.aspect = window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  //effect.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);

});







// 8) Animation loop

function animate() {

  if (headBone) {

    // const axesHelper = new THREE.AxesHelper(10); // Size = 0.2 units

    // headBone.add(axesHelper);

    // Move the target position slightly for demonstration

    smoothTarget.lerp(rawTarget, SMOOTH_FACTOR);

    headBone.lookAt(smoothTarget); // Look at the target position

    headBone.rotateX(Math.PI / 2);

    // console.log('Head Bone Position:', headBone.position);

    //console.log('Target Position:', target.position);

    const direction = new THREE.Vector3();

    headBone.getWorldDirection(direction);

  }

  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  if (mixer) mixer.update(delta);

  controls.update();
   // Smoothly update the anaglyph effect's intensity
    const targetIntensity = isHovered ? 1.5 : 0.0;
    const currentIntensity = anaglyphPass.uniforms.intensity.value;
    anaglyphPass.uniforms.intensity.value += (targetIntensity - currentIntensity) * 0.1; // 0.1 is the smoothing factor
    WhiteOverlayPass.uniforms.opacity.value = 0.2;  // 50% white

  // if (useEffect) {

  //   effect.render(scene, camera);

  // } else {

  //   renderer.render(scene, camera);

  // }
  composer.render();

}

animate();