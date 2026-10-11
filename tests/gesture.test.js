import test from 'node:test';
import assert from 'node:assert/strict';
import { measureHand, smooth } from '../src/gesture.js';
function hand(open) {
  const points = Array.from({length:21}, () => ({x:.5,y:.65,z:0}));
  points[0] = {x:.5,y:.9,z:0};
  for(const [base,tip] of [[5,8],[9,12],[13,16],[17,20]]) {
    points[base] = {x:.5+(base-9)*.01,y:.65,z:0};
    points[tip] = {x:points[base].x,y:open ? .36 : .76,z:0};
  }
  return points;
}
test('open palm blooms and fist closes',()=>{
  assert.ok(measureHand(hand(true)).openness > .95);
  assert.equal(measureHand(hand(false)).openness, 0);
});
test('openness is unchanged by scale and in-plane rotation',()=>{
  const points=hand(true);
  const transformed=points.map(p=>({x:1-p.y*.5,y:p.x*.5,z:0}));
  assert.ok(Math.abs(measureHand(points).openness-measureHand(transformed).openness)<1e-8);
});
test('index fingertip is mirrored for the user-facing camera',()=>{
  const points=hand(true);points[8].x=.2;
  assert.equal(measureHand(points).x,.8);
  assert.equal(measureHand(points).y,.36);
});
test('invalid or missing tracking is rejected',()=>{
  assert.equal(measureHand(null),null);
  assert.equal(measureHand([]),null);
  assert.equal(measureHand(Array.from({length:21},()=>({x:0,y:0,z:0}))),null);
});
test('smoothing approaches target without overshooting and is frame-rate independent',()=>{
  assert.ok(smooth(0,1,.016)>0 && smooth(0,1,.016)<1);
  let a=0,b=0;
  for(let i=0;i<60;i++)a=smooth(a,1,1/60);
  for(let i=0;i<30;i++)b=smooth(b,1,1/30);
  assert.ok(Math.abs(a-b)<1e-10);
});
