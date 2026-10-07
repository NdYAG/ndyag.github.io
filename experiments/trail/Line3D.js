import { Mesh, ShaderMaterial, Vector2, Vector3, Vector4, Color, DoubleSide } from 'three';
import LineGeometry from './LineGeometry.js';

const vertexShader = `
attribute vec3 previous;
attribute vec3 next;
attribute float side;
attribute float width;
// attribute vec2 uv2;


uniform vec4 uWiggle;
uniform vec3 uColor;
uniform vec2 uTip;
uniform float uThickness;
uniform float uDrawing;
uniform float uErasing;
uniform float uExtraDrawing;
uniform float uMouseFluid;
uniform float uIntro;
uniform float uOpacity;
uniform float uEnd;
uniform float uTime;


varying vec2 vUv;
// varying vec2 vUv2;
// varying float vWidth;
// varying float vDist;




float range(float oldValue, float oldMin, float oldMax, float newMin, float newMax) {
    vec3 sub = vec3(oldValue, newMax, oldMax) - vec3(oldMin, newMin, oldMin);
    return sub.x * sub.y / sub.z + newMin;
}

vec2 range(vec2 oldValue, vec2 oldMin, vec2 oldMax, vec2 newMin, vec2 newMax) {
    vec2 oldRange = oldMax - oldMin;
    vec2 newRange = newMax - newMin;
    vec2 val = oldValue - oldMin;
    return val * newRange / oldRange + newMin;
}

vec3 range(vec3 oldValue, vec3 oldMin, vec3 oldMax, vec3 newMin, vec3 newMax) {
    vec3 oldRange = oldMax - oldMin;
    vec3 newRange = newMax - newMin;
    vec3 val = oldValue - oldMin;
    return val * newRange / oldRange + newMin;
}

float crange(float oldValue, float oldMin, float oldMax, float newMin, float newMax) {
    return clamp(range(oldValue, oldMin, oldMax, newMin, newMax), min(newMin, newMax), max(newMin, newMax));
}

vec2 crange(vec2 oldValue, vec2 oldMin, vec2 oldMax, vec2 newMin, vec2 newMax) {
    return clamp(range(oldValue, oldMin, oldMax, newMin, newMax), min(newMin, newMax), max(newMin, newMax));
}

vec3 crange(vec3 oldValue, vec3 oldMin, vec3 oldMax, vec3 newMin, vec3 newMax) {
    return clamp(range(oldValue, oldMin, oldMax, newMin, newMax), min(newMin, newMax), max(newMin, newMax));
}

float rangeTransition(float t, float x, float padding) {
    float transition = crange(t, 0.0, 1.0, -padding, 1.0 + padding);
    return crange(x, transition - padding, transition + padding, 1.0, 0.0);
}

float getNoise(vec2 uv, float time) {
    float x = uv.x * uv.y * time * 1000.0;
    x = mod(x, 13.0) * mod(x, 123.0);
    float dx = mod(x, 0.01);
    float amount = clamp(0.1 + dx * 100.0, 0.0, 1.0);
    return amount;
}


#define sinf sin

highp float getRandom(vec2 co) {
    highp float a = 12.9898;
    highp float b = 78.233;
    highp float c = 43758.5453;
    highp float dt = dot(co.xy, vec2(a, b));
    highp float sn = mod(dt, 3.14);
    return fract(sin(sn) * c);
}

float cnoise(vec3 v) {
    float t = v.z * 0.3;
    v.y *= 0.8;
    float noise = 0.0;
    float s = 0.5;
    noise += (sinf(v.x * 0.9 / s + t * 10.0) + sinf(v.x * 2.4 / s + t * 15.0) + sinf(v.x * -3.5 / s + t * 4.0) + sinf(v.x * -2.5 / s + t * 7.1)) * 0.3;
    noise += (sinf(v.y * -0.3 / s + t * 18.0) + sinf(v.y * 1.6 / s + t * 18.0) + sinf(v.y * 2.6 / s + t * 8.0) + sinf(v.y * -2.6 / s + t * 4.5)) * 0.3;
    return noise;
}

float cnoise(vec2 v) {
    float t = v.x * 0.3;
    v.y *= 0.8;
    float noise = 0.0;
    float s = 0.5;
    noise += (sinf(v.x * 0.9 / s + t * 10.0) + sinf(v.x * 2.4 / s + t * 15.0) + sinf(v.x * -3.5 / s + t * 4.0) + sinf(v.x * -2.5 / s + t * 7.1)) * 0.3;
    noise += (sinf(v.y * -0.3 / s + t * 18.0) + sinf(v.y * 1.6 / s + t * 18.0) + sinf(v.y * 2.6 / s + t * 8.0) + sinf(v.y * -2.6 / s + t * 4.5)) * 0.3;
    return noise;
}
uniform sampler2D tFluid;
uniform sampler2D tFluidMask;

vec2 getFluidVelocity() {
    float fluidMask = smoothstep(0.1, 0.7, texture2D(tFluidMask, vUv).r);
    return texture2D(tFluid, vUv).xy * fluidMask;
}

vec3 getFluidVelocityMask() {
    float fluidMask = smoothstep(0.1, 0.7, texture2D(tFluidMask, vUv).r);
    return vec3(texture2D(tFluid, vUv).xy * fluidMask, fluidMask);
}
vec2 frag_coord(vec4 glPos) {
    return ((glPos.xyz / glPos.w) * 0.5 + 0.5).xy;
}

vec2 getProjection(vec3 pos, mat4 projMatrix) {
    vec4 mvpPos = projMatrix * vec4(pos, 1.0);
    return frag_coord(mvpPos);
}

void applyNormal(inout vec3 pos, mat4 projNormalMatrix) {
    vec3 transformed = vec3(projNormalMatrix * vec4(pos, 0.0));
    pos = transformed;
}

vec2 fix(vec4 i, float aspect) {
    vec2 res = i.xy / i.w;
    res.x *= aspect;
    return res;
}

const float startWiggleFluid = 0.05;

void main() {
    float drawing = uDrawing + uExtraDrawing;
    // float aspect = resolution.x / resolution.y;
    float aspect = 1.0;

    vec3 pos = position;
    vec3 prevPos = previous;
    vec3 nextPos = next;
    float lineWidth = 1.0;
    float thickness = uThickness;

    // Tip is thinner
    if (uEnd < 0.5) {
        lineWidth *= crange(drawing - uv.x, uTip.x * 0.0009, 0.0, 1.0, uTip.y);
    }

    vec4 wPos = modelViewMatrix * vec4(pos, 1.0);
    mat4 m = projectionMatrix * modelViewMatrix;
    vec4 finalPosition = m * vec4(pos, 1.0);
    vec4 pPos = m * vec4(prevPos, 1.0);
    vec4 nPos = m * vec4(nextPos, 1.0);

    float wiggleFluidForce = crange(uv.x, startWiggleFluid, startWiggleFluid + 0.02, 0.0, 1.0);

    if (uIntro < 0.5 && uEnd < 0.5) {
        // boost
      float boost = sin(uTime * 3.0 - uv.x * 800.0);
      // float boost = 1.0;
        boost = boost * 0.5 + 0.5;
        boost *= wiggleFluidForce;
        lineWidth += boost * 0.4;
    }

    vec3 fluid = vec3(0.0);
    /* #test Tests.useMouseFluid() */
        if (uIntro < 0.5 && uEnd < 0.5) {
            vec2 screenUV = getProjection(wPos.xyz, projectionMatrix);
            vec3 flow = vec3(texture2D(tFluid, screenUV).xy, 0.0);
            fluid = flow * 0.001 * uMouseFluid * texture2D(tFluidMask, screenUV).r;
        }
    /* #endtest */

    fluid *= wiggleFluidForce;
    lineWidth += length(fluid.xy) * 1.3;

    vec2 currentP = fix(finalPosition, aspect);
    vec2 prevP = fix(pPos, aspect);
    vec2 nextP = fix(nPos, aspect);

    float w = 0.005 * thickness * width * lineWidth;

    // vec2 dirNC = normalize(currentP - prevP);
    // vec2 dirPC = normalize(nextP - currentP);

    // vec2 dir1 = normalize(currentP - prevP);
    // vec2 dir2 = normalize(nextP - currentP);
    // vec2 dirF = normalize(dir1 + dir2);

    // vec2 dirM = mix(dirPC, dirNC, when_eq(nextP, currentP));
    // vec2 dir = mix(dirF, dirM, clamp(when_eq(nextP, currentP) + when_eq(prevP, currentP), 0.0, 1.0));
    vec2 dirNC = currentP - prevP;
    vec2 dirPC = nextP - currentP;
    if (length(dirNC) >= 0.0001) dirNC = normalize(dirNC);
    if (length(dirPC) >= 0.0001) dirPC = normalize(dirPC);
    vec2 dir = normalize(dirNC + dirPC);

    vec2 normal = vec2(-dir.y, dir.x);
    normal.x /= aspect;
    normal *= 0.5 * w;

    finalPosition.xy += normal * side;

    finalPosition.xy += fluid.xy;

    /* #test Tests.wireWiggle() */
        if (uIntro < 0.5 && uEnd < 0.5) {
            vec3 seed = pos.xyz * uWiggle.x;
            seed += uv.x * uWiggle.y;
            seed += uTime * uWiggle.z;

            float noise = cnoise(seed) * uWiggle.w;
            // finalPosition.xyz += noise * wiggleFluidForce;
            finalPosition.xy += noise * wiggleFluidForce;
        }
    /* #endtest */

    gl_Position = finalPosition;

    vUv = uv;
    // vUv2 = uv2;
    // vWidth = w;
    // vDist = finalPosition.z / 10.0;
}

`;

