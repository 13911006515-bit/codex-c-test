import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { access, mkdir } from 'node:fs/promises';
const url = process.env.BLOOM_TEST_URL || 'http://localhost:5173';
const artifacts = process.env.BLOOM_ARTIFACTS || '/tmp/fingertip-bloom-artifacts';
await mkdir(artifacts, { recursive: true });
let executablePath = process.env.BLOOM_CHROMIUM;
if (!executablePath) { try { await access('/usr/bin/chromium'); executablePath = '/usr/bin/chromium'; } catch { /* Use Playwright's installed Chromium. */ } }
const browser = await chromium.launch({ executablePath, headless: true, args: [
  '--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
] });
const failures = [];
function observe(page) {
  page.on('pageerror', error => failures.push(error.message));
  page.on('console', message => { if(message.type() === 'error') failures.push(message.text()); });
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  observe(page);
  await page.goto(url);
  await page.waitForFunction(() => Number.parseInt(document.getElementById('bloom-value').textContent) >= 78, null, {timeout:30000});
  assert.equal(await page.locator('#fatal').isVisible(), false);
  assert.equal(await page.locator('#density').inputValue(), '24000');
  // Check rendered pixels, not just a live canvas or an open port.
  assert.ok(await page.evaluate(() => {
    const target=document.createElement('canvas');target.width=160;target.height=100;
    const context=target.getContext('2d');context.drawImage(document.getElementById('scene'),0,0,160,100);
    const data=context.getImageData(50,15,75,70).data;
    let lit=0;for(let i=0;i<data.length;i+=4)if(data[i]+data[i+1]+data[i+2]>100)lit++;
    return lit>100;
  }), 'Particle flower must have visible rendered pixels');
  await page.screenshot({ path: `${artifacts}/desktop.png` });
  await page.mouse.move(720,500);await page.mouse.down();
  await page.waitForFunction(() => Number.parseInt(document.getElementById('bloom-value').textContent)<10, null, {timeout:20000});
  await page.mouse.up();
  await page.waitForFunction(() => Number.parseInt(document.getElementById('bloom-value').textContent)>70, null, {timeout:20000});
  await page.locator('[data-palette="2"]').click();assert.equal(await page.locator('#palette-name').textContent(),'薄荷微光');
  await page.locator('#density').selectOption('12000');
  await page.locator('#bloom').fill('35');
  await page.waitForFunction(() => Math.abs(Number.parseInt(document.getElementById('bloom-value').textContent)-35)<3, null, {timeout:20000});
  await page.locator('#auto').click();assert.equal(await page.locator('#auto').getAttribute('aria-pressed'),'true');
  await page.locator('#auto').click();assert.equal(await page.locator('#bloom').inputValue(),'35');
  const downloaded=page.waitForEvent('download');await page.locator('#capture').click();
  assert.ok((await downloaded).suggestedFilename().endsWith('.png'));
  console.log('PASS: visible WebGL particles, mouse close/open, palette, density, slider, breathing, PNG download');
  await page.locator('[data-palette="0"]').click();
  await page.locator('#bloom').fill('82');
  await page.waitForFunction(()=>Number.parseInt(document.getElementById('bloom-value').textContent)>78,null,{timeout:20000});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await page.screenshot({path:`${artifacts}/mobile.png`,fullPage:true});
  console.log('PASS: mobile layout without horizontal overflow');
  // Actual bundled MediaPipe runtime with Chromium's fake video stream.
  await page.locator('#camera').click();
  await page.waitForFunction(()=>document.getElementById('mode-text').textContent==='手势交互模式', null, {timeout:60000});
  await page.waitForFunction(()=>document.getElementById('landmarks').width===640, null, {timeout:60000});
  assert.equal(await page.locator('#bloom').isDisabled(),true);
  assert.ok(await page.evaluate(()=>document.querySelector('.panel').getBoundingClientRect().bottom <= document.querySelector('footer').getBoundingClientRect().top),'Mobile camera preview must not cover the footer or clip controls');
  await page.screenshot({path:`${artifacts}/mobile-camera.png`,fullPage:true});
  await page.locator('#camera').click();
  await page.waitForFunction(()=>document.getElementById('mode-text').textContent==='鼠标交互模式');
  assert.ok(await page.evaluate(()=>document.getElementById('video').srcObject===null));
  console.log('PASS: local MediaPipe WASM initialization, video inference, camera stop, mouse fallback');
  await page.close();
  // Deterministic landmarks exercise the full camera-result-to-animation path.
  const gestures=await browser.newPage({viewport:{width:1000,height:800}});observe(gestures);
  await gestures.addInitScript(()=>{
    window.fixtureOpen=true;window.HAND_CONNECTIONS=[[0,9],[5,8],[9,12],[13,16],[17,20]];
    window.Hands=class{
      setOptions(){}onResults(callback){this.callback=callback}async initialize(){}async close(){}
      async send(){
        const points=Array.from({length:21},()=>({x:.5,y:.65,z:0}));points[0]={x:.5,y:.9,z:0};
        for(const [base,tip] of [[5,8],[9,12],[13,16],[17,20]]){
          points[base]={x:.5+(base-9)*.01,y:.65,z:0};
          points[tip]={x:points[base].x,y:window.fixtureOpen?.36:.76,z:0};
        }
        this.callback({multiHandLandmarks:[points]});
      }
    };
  });
  await gestures.goto(url);await gestures.locator('#camera').click();
  await gestures.waitForFunction(()=>Number.parseInt(document.getElementById('bloom-value').textContent)>92,null,{timeout:30000});
  await gestures.evaluate(()=>window.fixtureOpen=false);
  await gestures.waitForFunction(()=>Number.parseInt(document.getElementById('bloom-value').textContent)<8,null,{timeout:30000});
  await gestures.locator('#camera').click();await gestures.close();
  console.log('PASS: simulated open palm blooms and fist closes through camera integration');
  const denied=await browser.newPage();observe(denied);
  await denied.addInitScript(()=>{ navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError')}; });
  await denied.goto(url);await denied.locator('#camera').click();
  await denied.waitForFunction(()=>document.getElementById('notice').textContent.includes('权限未开启'));
  assert.equal(await denied.locator('#mode-text').textContent(),'鼠标交互模式');
  assert.equal(await denied.locator('#camera').isEnabled(),true);
  await denied.close();console.log('PASS: permission denial handled with usable mouse fallback');
  assert.deepEqual(failures,[],'Browser must have no console errors or uncaught exceptions');
  console.log(`Browser checks complete. Screenshots: ${artifacts}`);
} finally { await browser.close(); }
