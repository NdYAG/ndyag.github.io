import {
  WebGLRenderer,
  Scene,
  Camera,
  OrthographicCamera,
  PerspectiveCamera,
  Vector2,
  PlaneGeometry,
  IcosahedronGeometry,
  MeshBasicMaterial,
  ShaderMaterial,
  Mesh,
  TextureLoader,
  LinearFilter,
  RGBAFormat,
  WebGLRenderTarget,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

const IMAGE_URL = './textures/image.jpg';

const { innerWidth: width, innerHeight: height } = window;
const renderer = new WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(width, height);
renderer.setClearColor(0x1a1a2e, 1);
document.body.appendChild(renderer.domElement);

const scene = new Scene();
// const camera = new Camera();
// const camera = new OrthographicCamera( width / - 2, width / 2, height / 2, height / - 2, 1, 1000 );
const camera = new PerspectiveCamera(
  40, // fov
  width / height,
  1,
  1000,
);
camera.position.x = 0;
camera.position.y = 0;
camera.position.z = 5;

const rt = new WebGLRenderTarget(width, height, {
  minFilter: LinearFilter,
  magFilter: LinearFilter,
  format: RGBAFormat,
  samples: 4,
});

// image
const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, 0.0, 1.0);
}
`;
const fragmentShader = `
uniform sampler2D uTexture;
varying vec2 vUv;

void main() {
  vec4 color = texture2D(uTexture, vUv);
  gl_FragColor = color;
}
`;

const uniforms = {
  uTexture: { value: null },
};
const quad = new PlaneGeometry(5, 5);
const material = new ShaderMaterial({
  uniforms,
  vertexShader,
  fragmentShader,
});
const mesh = new Mesh(quad, material);
mesh.position.z = -2;
scene.add(mesh);

const texture = new TextureLoader().load(IMAGE_URL, (tex) => {
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;

  uniforms.uTexture.value = tex;
  const imageAspect = tex.image.width / tex.image.height;
  const h = 0.8;
  mesh.scale.set(h * imageAspect, h);
  render();
});

// lens
const lensVertexShader = `
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec2 vScreenUv;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = mat3(modelMatrix) * normal;
  
  vec4 mvPosition = modelViewMatrix * vec4(position.xyz, 1.0);
  vec4 clipSpacePosition = projectionMatrix * mvPosition;
  vScreenUv = (clipSpacePosition.xy / clipSpacePosition.w) * 0.5 + 0.5;
  gl_Position = clipSpacePosition;
}
`;
const lensFragmentShader = `
uniform sampler2D uTexture;
uniform vec3 uCameraPosition;
uniform float uIorR;
uniform float uIorG;
uniform float uIorB;
uniform float uUseFresnel;
uniform float uFresnel;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec2 vScreenUv;

void main() {
  vec3 viewDir = normalize(vWorldPosition - uCameraPosition);
  vec3 normal = normalize(vWorldNormal);

  float etaR = 1.0 / uIorR; 
  float etaG = 1.0 / uIorG; 
  float etaB = 1.0 / uIorB;

  vec3 refractR = refract(viewDir, normal, etaR);
  vec3 refractG = refract(viewDir, normal, etaG);
  vec3 refractB = refract(viewDir, normal, etaB);

  vec3 diffR = refractR - viewDir;
  vec3 diffG = refractG - viewDir;
  vec3 diffB = refractB - viewDir;

  float fresnel = 1.0 - max(0.0, dot(normal, -viewDir));
  float strength = mix(0.05, uFresnel * fresnel, uUseFresnel);

  float r = texture2D(uTexture, vScreenUv + diffR.xy * strength).r;
  float g = texture2D(uTexture, vScreenUv + diffG.xy * strength).g;
  float b = texture2D(uTexture, vScreenUv + diffB.xy * strength).b;

  vec3 finalColor = vec3(r, g, b);

  float edge = pow(fresnel, 3.) * uUseFresnel;
  finalColor = mix(finalColor, vec3(1.), edge * .5);

  gl_FragColor = vec4(finalColor, 1.);
}
`;
const lensUniforms = {
  uTexture: { value: rt.texture },
  uCameraPosition: { value: camera.position },
  uIorR: { value: 1.42 },
  uIorG: { value: 1.50 },
  uIorB: { value: 1.62 },
  uUseFresnel: { value: 1.0 },
  uFresnel: { value: 0.164 },
};
const lensGeometry = new IcosahedronGeometry(.5, 8);
const lensMaterial = new ShaderMaterial({
  vertexShader: lensVertexShader,
  fragmentShader: lensFragmentShader,
  uniforms: lensUniforms,
});
const lens = new Mesh(lensGeometry, lensMaterial);
lens.position.x = -0.03;
lens.position.y = 0.03;
scene.add(lens);

const render = () => {
  lens.visible = false;
  renderer.setRenderTarget(rt);

  renderer.render(scene, camera);

  renderer.setRenderTarget(null);
  lensUniforms.uCameraPosition.value.copy(camera.position);
  lens.visible = true;
  renderer.render(scene, camera);
};

const controls = new OrbitControls(camera, renderer.domElement);

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  render();
});

const gui = new GUI({ title: 'Lens Controls' });
const iorFolder = gui.addFolder('IOR');
iorFolder.add(lensUniforms.uIorR, 'value', 1, 2).name('iorR');
iorFolder.add(lensUniforms.uIorG, 'value', 1, 2).name('iorG');
iorFolder.add(lensUniforms.uIorB, 'value', 1, 2).name('iorB');
const fresnelFolder = gui.addFolder('Fresnel');
const fresnelSettings = {
  useFresnel: true,
};
fresnelFolder
  .add(fresnelSettings, 'useFresnel')
  .name('Use Fresnel')
  .onChange((useFresnel) => {
    lensUniforms.uUseFresnel.value = useFresnel ? 1.0 : 0.0;
  });
fresnelFolder.add(lensUniforms.uFresnel, 'value', 0, 1).name('Fresnel Strength');
// aslo try 1.11, 1.11, 1.11, 0.447

(function loop() {
  controls.update();
  render();
  requestAnimationFrame(loop);
})();