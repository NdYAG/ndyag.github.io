import {
  WebGLRenderer,
  Scene,
  Camera,
  Vector2,
  PlaneGeometry,
  ShaderMaterial,
  Mesh,
  TextureLoader,
  LinearFilter,
  RepeatWrapping,
} from 'three';
import GUI from 'lil-gui';
import { VERTEX_SHADER, FRAGMENT_SHADER } from './shaders.js';

const renderer = new WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x1a1a2e, 1);
document.body.appendChild(renderer.domElement);

const scene = new Scene();
const camera = new Camera();

const uniforms = {
  uTexture: { value: null },
  uImagePos: { value: new Vector2(.15, .1) },
  uImageSize: { value: new Vector2(.7, .8) },
  uRangeLeft: { value: .4 },
  uRangeRight: { value: .6 },
  uProgress: { value: .0 },
};

const material = new ShaderMaterial({
  vertexShader: VERTEX_SHADER,
  fragmentShader: FRAGMENT_SHADER,
  uniforms,
  transparent: true,
  depthTest: false,
});

const mesh = new Mesh(new PlaneGeometry(2, 2), material);
scene.add(mesh);

const IMAGE_URL = './textures/image.jpg';
new TextureLoader().load(IMAGE_URL, (tex) => {
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  uniforms.uTexture.value = tex;
  tex.wrapS = tex.wrapT = RepeatWrapping;

  const imageAspect = tex.image.width / tex.image.height;
  const viewAspect = window.innerWidth / window.innerHeight;
  const h = .8;
  const w = h * imageAspect / viewAspect;
  uniforms.uImagePos.value.set((1 - w) / 2, (1 - h) / 2);
  uniforms.uImageSize.value.set(w, h);
});

const params = {
  progress: .0,
  animate: false,
};
const gui = new GUI({ title: 'Progress' });
gui.add(params, 'progress', 0, 1, 0.001).name('Progress').onChange(v => uniforms.uProgress.value = v).listen();
gui.add(params, 'animate').name('Auto Animate');

window.addEventListener('resize', () => renderer.setSize(window.innerWidth, window.innerHeight));
let animDir = 1;
(function loop() {
  requestAnimationFrame(loop);
  if (params.animate) {
    params.progress += 0.01 * animDir;
    if (params.progress >= 1) { params.progress = 1; animDir = -1; }
    else if (params.progress <= 0) { params.progress = 0; animDir = 1; }
    uniforms.uProgress.value = params.progress;
  }
  renderer.render(scene, camera);
})();