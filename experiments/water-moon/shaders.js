const waves = `
// return value is (height, dh/dx, dh/dz)
uniform float uTime;
uniform float uWave;
// p: point, k: wave vector, a: amplitude, speed: 
void addWave(inout vec3 f, vec2 p, vec2 k, float a, float speed,
             float phase, vec2 footprint) {
  float filterWidth = dot(abs(k), footprint);
  a *= exp(-0.35 * filterWidth * filterWidth);
  float q = dot(p, k) - uTime * speed + phase;
  f += vec3(a * sin(q), a * cos(q) * k);
}

vec3 waveField(vec2 p, vec2 footprint, float detail) {
  vec2 stretch = vec2(1.80, 1.95);
  p *= stretch; footprint *= stretch;
  float wa = 0.81 * p.x - 0.09 * uTime;
  float wb = 1.91 * p.x + 0.43 * p.y + 0.12 * uTime;
  float wc = 0.54 * p.y + 0.08 * uTime;
  vec2 q = p + vec2(0.13 * sin(wc), 0.22 * sin(wa) + 0.095 * sin(wb));
  vec3 f = vec3(0.0);
  addWave(f,q,vec2( 1.95, 4.10),0.0270,0.66,0.2,footprint);
  addWave(f,q,vec2(-2.40, 6.60),0.0210,0.84,1.7,footprint);
  addWave(f,q,vec2( 3.85, 9.70),0.0120,1.10,4.2,footprint);
  addWave(f,q,vec2(-4.69,14.60),0.0080,1.26,2.4,footprint);
  addWave(f,q,vec2( 6.75,20.30),0.0050,1.48,0.8,footprint);
  addWave(f,q,vec2(-3.30,28.10),0.0031,1.69,3.1,footprint);
  addWave(f,q,vec2( 5.21,39.70),0.0018*detail,2.10,4.5,footprint);
  addWave(f,q,vec2(-6.34,52.50),0.0012*detail,2.37,1.2,footprint);
  addWave(f,q,vec2( 8.13,68.10),0.0007*detail,2.70,5.6,footprint);
  addWave(f,q,vec2(11.40, 3.10),0.0036*detail,1.35,2.8,footprint);
  // Apply the Jacobian of the domain warp to its analytic gradient.
  vec2 g = vec2(
    f.y + f.z * (0.1782 * cos(wa) + 0.18145 * cos(wb)),
    f.y * 0.0702 * cos(wc) + f.z * (1.0 + 0.04085 * cos(wb))
  );
  return vec3(f.x, g * stretch) * (uWave * 0.51);
}
`;

const lighting = `
uniform float uGloss;
#include <common>
#include <lights_pars_begin>

vec3 whiteHighlights(vec3 worldNormal, vec3 worldView) {
  vec3 N = normalize(mat3(viewMatrix) * worldNormal);
  vec3 V = normalize(mat3(viewMatrix) * worldView);
  vec3 dx = dFdx(N), dy = dFdy(N);
  float variance = 0.12 * (dot(dx,dx) + dot(dy,dy));
  float power = 310.0 * max(uGloss,0.01);
  float filteredPower = 1.0 / (1.0/power + variance);
  vec3 sum = vec3(0.0);
  #if NUM_DIR_LIGHTS > 0
    for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
      vec3 H = normalize(directionalLights[i].direction + V);
      float a = max(dot(N,H), 0.0);
      sum += directionalLights[i].color * pow(a, filteredPower)
           * sqrt(filteredPower / power);
    }
  #endif
  return sum;
}
float waterFresnel(vec3 N, vec3 V) {
  return 0.0204 + 0.9796 * pow(1.0-max(dot(N,V),0.0),5.0);
}
vec3 greenEnvironment(vec3 N, vec3 V, float fresnel) {
  vec3 reflected = reflect(-V,N);
  float gradient = smoothstep(-0.2,0.8,reflected.y);
  return mix(vec3(0.08,0.14,0.09),vec3(0.51,0.61,0.43),gradient)
       * fresnel;
}
vec3 waterBody(vec3 p, float fresnel) {
  return vec3(0.014,0.055,0.034) * (0.82+0.18*sin(p.x*0.45+p.z*0.25))
       * (1.0-fresnel);
}
`;

