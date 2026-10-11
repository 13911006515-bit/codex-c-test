import './style.css';
import * as THREE from 'three';
import { createFlower, createDust, palettes } from './flower.js';
import { measureHand, smooth } from './gesture.js';

const $ = (id) => document.getElementById(id);
let noticeTimer;
function notify(message) {
  $('notice').textContent = message;
  $('notice').classList.add('visible');
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => $('notice').classList.remove('visible'), 5500);
}
const canvas = $('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
} catch (error) {
  $('fatal').hidden = false;
  $('camera').disabled = true;
  throw error;
}
renderer.setClearColor('#080c10');
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, .1, 60);
camera.position.z = 9;
const flowerGroup = new THREE.Group();
scene.add(flowerGroup);
let flower = createFlower(Number($('density').value), renderer.getPixelRatio());
flowerGroup.add(flower);
const dust = createDust();
scene.add(dust);
// A quiet orbit around the flower anchors the composition without hiding the particles.
const ringMaterial = new THREE.LineBasicMaterial({ color: '#33404a', transparent: true, opacity: .24 });
const ringPoints = Array.from({ length: 161 }, (_, i) => {
  const a = i / 160 * Math.PI * 2;
  return new THREE.Vector3(Math.cos(a) * 2.87, Math.sin(a) * 2.87, -1.1);
});
const orbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPoints), ringMaterial);
flowerGroup.add(orbit);
let width, height, halfWidth, halfHeight, home = new THREE.Vector2();
let target = new THREE.Vector2(), pointer = new THREE.Vector2();
let targetBloom = .82, bloom = .04, manualBloom = .82, automatic = false, holding = false;
let currentPalette = 0;
let cameraState = 'off', stream = null, hands = null, session = 0, framePending = false;
let lastSeen = 0, handFound = false, wasHandFound = false;
let trackingBloom = .82;
const video = $('video');
const landmarkCanvas = $('landmarks');
const landmarkContext = landmarkCanvas.getContext('2d');
function resize() {
  const bounds = $('app').getBoundingClientRect();
  width = bounds.width; height = bounds.height;
  renderer.setSize(width, height, false);
  camera.aspect = width / height; camera.updateProjectionMatrix();
  halfHeight = Math.tan(THREE.MathUtils.degToRad(21)) * camera.position.z;
  halfWidth = halfHeight * camera.aspect;
  // Reserve readable space for text and controls. On mobile the artwork sits between them.
  home.set(width <= 700 ? 0 : width > 1000 ? .04 * halfWidth : .02 * halfWidth,
    width <= 700 ? (1 - 430 / height * 2) * halfHeight : .02 * halfHeight);
  const scale = width <= 700 ? width / height * halfHeight / 3.6 : Math.min(1, width / 1350);
  flowerGroup.scale.setScalar(scale);
  if (cameraState !== 'on') target.copy(home);
}
resize();
window.addEventListener('resize', resize);
canvas.addEventListener('pointermove', (event) => {
  if (cameraState === 'on') return;
  const rect = canvas.getBoundingClientRect();
  pointer.set((event.clientX - rect.left) / width * 2 - 1, 1 - (event.clientY - rect.top) / height * 2);
  target.set(home.x + pointer.x * .48, home.y + pointer.y * .38);
  flower.material.uniforms.uTouch.value.set(pointer.x * 2.5, pointer.y * 2.5);
});
function releasePointer() { holding = false; }
canvas.addEventListener('pointerdown', (event) => {
  if (cameraState === 'on') return;
  holding = true;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
window.addEventListener('blur', releasePointer);
$('bloom').addEventListener('input', () => {
  manualBloom = Number($('bloom').value) / 100;
  automatic = false; $('auto').setAttribute('aria-pressed', 'false');
});
$('auto').addEventListener('click', () => {
  automatic = !automatic;
  $('auto').setAttribute('aria-pressed', String(automatic));
  if (!automatic) $('bloom').value = Math.round(manualBloom * 100);
});
for (const button of document.querySelectorAll('.swatch')) button.addEventListener('click', () => {
  currentPalette = Number(button.dataset.palette);
  for (const swatch of document.querySelectorAll('.swatch')) {
    const active = swatch === button;
    swatch.classList.toggle('selected', active); swatch.setAttribute('aria-pressed', String(active));
  }
  $('palette-name').textContent = palettes[currentPalette].name;
  flower.material.uniforms.uInner.value.set(palettes[currentPalette].inner);
  flower.material.uniforms.uOuter.value.set(palettes[currentPalette].outer);
});
$('density').addEventListener('change', () => {
  const previous = flower;
  flower = createFlower(Number($('density').value), renderer.getPixelRatio());
  flower.material.uniforms.uInner.value.set(palettes[currentPalette].inner);
  flower.material.uniforms.uOuter.value.set(palettes[currentPalette].outer);
  flower.material.uniforms.uBloom.value = bloom;
  flowerGroup.remove(previous); previous.geometry.dispose(); previous.material.dispose(); flowerGroup.add(flower);
});
$('capture').addEventListener('click', () => {
  renderer.render(scene, camera);
  canvas.toBlob((blob) => {
    if (!blob) { notify('画面保存失败，请重试。'); return; }
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `fingertip-bloom-${Date.now()}.png`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); notify('花朵画面已保存。');
  }, 'image/png');
});
let libraryPromise;
function loadHands() {
  if (window.Hands) return Promise.resolve();
  if (!libraryPromise) libraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${import.meta.env.BASE_URL}mediapipe/hands.js`;
    script.onload = () => window.Hands ? resolve() : reject(new Error('MediaPipe 未能初始化'));
    script.onerror = () => { script.remove(); reject(new Error('无法加载本地手势模型，请确认运行了 npm install')); };
    document.head.append(script);
  }).catch(error => { libraryPromise = null; throw error; });
  return libraryPromise;
}
function drawLandmarks(result) {
  if (landmarkCanvas.width !== video.videoWidth || landmarkCanvas.height !== video.videoHeight) {
    landmarkCanvas.width = video.videoWidth || 640; landmarkCanvas.height = video.videoHeight || 480;
  }
  landmarkContext.clearRect(0, 0, landmarkCanvas.width, landmarkCanvas.height);
  const points = result.multiHandLandmarks?.[0];
  const measurement = measureHand(points);
  if (!measurement || cameraState !== 'on') return;
  lastSeen = performance.now(); handFound = true; trackingBloom = measurement.openness;
  target.set(home.x + (measurement.x - .5) * 2.4, home.y + (.5 - measurement.y) * 1.8);
  flower.material.uniforms.uTouch.value.set((measurement.x - .5) * 4, (.5 - measurement.y) * 4);
  landmarkContext.lineWidth = 2; landmarkContext.strokeStyle = '#bcd5a8';
  for (const [a, b] of window.HAND_CONNECTIONS) {
    landmarkContext.beginPath(); landmarkContext.moveTo(points[a].x * landmarkCanvas.width, points[a].y * landmarkCanvas.height);
    landmarkContext.lineTo(points[b].x * landmarkCanvas.width, points[b].y * landmarkCanvas.height); landmarkContext.stroke();
  }
  landmarkContext.fillStyle = '#f5e4b1';
  for (const point of points) {
    landmarkContext.beginPath(); landmarkContext.arc(point.x * landmarkCanvas.width, point.y * landmarkCanvas.height, 3, 0, Math.PI * 2); landmarkContext.fill();
  }
}
function updateMode() {
  const on = cameraState === 'on';
  $('app').classList.toggle('camera-active', on);
  resize();
  $('camera').innerHTML = on ? '<span>◎</span> 关闭摄像头 <span>×</span>' : '<span>◎</span> 开启手势魔法 <span>↗</span>';
  $('mode-text').textContent = on ? '手势交互模式' : '鼠标交互模式';
  $('camera-preview').hidden = !on;
  $('bloom').disabled = on;
  $('auto').disabled = on;
  if (!on && !automatic) $('bloom').value = Math.round(manualBloom * 100);
  $('camera-hint').textContent = on ? '将一只手放入画面。握拳收拢，张手绽放。' : '开启摄像头，用手势控制花朵。也可以移动鼠标，按住让花朵闭合。';
}
async function stopCamera() {
  session++; cameraState = 'off'; handFound = false; wasHandFound = false;
  stream?.getTracks().forEach(track => track.stop()); stream = null;
  video.pause(); video.srcObject = null; target.copy(home);
  const previous = hands; hands = null;
  updateMode();
  if (previous) { try { await previous.close(); } catch { /* A stopped inference may already have released its graph. */ } }
}
function cameraError(error) {
  if (error.name === 'NotAllowedError') return '摄像头权限未开启。请在浏览器的网站权限中允许摄像头，或继续使用鼠标。';
  if (error.name === 'NotFoundError') return '没有找到摄像头。你仍可以用鼠标体验花朵。';
  if (error.name === 'NotReadableError') return '摄像头可能被其他应用占用，请释放后重试。';
  if (error.name === 'AbortError') return '摄像头启动已取消，可以重新开启。';
  return `手势识别暂时不可用：${error.message || '请重试'}。鼠标模式仍可使用。`;
}
$('camera').addEventListener('click', async () => {
  if (cameraState === 'on') { await stopCamera(); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
    notify('摄像头需要安全来源：请在本机 localhost 或 HTTPS 网站打开。'); return;
  }
  $('camera').disabled = true; $('camera').textContent = '正在准备手势识别…';
  cameraState = 'loading';
  const currentSession = ++session;
  try {
    // Ask for camera only after an explicit click. No images are uploaded.
    const acquired = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } });
    if (session !== currentSession) { acquired.getTracks().forEach(track => track.stop()); return; }
    stream = acquired;
    await loadHands();
    if (session !== currentSession) return;
    hands = new window.Hands({ locateFile: file => `${import.meta.env.BASE_URL}mediapipe/${file}` });
    hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: .65, minTrackingConfidence: .6 });
    hands.onResults(result => { if (session === currentSession) drawLandmarks(result); });
    await hands.initialize();
    if (session !== currentSession) return;
    video.srcObject = stream; await video.play();
    cameraState = 'on'; lastSeen = 0; holding = false;
    updateMode();
    const track = stream.getVideoTracks()[0];
    track.addEventListener('ended', () => {
      if (cameraState === 'on') { void stopCamera(); notify('摄像头连接已结束，已恢复鼠标模式。'); }
    });
    notify('摄像头已开启。张开手掌，让花朵绽放。');
  } catch (error) {
    await stopCamera(); notify(cameraError(error));
  } finally { $('camera').disabled = false; if (cameraState !== 'on') updateMode(); }
});
async function inferFrame() {
  if (cameraState !== 'on' || framePending || video.readyState < 2 || document.hidden) return;
  framePending = true;
  try { await hands.send({ image: video }); }
  catch (error) {
    if (cameraState === 'on') { await stopCamera(); notify(cameraError(error)); }
  } finally { framePending = false; }
}
window.addEventListener('pagehide', () => {
  void stopCamera();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && cameraState !== 'off') { void stopCamera(); notify('页面已离开，摄像头已关闭。返回后可重新开启。'); }
});
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let previousTime = performance.now(), start = previousTime, fpsFrames = 0, fpsStart = start, lastInference = 0;
function animate(now) {
  const delta = Math.min((now - previousTime) / 1000, .1); previousTime = now;
  const time = (now - start) / 1000;
  if (cameraState === 'on') {
    if (now - lastSeen > 750) handFound = false;
    if (now - lastInference > 66) { lastInference = now; void inferFrame(); }
    targetBloom = handFound ? trackingBloom : manualBloom;
    if (!handFound) target.copy(home);
    $('tracking-text').textContent = handFound ? (trackingBloom > .6 ? '张开 · 花朵绽放' : trackingBloom < .25 ? '握拳 · 花苞收拢' : '正在缓缓绽放') : '将手放入画面，掌心朝向摄像头';
  } else targetBloom = holding ? 0 : automatic ? .5 + Math.sin(time * .65) * .46 : manualBloom;
  bloom = smooth(bloom, targetBloom, delta, 5);
  flower.material.uniforms.uBloom.value = bloom;
  flower.material.uniforms.uTime.value = reducedMotion ? 0 : time;
  flowerGroup.position.x = smooth(flowerGroup.position.x, target.x, delta, 4);
  flowerGroup.position.y = smooth(flowerGroup.position.y, target.y, delta, 4);
  flower.rotation.x = .20 + (reducedMotion ? 0 : Math.sin(time * .24) * .05);
  flower.rotation.y = .12 + (reducedMotion ? 0 : Math.cos(time * .20) * .08);
  if (!reducedMotion) { flower.rotation.z = time * .025; dust.rotation.z = time * .005; }
  $('bloom-value').textContent = `${Math.round(bloom * 100)}%`;
  if (cameraState === 'on' || automatic) $('bloom').value = Math.round(bloom * 100);
  if (wasHandFound !== handFound) { wasHandFound = handFound; $('mode-dot').style.background = handFound ? '#b8ce9a' : '#7b9298'; }
  const caption = cameraState === 'on' ? handFound ? '光随手动 · 花在指尖绽放' : '等待你的手，进入这一座花园' : holding ? '松开鼠标，让花朵重新绽放' : automatic ? '一呼一吸，花朵缓缓盛开' : '移动鼠标，感受光的流动';
  if ($('gesture-caption').textContent !== caption) $('gesture-caption').textContent = caption;
  renderer.render(scene, camera);
  fpsFrames++;
  if (now - fpsStart > 1000) { $('fps').textContent = `${Math.round(fpsFrames * 1000 / (now - fpsStart))} FPS`; fpsFrames = 0; fpsStart = now; }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
