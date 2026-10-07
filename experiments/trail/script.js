import {
  Clock,
  Scene,
  WebGLRenderer,
  OrthographicCamera,
  Color,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Line3D from './Line3D.js';
import getCurves from './convert.js';

const scene = new Scene();

const width = window.innerWidth;
const height = window.innerHeight;
const camera = new OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 1, 1000);
camera.zoom = 1000;
camera.position.x = 0;
camera.position.y = 0;
camera.position.z = 2;
camera.updateProjectionMatrix();
camera.updateMatrix();

const renderer = new WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

const clock = new Clock();

const curves = getCurves();
const colors = ['gray', '#b7a12d'];
const lines = curves.map((curve, i) => {
  const line = new Line3D({
    index: 0,
    points: curve,
    color: colors[i],
  });
  scene.add(line);
  return line;
});
scene.background = new Color('#fff');

let progress = 0;

const update = () => {
  if (progress < 1) {
    progress += 0.002;
  }
  lines.forEach((line) => {
    line.material.uniforms.uTime.value = clock.getElapsedTime();
    line.material.uniforms.uDrawing.value = progress;
  });
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(update);
};

update();