export const vertex_water = `
uniform vec2 uGridSpacing;
varying vec3 vWorldPosition;
varying vec2 vLocalPlane;
${waves}

void main() {
  // PlaneGeometry starts in local XY. mesh.rotation.x = -PI/2 turns
  // local +Z into world +Y. Keep this water mesh at unit scale.
  vec3 displaced = position;
  vec3 baseWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  // Filter waves the finite mesh cannot resolve. Micro detail stays in fragment.
  displaced.z += waveField(baseWorld.xz, uGridSpacing, 0.0).x;
  vLocalPlane = position.xy;
  vWorldPosition = (modelMatrix * vec4(displaced, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`;
export const fragment_water = `
uniform sampler2D tDiffuse;
uniform mat4 textureMatrix;
uniform float uDetail;
varying vec3 vWorldPosition;
varying vec2 vLocalPlane;
${waves}
${lighting}

vec3 reflectedScene(vec3 N) {
  // Reflector's textureMatrix already includes the water model matrix.
  // Local XY = world X,-Z because the mesh is rotated by -PI/2 about X.
  // Move the lookup point on the MEAN plane, not the reflected geometry itself.
  // This is a planar-reflection + normal-distortion approximation, NOT ray tracing.
  vec2 offset = vec2(N.x,-N.z) * 0.8; // distortion
  vec4 projected = textureMatrix*vec4(vLocalPlane+offset,0.0,1.0);
  vec2 uv = projected.xy/max(projected.w,0.0001);
  vec2 border = smoothstep(vec2(0.0),vec2(0.012),uv)
              * (1.0-smoothstep(vec2(0.988),vec2(1.0),uv));
  float valid = border.x*border.y*step(0.0,projected.w);
  // The target was cleared to transparent black. Its RGB already contains
  // alpha-composited lunar radiance: do NOT multiply by texture alpha again.
  return texture2D(tDiffuse,clamp(uv,vec2(0.0),vec2(1.0))).rgb*valid;
}

void main() {
  vec3 p = vWorldPosition; // equal to baseWorld.xz; (local plane.z is worldPos.y)
  vec2 footprint = abs(dFdx(p.xz)) + abs(dFdy(p.xz));
  vec3 field = waveField(p.xz, footprint, uDetail);

  vec3 N = normalize(vec3(-field.y, 1.0, -field.z));
  vec3 V = normalize(cameraPosition - p);
  float fresnel = waterFresnel(N, V);
  vec3 glitter = whiteHighlights(N, V);
  vec3 environment = greenEnvironment(N, V, fresnel);
  vec3 mirror = reflectedScene(N) * (0.30 + 2.0* fresnel);
  vec3 body = waterBody(p, fresnel);
  vec3 color = body + environment + glitter + mirror;

  // float height = clamp(0.5 + field.x * 11.0, 0.0, 1.0);
  // vec3 color = mix(vec3(0.022,0.075,0.062), vec3(0.73,0.75,0.57), height);

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

export const vertex_moon = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}
`;

export const fragment_moon = `
#define PI 3.141592653589793
uniform sampler2D uLunarMap;
uniform float uPhase;
uniform float uRoll;
varying vec2 vUv;

void main() {
  vec2 p = vUv * 2.0 - 1.0; // [-1, 1]
  float rr = dot(p, p);
  vec3 sphereN = vec3(p, sqrt(max(1.0 - rr, 0.0))); // generate a sphere normal: (p.x, p.y, sqrt(1 - rr))
  float edgeAA = clamp(fwidth(rr), 0.002, 0.15);
  float disk   = 1.0 - smoothstep(1.0 - edgeAA, 1.0 + edgeAA, rr);

  vec3 L = vec3(sin(uPhase) * cos(uRoll),
                sin(uPhase) * sin(uRoll),
                cos(uPhase));
  float mu = dot(sphereN,L);

  float phaseAA   = clamp(fwidth(mu) * 0.65, 0.002, 0.15);
  float phaseMask = smoothstep(-phaseAA, phaseAA, mu);

  // full moon
  vec2 tuv = vec2(
    atan(sphereN.x, sphereN.z) / (2.0 * PI) + 0.5,
    asin(clamp(sphereN.y, -1.0, 1.0)) / PI + 0.5);
  float raw = texture2D(uLunarMap,tuv).r;

  float stone = smoothstep(0.40, 0.91, raw);
  vec3 gold = mix(vec3(0.24,0.12,0.035), vec3(1.44,1.0,0.43), stone);
  float relief = 0.77+0.23*pow(max(mu,0.0),0.45);

  vec3 color = gold * relief * 1.7;
  float alpha = disk * phaseMask;

  if (alpha < 0.001) discard;
  gl_FragColor = vec4(color, alpha);
}
`;
