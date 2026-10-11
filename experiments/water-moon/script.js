import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  PlaneGeometry,
  Vector2,
  ShaderMaterial,
  DoubleSide,
  Mesh,
  DirectionalLight,
  Color,
  MathUtils,
  UniformsUtils,
  UniformsLib,
  TextureLoader,
  SRGBColorSpace,
  NoColorSpace,
  RepeatWrapping,
  ClampToEdgeWrapping,
  LinearMipmapLinearFilter,
  LinearFilter,
  WebGLRenderTarget,
  HalfFloatType,
  NoToneMapping,
  ACESFilmicToneMapping,
} from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { vertex_water, fragment_water, vertex_moon, fragment_moon } from './shaders.js';

const MOON_TEXTURE = './textures/moon-texture.png';

const createApp = () => {
  const host = document.querySelector('#viewport');
  const canvas = document.querySelector('#canvas');
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x1a1a2e, 1);
  
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 2 / 3, 0.1, 100);
  camera.position.fromArray([0, 7, 8.8]);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  const resizeCallbacks = [];
  let size = { width: 1, height: 1, pixelRatio: 1 };
  const resize = () => {
    const rect = host.getBoundingClientRect();
    size = { 
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5)
    };
    renderer.setPixelRatio(size.pixelRatio);
    renderer.setSize(size.width, size.height, false);
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    for (const callback of resizeCallbacks) callback(size);
  };
  const onResize = (callback) => { resizeCallbacks.push(callback); callback(size); };
  
  window.addEventListener('resize', resize);
  resize();

  let previous = 0, time = 0;
  const run = (update, render = () => renderer.render(scene, camera)) => {
    renderer.setAnimationLoop((now) => {
      const delta = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
      previous = now;
      if (document.hidden) return;
      time += delta;
      update(time);
      render();
    });
  };

  return {
    scene,
    camera,
    renderer,
    run,
    onResize,
  };
};

const createWater = (app) => {
  const width = 18, depth = 28, segmentsX = 160, segmentsZ = 320;
  const geometry = new PlaneGeometry(width, depth, segmentsX, segmentsZ);
  const uniforms = {
    // color, tDiffuse, textureMatrix for reflector
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    uGridSpacing: { value: new Vector2(width/segmentsX, depth/segmentsZ) },
    uTime: { value: 2.3 },
    // wave
    uWave: { value: 1 },
    uDetail: { value: 1 },
    // light
    uGloss: { value: 1 },
  };
  // const mesh = new Mesh(geometry, material);
  const mesh = new Reflector(geometry, {
    textureWidth: 768, textureHeight: 1152, multisample: 0, clipBias: 0.003,
    shader: {
      uniforms,
      vertexShader: vertex_water,
      fragmentShader: fragment_water,
      lights: true,
    },
  });
  mesh.name = 'Water height-field mesh';
  mesh.rotation.x = -Math.PI / 2; // local z points upward
  const material = mesh.material;
  Object.assign(material.uniforms, UniformsUtils.clone(UniformsLib.lights));
  material.lights = true;

  // layer1: moons
  mesh.camera.layers.set(1);
  const capture = mesh.onBeforeRender;
  const clearColor = new Color();
  mesh.onBeforeRender = function(renderer,scene,camera,...rest) {
    const background = scene.background;
    renderer.getClearColor(clearColor);
    const alpha = renderer.getClearAlpha();
    try {
      scene.background = null;
      renderer.setClearColor(0x000000, 0);
      capture.call(this,renderer,scene,camera,...rest);
    } finally {
      scene.background = background;
      renderer.setClearColor(clearColor,alpha);
    }
  };
  app.onResize(({ width, height, pixelRatio}) => {
    // Limit mirror resolution independently from the main framebuffer.
    const scale = Math.min(pixelRatio,1152/height);
    mesh.getRenderTarget().setSize(Math.max(1,Math.round(width*scale)),
      Math.max(1,Math.round(height*scale)));
  });

  return {
    mesh,
    update(time) {
      const u = material.uniforms;
      u.uTime.value = time;
    },
  };
};

const createLighting = (scene) => {
  const elevation = 10, azimuth = 0, spread = 10;
  const sky = 0.85;

  // const weight = 0.5;
  // const light = new DirectionalLight(new Color().setRGB(1, 0.94, 0.78), weight);

  const weights = [0.25, 0.50, 0.25];

  weights.forEach((weight, i) => {
    const light = new DirectionalLight(new Color().setRGB(1, 0.94, 0.78), weight);

    const el = MathUtils.degToRad(elevation);
    const az = MathUtils.degToRad(azimuth + (i - 1) * spread);
    light.position.set(
      Math.sin(az) * Math.cos(el),
      Math.sin(el),
      -Math.cos(az) * Math.cos(el)
    ).multiplyScalar(20);
    light.intensity = sky * 2.6 * weight;

    scene.add(light, light.target);
  });
};

const createMoon = () => {
  // texture
  const textureLoader = new TextureLoader();
  let resolveReady;
  const ready = new Promise((resolve) => { resolveReady = resolve; });
  const texture = textureLoader.load(MOON_TEXTURE, resolveReady);
  texture.colorSpace = NoColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;

  // mesh
  const geometry = new PlaneGeometry(2, 2);
  const uniforms = {
    uLunarMap: { value: texture },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: vertex_moon,
    fragmentShader: fragment_moon,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  const mesh = new Mesh(geometry, material);
  return { 
    mesh,
    ready,
    faceCamera(camera) { mesh.quaternion.copy(camera.quaternion); }
  };
};

const createPostprocessing = ({ renderer, scene, camera, onResize }) => {
  const target = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType, depthBuffer: true, stencilBuffer: false,
  });
  const composer = new EffectComposer(renderer, target);
  const scenePass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(new Vector2(1, 1), 0.16, 0.25, 1.0);
  const outputPass = new OutputPass();
  composer.addPass(scenePass);
  composer.addPass(bloomPass);
  composer.addPass(outputPass);
  onResize(({ width, height, pixelRatio }) => {
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
  });
  return {
    composer, bloomPass,
    render(strength, diagnostic = false) {
      bloomPass.enabled = !diagnostic && strength > 0;
      bloomPass.strength = strength;
      renderer.toneMapping = diagnostic ? NoToneMapping : ACESFilmicToneMapping;
      composer.render();
    },
  };
};

const app = createApp();
const { renderer, scene, camera, run, onResize } = app;
const water = createWater(app);
createLighting(scene);
scene.add(water.mesh);
const moon = createMoon();
moon.mesh.layers.enable(1);
scene.add(moon.mesh);
moon.mesh.position.set(0, .8, -1.0);

const post = createPostprocessing(app);

moon.ready.then(() => {
  run((time) => {
    moon.faceCamera(camera);
    water.update(time);
  }, () => {
    post.render(0.2);
  });
});