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
  RGBAFormat,
  UnsignedByteType,
  WebGLRenderTarget,
} from 'three';

const { innerWidth, innerHeight } = window;
const renderer = new WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x1a1a2e, 1);
document.body.appendChild(renderer.domElement);

const scene = new Scene();
const downScene = new Scene();
const upScene = new Scene();
const finalScene = new Scene();
const camera = new Camera();

// const IMAGE_URL = 'https://images.unsplash.com/photo-1568587614489-87fbcdbfdbeb?crop=entropy&cs=srgb&fm=jpg&ixid=M3wzMjM4NDZ8MHwxfHJhbmRvbXx8fHx8fHx8fDE3NzY3ODI2NjJ8&ixlib=rb-4.1.0&q=85';
// const IMAGE_URL = 'https://images.unsplash.com/photo-1524678606370-a47ad25cb82a?crop=entropy&cs=srgb&fm=jpg&ixid=M3wzMjM4NDZ8MHwxfHJhbmRvbXx8fHx8fHx8fDE3NzY4NDk1MDV8&ixlib=rb-4.1.0&q=85';
const IMAGE_URL = './textures/image.jpg';

const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;
const fragmentShader = `
varying vec2 vUv;

uniform sampler2D uTexture;
uniform vec2 uLayerPos[4];
uniform float uLayerScale[4];
uniform float uLayerRot[4];
uniform vec2 uTwistOffset;
uniform float uTwistRadius;
uniform float uTwistAngle;

mat2 rotation2d(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

vec2 layerUv(vec2 st, vec2 offset, float scale, float rotation) {
  vec2 localUv = st - .5 - offset;
  localUv *= rotation2d(-rotation);
  return localUv / scale + .5;
}

vec2 twist(vec2 st, vec2 offset, float radius, float angle) {
  vec2 coord = st - offset;
  float dist = length(coord);

  if (dist < radius) {
    float ratioDist = (radius - dist) / radius;
    float angleMod = ratioDist * ratioDist * angle;
    float s = sin(angleMod);
    float c = cos(angleMod);
    coord = vec2(
                 coord.x * c - coord.y * s,
                 coord.x * s + coord.y * c
                 );
  }

  coord += offset;
  return coord;
}

float hardBounds(vec2 uv) {
  return step(0.0, uv.x) * step(uv.x, 1.0)
       * step(0.0, uv.y) * step(uv.y, 1.0);
}

void main() {
  vec2 uv = vUv;

  uv = twist(uv, uTwistOffset, uTwistRadius, uTwistAngle);

  vec4 color = vec4(.0);
  for (int i = 0; i < 4; i++) {
    vec2 localUv = layerUv(uv, uLayerPos[i], uLayerScale[i], uLayerRot[i]);
    float mask = hardBounds(localUv);
    vec4 texColor = texture2D(uTexture, localUv) * mask;
    color = mix(color, texColor, texColor.a);
  }

  gl_FragColor = color;
}
`;

const uniforms = {
  uTexture: { value: null },
  uLayerPos: {
    value: [
      new Vector2(.1, .1),
      new Vector2(.2, -.2),
      new Vector2(-.2, -.15),
      new Vector2(-.25, .25),
    ],
  },
  uLayerScale: { value: [1.5, 0.8, 0.5, 0.25] },
  // uLayerScale: { value: [.5, .5, .5, .5] },
  uLayerRot: { value: [-.3, .5, .1, .2] },
  uTwistOffset: { value: new Vector2(.5, .5) },
  uTwistRadius: { value: .5 },
  uTwistAngle: { value: -3.14 },
};
const geometry = new PlaneGeometry(2, 2);
const material = new ShaderMaterial({
  vertexShader: vertexShader,
  fragmentShader: fragmentShader,
  uniforms,
});
const mesh = new Mesh(geometry, material);
scene.add(mesh);

// downsample pass
const scale = .5;
const downMaterial = new ShaderMaterial({
  uniforms: {
    uTexture: { value: null },
    uResolution: { value: new Vector2(innerWidth * scale, innerHeight * scale) },
    uOffset: { value: 1.0 }
  },
  vertexShader: vertexShader,
  fragmentShader: `
    varying vec2 vUv;

    uniform sampler2D uTexture;
    uniform vec2 uResolution;
    uniform float uOffset;

    void main() {
      vec2 d = uOffset / uResolution;

      vec4 color = vec4(0.0);

      color += texture2D(uTexture, vUv + vec2( d.x,  d.y));
      color += texture2D(uTexture, vUv + vec2(-d.x,  d.y));
      color += texture2D(uTexture, vUv + vec2( d.x, -d.y));
      color += texture2D(uTexture, vUv + vec2(-d.x, -d.y));

      gl_FragColor = color * 0.25;
    }
  `
});
const downQuad = new Mesh(geometry, downMaterial);
downScene.add(downQuad);

