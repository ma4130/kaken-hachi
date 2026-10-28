import test from 'node:test';import assert from 'node:assert/strict';import {classify} from './gestures.mjs';
function body(){const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));for(const [i,x,y] of [[0,.5,.18],[11,.4,.36],[12,.6,.36],[13,.35,.53],[14,.65,.53],[15,.35,.82],[16,.65,.82],[23,.42,.75],[24,.58,.75]])p[i]={x,y,visibility:1};return p;}
test('no person and idle',()=>{assert.equal(classify(null),null);assert.equal(classify(body()).mode,'idle')});
test('reject low-confidence hands',()=>{const p=body();p[15].visibility=.2;assert.equal(classify(p),null)});
test('cover face',()=>{const p=body();p[15]={x:.45,y:.19};p[16]={x:.55,y:.19};assert.equal(classify(p).mode,'peek')});
test('cross arms',()=>{const p=body();p[15]={x:.59,y:.42};p[16]={x:.41,y:.42};assert.equal(classify(p).mode,'cross')});
test('left arm bridge',()=>{const p=body();p[13]={x:.26,y:.36};p[15]={x:.1,y:.36};assert.equal(classify(p).mode,'bridge')});
test('right arm bridge',()=>{const p=body();p[14]={x:.74,y:.36};p[16]={x:.9,y:.36};assert.equal(classify(p).mode,'bridge')});
test('body lean both directions',()=>{for(const sign of [-1,1]){const p=body();p[11].x+=sign*.14;p[12].x+=sign*.14;const r=classify(p);assert.equal(r.mode,'tilt');assert.equal(Math.sign(r.tilt),sign)}});
test('hands apart stretch and hands together shrink',()=>{for(const [a,b] of [[.32,.68],[.47,.53]]){const p=body();p[15]={x:a,y:.57};p[16]={x:b,y:.57};const r=classify(p);assert.equal(r.mode,'stretch');assert.equal(r.amount>1,a===.32)}});

