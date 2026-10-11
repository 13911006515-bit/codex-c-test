import * as THREE from 'three';
export const palettes = [
  { name: '暮色鸢尾', inner: '#f5c1a3', outer: '#a5a5f4' },
  { name: '玫瑰余晖', inner: '#ffe0b4', outer: '#ef87b4' },
  { name: '薄荷微光', inner: '#e6eab9', outer: '#79d6c6' },
  { name: '琥珀日光', inner: '#fff1cf', outer: '#e8ac6c' },
];
const vertexShader = `
attribute vec3 aBud;
attribute float aSeed;
attribute float aRadius;
uniform float uBloom;
uniform float uTime;
uniform float uPixelRatio;
uniform vec2 uTouch;
varying float vSeed;
varying float vRadius;
void main(){
  vec3 p = mix(aBud, position, smoothstep(0.0, 1.0, uBloom));
  float wave = sin(uTime * 0.7 + aSeed * 28.0 + p.x * 1.3);
  p.z += wave * 0.035 * (0.2 + uBloom);
  p.xy += vec2(sin(uTime * .3 + aSeed * 12.0), cos(uTime * .4 + aSeed * 9.0)) * .018;
  float influence = exp(-length(p.xy - uTouch) * 1.3);
  p.z += influence * .12 * uBloom;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp((2.0 + aSeed * 1.8) * uPixelRatio * (7.0 / -mv.z), 1.0, 9.0);
  vSeed = aSeed;
  vRadius = aRadius;
}`;
const fragmentShader = `
uniform vec3 uInner;
uniform vec3 uOuter;
uniform float uBloom;
varying float vSeed;
varying float vRadius;
void main(){
  float d = length(gl_PointCoord - .5) * 2.;
  if(d > 1.) discard;
  vec3 color = mix(uInner, uOuter, smoothstep(.08, .9, vRadius));
  color += vec3(.1) * vSeed;
  float alpha = pow(1. - d, 1.65) * (.60 + vSeed * .60);
  gl_FragColor = vec4(color, alpha);
}`;
export function createFlower(count, pixelRatio = 1) {
  const position = new Float32Array(count * 3);
  const bud = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const radius = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // Four nested whorls of curved petals; random sampling fills each surface.
    const layer = i % 4;
    const petals = [8, 10, 12, 14][layer];
    const petal = Math.floor(Math.random() * petals);
    const t = Math.pow(Math.random(), 0.72);
    const across = (Math.random() - .5) * 2;
    const length = [0.95, 1.45, 1.95, 2.45][layer];
    const angle = petal * Math.PI * 2 / petals + layer * .29;
    const width = Math.pow(Math.sin(Math.PI * t), .8) * (.29 + layer * .09);
    const r = .06 + t * length;
    const x = r * Math.cos(angle) + across * width * Math.cos(angle + Math.PI / 2);
    const y = r * Math.sin(angle) + across * width * Math.sin(angle + Math.PI / 2);
    const z = .08 + (3 - layer) * .09 + Math.sin(t * Math.PI) * (.38 + .035 * layer) + across * across * .18 - Math.pow(t, 3) * .34;
    const jitter = () => (Math.random() - .5) * .025;
    position.set([x + jitter(), y + jitter(), z + jitter()], i * 3);
    const budR = (.12 + Math.sin(t * Math.PI) * .3) * (1 + layer * .05);
    bud.set([Math.cos(angle) * budR + across * width * .12, (t - .4) * 1.35, Math.sin(angle) * budR], i * 3);
    seed[i] = Math.random();
    radius[i] = r / 2.5;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aBud', new THREE.BufferAttribute(bud, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geometry.setAttribute('aRadius', new THREE.BufferAttribute(radius, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uBloom: { value: .82 }, uTime: { value: 0 }, uPixelRatio: { value: pixelRatio },
      uInner: { value: new THREE.Color(palettes[0].inner) }, uOuter: { value: new THREE.Color(palettes[0].outer) },
      uTouch: { value: new THREE.Vector2(0, 0) },
    },
    vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}
export function createDust() {
  const position = new Float32Array(650 * 3);
  for (let i = 0; i < 650; i++) position.set([(Math.random() - .5) * 22, (Math.random() - .5) * 15, -1 - Math.random() * 7], i * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ size: .012, color: '#7f8d9c', transparent: true, opacity: .48, depthWrite: false }));
}