// upsample pass
const upMaterial = new ShaderMaterial({
  uniforms: {
    uTexture: { value: null },
    uResolution: { value: new Vector2(innerWidth, innerHeight) },
    uOffset: { value: 1.0 },
  },
  vertexShader: vertexShader,
  fragmentShader: `
    varying vec2 vUv;

    uniform sampler2D uTexture;
    uniform vec2 uResolution;
    uniform float uOffset;

    void main() {
      vec2 texel = 1.0 / uResolution;
      vec2 d = texel * uOffset;

      vec4 color = vec4(0.0);

      color += texture2D(uTexture, vUv) * 0.25;

      color += texture2D(uTexture, vUv + vec2( d.x, 0.0)) * 0.125;
      color += texture2D(uTexture, vUv + vec2(-d.x, 0.0)) * 0.125;
      color += texture2D(uTexture, vUv + vec2(0.0,  d.y)) * 0.125;
      color += texture2D(uTexture, vUv + vec2(0.0, -d.y)) * 0.125;

      color += texture2D(uTexture, vUv + vec2( d.x,  d.y)) * 0.0625;
      color += texture2D(uTexture, vUv + vec2(-d.x,  d.y)) * 0.0625;
      color += texture2D(uTexture, vUv + vec2( d.x, -d.y)) * 0.0625;
      color += texture2D(uTexture, vUv + vec2(-d.x, -d.y)) * 0.0625;

      gl_FragColor = color;
    }
  `,
});
const upQuad = new Mesh(geometry, upMaterial);
upScene.add(upQuad);

// final scene
const finalMaterial = new ShaderMaterial({
  uniforms: {
    uTexture: { value: null }
  },
  vertexShader: vertexShader,
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D uTexture;

    void main() {
      gl_FragColor = texture2D(uTexture, vUv);
    }
  `
});
const finalQuad = new Mesh(geometry, finalMaterial);
finalScene.add(finalQuad);

const createRenderTarget = (w, h) => {
  const rt = new WebGLRenderTarget(w, h, {
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    format: RGBAFormat,
    type: UnsignedByteType,
  });
  // rt.texture.generateMipmaps = false;
  return rt;
};

const LEVEL = 5;
const DOWNSAMPLE_OFFSET = 1.0;
const UPSAMPLE_OFFSET = 1.5;

const baseTarget = createRenderTarget(innerWidth, innerHeight);
let targets = [];
const buildTargets = (w, h, level = LEVEL) => {
  targets.forEach((t) => t.dispose());
  for(let i = 0; i < level; i++) {
    w = Math.floor(w / 2);
    h = Math.floor(h / 2); 
    targets.push(createRenderTarget(w, h));
  }
};
buildTargets(innerWidth, innerHeight, LEVEL);

const render = () => {
  renderer.setRenderTarget(baseTarget);
  renderer.clear();
  renderer.render(scene, camera);

  // downsample
  let srcTexture = baseTarget.texture;
  for (let i = 0; i < targets.length; i++) {
    const rt = targets[i];
    downMaterial.uniforms.uTexture.value = srcTexture;
    downMaterial.uniforms.uResolution.value.set(
      i === 0 ? innerWidth : targets[i - 1].width,
      i === 0 ? innerHeight : targets[i - 1].height
    );
    downMaterial.uniforms.uOffset.value = DOWNSAMPLE_OFFSET;

    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(downScene, camera);

    srcTexture = rt.texture;
  }

  // upsample
  for (let i = targets.length - 2; i >= 0; i--) {
    const dst = targets[i];
    const src = targets[i + 1];

    upMaterial.uniforms.uTexture.value = src.texture;
    upMaterial.uniforms.uResolution.value.set(src.width, src.height);
    upMaterial.uniforms.uOffset.value = UPSAMPLE_OFFSET;

    renderer.setRenderTarget(dst);
    renderer.clear();
    renderer.render(upScene, camera);
  }

  finalMaterial.uniforms.uTexture.value = targets[1].texture;
  renderer.setRenderTarget(null);
  renderer.clear();
  renderer.render(finalScene, camera);
};

let textureLoad = false;
new TextureLoader().load(IMAGE_URL, (tex) => {
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  uniforms.uTexture.value = tex;
  textureLoad = true;
});

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
});

(function loop() {
  requestAnimationFrame(loop);
  if (textureLoad) {
    uniforms.uLayerRot.value[1] += .002;
    uniforms.uLayerRot.value[2] += .002;
    uniforms.uLayerRot.value[3] += .002;
    uniforms.uLayerPos.value[1].set(
      uniforms.uLayerPos.value[1].x + Math.sin(uniforms.uLayerRot.value[1]) * .0002,
      uniforms.uLayerPos.value[1].y + Math.sin(uniforms.uLayerRot.value[1]) * .0002
    );
    uniforms.uLayerPos.value[3].set(
      uniforms.uLayerPos.value[3].x - Math.sin(uniforms.uLayerRot.value[3]) * .0001,
      uniforms.uLayerPos.value[3].y - Math.sin(uniforms.uLayerRot.value[3]) * .0001
    );
    render();
  }
})();