const fragmentShader = `
uniform vec4 uWiggle;
uniform vec3 uColor;
uniform vec2 uTip;
uniform float uThickness;
uniform float uDrawing;
uniform float uErasing;
uniform float uExtraDrawing;
uniform float uMouseFluid;
uniform float uIntro;
uniform float uOpacity;
uniform float uEnd;


varying vec2 vUv;
// varying vec2 vUv2;
// varying float vWidth;
// varying float vDist;




float range(float oldValue, float oldMin, float oldMax, float newMin, float newMax) {
    vec3 sub = vec3(oldValue, newMax, oldMax) - vec3(oldMin, newMin, oldMin);
    return sub.x * sub.y / sub.z + newMin;
}

vec2 range(vec2 oldValue, vec2 oldMin, vec2 oldMax, vec2 newMin, vec2 newMax) {
    vec2 oldRange = oldMax - oldMin;
    vec2 newRange = newMax - newMin;
    vec2 val = oldValue - oldMin;
    return val * newRange / oldRange + newMin;
}

vec3 range(vec3 oldValue, vec3 oldMin, vec3 oldMax, vec3 newMin, vec3 newMax) {
    vec3 oldRange = oldMax - oldMin;
    vec3 newRange = newMax - newMin;
    vec3 val = oldValue - oldMin;
    return val * newRange / oldRange + newMin;
}

float crange(float oldValue, float oldMin, float oldMax, float newMin, float newMax) {
    return clamp(range(oldValue, oldMin, oldMax, newMin, newMax), min(newMin, newMax), max(newMin, newMax));
}

vec2 crange(vec2 oldValue, vec2 oldMin, vec2 oldMax, vec2 newMin, vec2 newMax) {
    return clamp(range(oldValue, oldMin, oldMax, newMin, newMax), min(newMin, newMax), max(newMin, newMax));
}

vec3 crange(vec3 oldValue, vec3 oldMin, vec3 oldMax, vec3 newMin, vec3 newMax) {
    return clamp(range(oldValue, oldMin, oldMax, newMin, newMax), min(newMin, newMax), max(newMin, newMax));
}

float rangeTransition(float t, float x, float padding) {
    float transition = crange(t, 0.0, 1.0, -padding, 1.0 + padding);
    return crange(x, transition - padding, transition + padding, 1.0, 0.0);
}

float aastep(float threshold, float value) {
    float afwidth = length(vec2(dFdx(value), dFdy(value))) * 0.70710678118654757;
    return smoothstep(threshold-afwidth, threshold+afwidth, value);
}

float aastep(float threshold, float value, float padding) {
    return smoothstep(threshold - padding, threshold + padding, value);
}

vec2 aastep(vec2 threshold, vec2 value) {
    return vec2(
        aastep(threshold.x, value.x),
        aastep(threshold.y, value.y)
    );
}

float tri(float v) {
    return mix(v, 1.0 - v, step(0.5, v)) * 2.0;
}

void main() {
    float drawing = uDrawing + uExtraDrawing;
    float signedDist = tri(vUv.y) - 0.5;
    float w = clamp(signedDist/fwidth(signedDist) + 0.5, 0.0, 1.0);

    if (w <= 0.3) {
        discard;
        return;
    }

    vec4 color = vec4(uColor, w);
    float draw = 1.0 - step(drawing, vUv.x);
    draw *= step(uErasing, vUv.x);

    if (draw < 0.5) {
        discard;
    }

    if (uOpacity < 1.0) {
        // Fade out line using uv
        float drawingUV = crange(vUv.x, drawing - 0.1, uDrawing, 0.0, 1.0);
        color.a = rangeTransition(uOpacity, drawingUV, 0.4);
    }

    if(color.a <= 0.0) {
        discard;
    }

    gl_FragColor = color;
    // gl_FragColor.a = 0.3;
}
`;

class Line3D {
  constructor({ index = 0, points = [], color = '#333' }) {
    const geometry = new LineGeometry({
      index,
      points,
    })
    const shader = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uDrawing: {
          value: 1.0,
        },
        uExtraDrawing: {
          value: 0,
        },
        uErasing: {
          value: 0,
        },
        uIntro: {
          value: 1,
        },
        uEnd: {
          value: .3,
        },
        uThickness: {
          value: 1.5,
        },
        uColor: {
          value: new Color(color),
        },
        uMouseFluid: {
          value: .1,
        },
        uTip: {
          value: new Vector2(100, .01),
        },
        uWiggle: {
          value: new Vector4(.4, 3, .2, .07),
        },
        uOpacity: {
          value: 1,
        },
        uTime: {
          value: 0,
        },
      },
      transparent: true,
      side: DoubleSide,
    })
    const mesh = new Mesh(geometry, shader)
    mesh.rotateOnAxis(new Vector3(1, 0, 0), Math.PI)
    return mesh
  }
}

export default Line3D;
