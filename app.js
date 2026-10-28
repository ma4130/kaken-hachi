import {classify,clamp} from './gestures.mjs';
const $=s=>document.querySelector(s),canvas=$('#scene'),ctx=canvas.getContext('2d');
const sprite=new Image();sprite.src='assets/character.png';
let w=1200,h=590,running=false,stream,pose,latest=null,lastSeen=0,lastVideoTime=-1,lastInference=0,loading=false;
let demo=null,demoStart=0,state={mode:'idle'},candidate='idle',candidateSince=0,hiddenSince=0,wasHidden=false,shockUntil=0,walkStart=0,lastMode='idle',lastFrame=performance.now();
let x=.66,y=.81,sx=1,sy=1,rotation=0,sceneTilt=0,velocity=0;
const messages={idle:'こんにちは！いっしょに遊ぼう。',tilt:'わわっ、すべる〜！',peek:'あれ？どこにいるの？',shock:'わあっ！びっくりした！',stretch:'びよーーん！',bridge:'手の先まで、おさんぽ。',cross:'えっへん。おそろい！'};
const hints={idle:'上半身と両手をカメラに映してね',tilt:'上半身をゆっくり左右に傾けよう',peek:'顔を隠したあと、ぱっと開いてね',shock:'大成功！もう一度やってみよう',stretch:'胸の前で、両手を近づけたり離したり',bridge:'片腕をまっすぐ横に伸ばしてね',cross:'胸の前で腕を組んで、まねっこ！'};
function resize(){const r=canvas.getBoundingClientRect();w=r.width;h=r.height;canvas.width=w*devicePixelRatio;canvas.height=h*devicePixelRatio;ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)}new ResizeObserver(resize).observe(canvas);
function setMessage(mode){$('#bubble').textContent=messages[mode]||messages.idle;$('#hint').textContent=demo?'デモ体験中 · '+hints[mode]:hints[mode];document.querySelectorAll('[data-demo]').forEach(b=>b.classList.toggle('active',b.dataset.demo===(mode==='shock'?'peek':mode)))}
function enter(){ $('#welcome').hidden=true; }
function startDemo(mode){enter();demo=mode;demoStart=performance.now();wasHidden=false;hiddenSince=0;shockUntil=0;velocity=0;walkStart=demoStart;$('#modeBadge').textContent='DEMO MODE';$('#connection').textContent=running?'デモ中 · カメラは接続中':'デモで体験中';}
document.querySelectorAll('[data-demo]').forEach(b=>b.onclick=()=>startDemo(b.dataset.demo));
$('#tryDemo').onclick=()=>startDemo('tilt');
function reset(){demo=null;state={mode:'idle'};latest=null;wasHidden=false;hiddenSince=0;shockUntil=0;velocity=0;x=.66;y=.81;candidate='idle';setMessage('idle');$('#modeBadge').textContent=running?'CAMERA LIVE':'DEMO MODE';$('#connection').textContent=running?'カメラで体験中':'デモで体験できます';if(!running)$('#welcome').hidden=false;}
$('#reset').onclick=reset;
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#playground').requestFullscreen()}catch{ $('#error').hidden=false;$('#error').textContent='このブラウザーでは全画面にできません。';}};
function stop(){running=false;stream?.getTracks().forEach(t=>t.stop());stream=null;$('#camera').srcObject=null;$('#cameraBox').hidden=true;$('#stop').hidden=true;$('#start').disabled=false;$('#start').innerHTML='◉ カメラではじめる <span>→</span>';reset();}
$('#stop').onclick=stop;window.addEventListener('pagehide',()=>stream?.getTracks().forEach(t=>t.stop()));
$('#start').onclick=async()=>{
 if(loading||running)return;loading=true;$('#error').hidden=true;$('#start').disabled=true;$('#start').textContent='カメラと認識を準備中…';
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('secure');
  stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});
  $('#camera').srcObject=stream;await $('#camera').play();
  if(!pose){const {FilesetResolver,PoseLandmarker}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/vision_bundle.mjs');const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm');pose=await PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate:'CPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5});}
  running=true;lastSeen=performance.now();lastVideoTime=-1;demo=null;enter();$('#cameraBox').hidden=false;$('#stop').hidden=false;$('#modeBadge').textContent='CAMERA LIVE';$('#connection').textContent='カメラで体験中';
 }catch(e){stream?.getTracks().forEach(t=>t.stop());stream=null;$('#camera').srcObject=null;$('#error').hidden=false;$('#error').textContent=e.name==='NotAllowedError'?'カメラが許可されていません。アドレスバーのカメラ設定を確認して、もう一度はじめてください。デモでも遊べます。':e.name==='NotFoundError'?'カメラが見つかりません。接続を確認してください。デモでも遊べます。':e.name==='NotReadableError'?'カメラをほかのアプリが使用中です。閉じてから、もう一度はじめてください。':'認識の準備に失敗しました。HTTPSまたはlocalhostで開き、ネット接続を確認して再試行してください。デモでも遊べます。';}
 finally{loading=false;$('#start').disabled=false;$('#start').innerHTML='◉ カメラではじめる <span>→</span>';}
};
function getDemo(now){let t=(now-demoStart)/1000;
 if(demo==='tilt')return {mode:'tilt',tilt:Math.sin(t*.75)*.62};
 if(demo==='peek')return {mode:'peek',covered:t%6<3.6};
 if(demo==='stretch')return {mode:'stretch',amount:1.4+Math.sin(t*1.7)*1.05};
 if(demo==='bridge')return {mode:'bridge',start:{x:.73,y:.62},end:{x:.18,y:.62}};
 return {mode:'cross'};
}
function line(a,b,color,width){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke()}
function draw(now){const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;
 if(running&&pose&&$('#camera').readyState>=2&&now-lastInference>66&&lastVideoTime!==$('#camera').currentTime){lastInference=now;lastVideoTime=$('#camera').currentTime;try{const r=pose.detectForVideo($('#camera'),now);latest=r.landmarks[0]||null;if(latest)lastSeen=now;}catch(e){stop();$('#error').hidden=false;$('#error').textContent='認識が停止しました。カメラを再開してください。';}}
 let detected=demo?getDemo(now):(running?classify(latest):null);
 if(running){const found=latest&&now-lastSeen<700;$('#tracking').textContent=found?'認識中 · ゆっくり動いてね':'上半身と両手を映してね';if(!found&&!demo){detected=null;wasHidden=false;hiddenSince=0;shockUntil=0;}}
 if(detected){if(demo){state=detected;}else{if(candidate!==detected.mode){candidate=detected.mode;candidateSince=now;}if(now-candidateSince>180||state.mode===detected.mode)state=detected;}}
 else state={mode:'idle'};
 let mode=state.mode;
 if(mode==='peek'&&state.covered){if(!wasHidden)hiddenSince=now;wasHidden=true;}else if(wasHidden){if(now-hiddenSince>500)shockUntil=now+1100;wasHidden=false;}
 if(now<shockUntil)mode='shock';
 if(mode!==lastMode){if(mode==='bridge')walkStart=now;setMessage(mode);lastMode=mode;}
 const lerp=(a,b)=>a+(b-a)*(1-Math.exp(-dt*7));
 const tilt=mode==='tilt'?(state.tilt||0):0;sceneTilt=lerp(sceneTilt,tilt*.22);
 let tx=.66,ty=.81,tsx=1,tsy=1,tr=0;
 if(mode==='tilt'){velocity=clamp(velocity+tilt*dt*.9,-.45,.45);x=clamp(x+velocity*dt,.07,.93);tx=x;ty=.81;tr=clamp(-velocity*.6,-.25,.25);if(x<=.07||x>=.93){velocity=0;tr=x<.5?-.25:.25;$('#bubble').textContent='ぎゅっ！つかまえた！';}}
 else velocity=0;
 if(mode==='peek'){tsx=tsy=1+clamp((now-hiddenSince)/2500,0,.9);tx=.54;ty=.85;}
 if(mode==='shock'){let t=1-(shockUntil-now)/1100;tx=.75;ty=.81-Math.sin(t*Math.PI)*.25;tsx=tsy=.8;tr=Math.sin(t*15)*.15;}
 const video=$('#camera');
 const cameraVisible=running&&video.readyState>=2;
 const videoScale=cameraVisible?Math.max(w/video.videoWidth,h/video.videoHeight)*1.12:1;
 const project=p=>{if(!cameraVisible||demo)return {x:(1-p.x)*w,y:p.y*h};const px=(.5-p.x)*video.videoWidth*videoScale,py=(p.y-.5)*video.videoHeight*videoScale;return {x:w/2+px*Math.cos(sceneTilt)-py*Math.sin(sceneTilt),y:h/2+px*Math.sin(sceneTilt)+py*Math.cos(sceneTilt)};};
 if(mode==='stretch'){tsx=clamp(state.amount||1,.4,2.6);tsy=clamp(1/Math.sqrt(tsx),.65,1.45);const left=state.left?project(state.left):null,right=state.right?project(state.right):null;tx=left?clamp((left.x+right.x)/2/w,.08,.92):.56;ty=left?clamp((left.y+right.y)/2/h+.12,.35,.88):.79;}
 let bridge;
 if(mode==='bridge'){bridge={a:project(state.start),b:project(state.end)};let progress=clamp((now-walkStart)/4200,0,1);tx=(bridge.a.x+(bridge.b.x-bridge.a.x)*progress)/w;ty=(bridge.a.y+(bridge.b.y-bridge.a.y)*progress)/h;tr=Math.atan2(bridge.b.y-bridge.a.y,Math.abs(bridge.b.x-bridge.a.x))*.3;}
 x=lerp(x,tx);y=lerp(y,ty);sx=lerp(sx,tsx);sy=lerp(sy,tsy);rotation=lerp(rotation,tr);
 ctx.clearRect(0,0,w,h);
 if(cameraVisible){ctx.save();ctx.translate(w/2,h/2);ctx.rotate(sceneTilt);ctx.scale(-1,1);ctx.drawImage(video,-video.videoWidth*videoScale/2,-video.videoHeight*videoScale/2,video.videoWidth*videoScale,video.videoHeight*videoScale);ctx.restore();}
 else {const backdrop=ctx.createLinearGradient(0,0,w,h);backdrop.addColorStop(0,'#e8f0dc');backdrop.addColorStop(1,'#b6d5c1');ctx.fillStyle=backdrop;ctx.fillRect(0,0,w,h);ctx.strokeStyle='#ffffff35';ctx.lineWidth=1;for(let i=0;i<w;i+=48){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,h);ctx.stroke();}for(let i=0;i<h;i+=48){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(w,i);ctx.stroke();}}
 const shade=ctx.createLinearGradient(0,0,w,0);shade.addColorStop(0,'#123f3a45');shade.addColorStop(.55,'#123f3a00');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
 if(running&&!demo&&latest&&now-lastSeen<700&&$('#skeleton').checked){for(const [a,b] of [[11,13],[13,15],[12,14],[14,16]])if((latest[a].visibility??1)>.45&&(latest[b].visibility??1)>.45)line(project(latest[a]),project(latest[b]),'#ffffff80',4);}
 if(bridge){line(bridge.a,bridge.b,'#42604a',14);line(bridge.a,bridge.b,'#f3da8c',8);for(const point of [bridge.a,bridge.b]){ctx.beginPath();ctx.arc(point.x,point.y,9,0,Math.PI*2);ctx.fillStyle='#fff1c1';ctx.fill();}}
 const size=Math.min(h*.34,w*.2),ch=size,cw=size*(sprite.width/(sprite.height||1)||.7);const walk=mode==='bridge'&&now-walkStart<4200?Math.sin(now*.018)*4:Math.sin(now*.002)*2;
 ctx.save();ctx.translate(x*w,y*h);ctx.fillStyle='#263e3940';ctx.beginPath();ctx.ellipse(0,5,cw*.42*sx,8,0,0,Math.PI*2);ctx.fill();ctx.translate(0,-ch*sy/2+walk);ctx.rotate(rotation);ctx.scale(sx,sy);if(mode==='bridge'&&bridge.b.x<bridge.a.x)ctx.scale(-1,1);if(sprite.complete&&sprite.naturalWidth)ctx.drawImage(sprite,-cw/2,-ch/2,cw,ch);
 if(mode==='cross'){const a={x:-cw*.22,y:ch*.22},b={x:cw*.22,y:ch*.3};line(a,b,'#241f1a',12);line(a,b,'#9e332c',9);line({x:cw*.23,y:ch*.2},{x:-cw*.19,y:ch*.31},'#241f1a',12);line({x:cw*.23,y:ch*.2},{x:-cw*.19,y:ch*.31},'#bc4634',9);ctx.fillStyle='#f3d393';for(const [xx,yy] of [[cw*.22,ch*.29],[-cw*.19,ch*.31]]){ctx.beginPath();ctx.ellipse(xx,yy,5,4,-.3,0,7);ctx.fill();}}
 if(mode==='tilt'&&(x<.09||x>.91)){line({x:(x<.5?-1:1)*cw*.2,y:ch*.15},{x:(x<.5?-1:1)*cw*.5,y:-ch*.14},'#8e302b',9);ctx.fillStyle='#f4d992';ctx.beginPath();ctx.arc((x<.5?-1:1)*cw*.5,-ch*.14,6,0,7);ctx.fill();}
 ctx.restore();
 if(mode==='shock'){ctx.font='bold 32px sans-serif';ctx.fillStyle='#fff4b5';ctx.fillText('!!',x*w+cw*.5,y*h-ch*.9);}
 $('#bubble').style.left=clamp(x*100,20,80)+'%';$('#bubble').style.top=clamp((y-ch*sy/h-.07)*100,18,68)+'%';requestAnimationFrame(draw);
}requestAnimationFrame(draw);
