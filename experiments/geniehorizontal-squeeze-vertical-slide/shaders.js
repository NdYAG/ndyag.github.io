export const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = position.xy * .5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
export const FRAGMENT_SHADER = `
varying vec2 vUv;

uniform sampler2D uTexture;
uniform vec2 uImagePos;
uniform vec2 uImageSize;
uniform float uRangeLeft;
uniform float uRangeRight;
uniform float uProgress;

const float PI = 3.1415926535;

// Cosine interpolation: smoothly blends from y0 to y1 as x goes 0→1
// Produces the organic "bottle neck" curvature
float yPoint(float y0, float y1, float x) {
  float theta = x * PI;
  float t = (1.0 - cos(theta)) * 0.5;
  return mix(y0, y1, t);
}

// Linear remap from [inLow, inHigh] to [outLow, outHigh]
float remap(float val, float inLow, float inHigh, float outLow, float outHigh) {
  float t = (val - inLow) / (inHigh - inLow);
  return mix(outLow, outHigh, t);
}

float easeOutCubic(float x) {
  return 1. - pow(1. - x, 3.);
}

// Returns 1.0 if uv is inside [0,1]x[0,1], 0.0 otherwise
float hardBounds(vec2 uv) {
  return step(0.0, uv.x) * step(uv.x, 1.0)
       * step(0.0, uv.y) * step(uv.y, 1.0);
}

void main() {
  vec2 uv = vUv;

  float p = clamp(0.0, 1.0, uProgress);
  float progress = easeOutCubic(p);

  float hProgress = clamp(progress / 0.4, 0.0, 1.0); // squeeze at 0 - 40%
  float left = mix(0.0, uRangeLeft, hProgress);
  float right = mix(1.0, uRangeRight, hProgress);

  float xLeft = yPoint(left, .0, uv.y);
  float xRight = yPoint(right, 1., uv.y);

  // horizontal squeeze
  float newUvx = remap(uv.x, xLeft, xRight, 0.0, 1.0);

  // vertical slide
  float vProgress = clamp((progress - 0.3) / 0.7, 0.0, 1.0); // slide at 30% - 100%
  float yOffset = mix(0.0, 1.0, vProgress);
  float newUvy = uv.y + yOffset;

  // Convert from quad UV to image-local UV
  vec2 localUV = (vec2(newUvx, newUvy) - uImagePos) / uImageSize;

  // Sample texture, mask to image bounds
  vec4 texColor = texture2D(uTexture, localUV);
  float mask = hardBounds(localUV);

  gl_FragColor = texColor * mask;
}
`;