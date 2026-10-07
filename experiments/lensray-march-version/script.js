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

const IMAGE_URL = './textures/image.jpg';

const renderer = new WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x1a1a2e, 1);
document.body.appendChild(renderer.domElement);

const scene = new Scene();
const camera = new Camera();

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = position.xy;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
const fragmentShader = `
uniform sampler2D uTexture;
uniform vec2 uImagePos;
uniform vec2 uImageSize;
uniform vec2 uViewportAspect;
uniform vec3 uCameraPosition;
uniform vec2 uMousePos;

varying vec2 vUv;

float sdfSphere(vec3 p, float r) {
  return length(p) - r;
}

float getDist(vec3 p) {
  float sd = sdfSphere(p - vec3(0, 0, 6), .5);
  return sd;
}

vec3 getNormal(vec3 p) {
  vec2 eps = vec2(.01, 0);
  
  float d = getDist(p);
  vec3 n = d - vec3(
    getDist(p - eps.xyy),
    getDist(p - eps.yxy),
    getDist(p - eps.yyx)
  );
  return normalize(n);
}

const int MAX_STEPS = 100;
const float MAX_DIST = 100.;
const float SURF_DIST = .01;
const float IOR = 1.22;
const float ABER = 0.02;

float rayMarch(vec3 ro, vec3 rd) {
  float d = 0.;
  for(int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * d;
    float ds = getDist(p);
    d += ds;
    if (ds > MAX_DIST || ds < SURF_DIST) break;
  }
  return d;
}

float hardBounds(vec2 uv) {
  return step(0.0, uv.x) * step(uv.x, 1.0)
       * step(0.0, uv.y) * step(uv.y, 1.0);
}

void main() {
  vec2 localUV = vUv * 0.5 + 0.5;
  localUV = (localUV - uImagePos) / uImageSize;

  vec2 lensUV = (vUv - uMousePos) * uViewportAspect;
  vec3 ro = vec3(0, 0, 0); // uCameraPosition;
  float fovFactor = tan(radians(20.) * 0.5);
  vec3 rd = normalize(vec3(lensUV * fovFactor, .5)); // normalize(vec3(pos.xy, 0.) - uCameraPosition);
  float d = rayMarch(ro, rd);

  vec3 color = texture2D(uTexture, localUV).rgb;
  float mask = hardBounds(localUV);
  color = color * mask;

  if (d < MAX_DIST) {
    // vec3 n = normalize(vec3(lensUV, -1.));
    vec3 p = ro + rd * d;
    vec3 n = getNormal(p);
    vec3 rr = refract(rd, n, 1./(IOR + ABER));
    vec3 rg = refract(rd, n, 1./(IOR));
    vec3 rb = refract(rd, n, 1./(IOR - ABER));

    vec3 dr = rr - rd;
    vec3 dg = rg - rd;
    vec3 db = rb - rd;

    float fresnel = 1. + dot(rd, n);
    float strength = fresnel * 0.45;

    // color = vec3(fresnel);

    vec2 uvR = localUV + dr.xy * strength;
    vec2 uvG = localUV + dg.xy * strength;
    vec2 uvB = localUV + db.xy * strength;
    
    float r = texture2D(uTexture, uvR).r * hardBounds(uvR);
    float g = texture2D(uTexture, uvG).g * hardBounds(uvG);
    float b = texture2D(uTexture, uvB).b * hardBounds(uvB);

    vec3 refracted = vec3(r, g, b);

    float edge = pow(fresnel, 5.) * 0.5;
    color = mix(refracted, vec3(1.), edge);
  }

  gl_FragColor = vec4(color, 1.);
}
`;

const uniforms = {
  uTexture: { value: null },
  uImagePos: { value: new Vector2(0, 0) },
  uImageSize: { value: new Vector2(0, 0) },
  uViewportAspect: { value: new Vector2(0, 0) },
  uCameraPosition: { value: camera.position },
  uMousePos: { value: new Vector2(0, 0) },
};

const geo = new PlaneGeometry(2, 2);
const material = new ShaderMaterial({
  uniforms,
  vertexShader,
  fragmentShader,
});
const mesh = new Mesh(geo, material);
scene.add(mesh);

const resetSize = (tex) => {
  const imageAspect = tex.image.width / tex.image.height;
  const viewAspect = window.innerWidth / window.innerHeight;
  const h = .6;
  const w = h * imageAspect / viewAspect;
  uniforms.uImagePos.value.set((1 - w) / 2, (1 - h) / 2);
  uniforms.uImageSize.value.set(w, h);
  uniforms.uViewportAspect.value.set(viewAspect, 1);
};

let texture = null;
new TextureLoader().load(IMAGE_URL, (tex) => {
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  uniforms.uTexture.value = tex;
  tex.wrapS = tex.wrapT = RepeatWrapping;

  texture = tex;
  resetSize(tex);
  render();
});

const render = () => {
  uniforms.uCameraPosition.value.copy(camera.position);
  renderer.render(scene, camera);
};

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (texture) resetSize(texture);
  render();
});

window.addEventListener('pointermove', (e) => {
  e.preventDefault();
  const x = (e.clientX / window.innerWidth - .5) * 2;
  const y = (e.clientY / window.innerHeight - .5) * 2;
  uniforms.uMousePos.value.set(x, -y);
  render();
});

// (function loop() {
//   requestAnimationFrame(loop);
//   render();
// })();