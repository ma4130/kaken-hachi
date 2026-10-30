import {clamp} from './gestures.mjs';
const canvas=document.querySelector('#projectionCanvas'),ctx=canvas.getContext('2d'),video=document.querySelector('#projectionVideo');
const bubble=document.querySelector('#projectionBubble'),connection=document.querySelector('#projectionConnection'),guide=document.querySelector('#projectionGuide');
const sprite=new Image();sprite.src='assets/character.png';
const channel=new BroadcastChannel('denkikko-projection-v1');
const messages={idle:'こんにちは！いっしょに遊ぼう。',tilt:'わわっ、すべる〜！',peek:'あれ？どこにいるの？',shock:'わあっ！びっくりした！',stretch:'びよーーん！',bridge:'手の先まで、おさんぽ。',cross:'えっへん。おそろい！'};
let peer=null,frame={mode:'idle',state:{mode:'idle'},running:false,demo:false,skeleton:null,showSkeleton:true},lastFrameAt=0;
let w=innerWidth,h=innerHeight,lastTime=performance.now(),lastMode='idle',walkStart=0,hiddenSince=0,wasHidden=false;
let x=.66,y=.81,sx=1,sy=1,rotation=0,sceneTilt=0,velocity=0;
function resize(){w=innerWidth;h=innerHeight;canvas.width=w*devicePixelRatio;canvas.height=h*devicePixelRatio;ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)}addEventListener('resize',resize);resize();
function send(message){channel.postMessage({...message,source:'display'})}
function setConnected(text,active=true){connection.innerHTML='<i></i> '+text;connection.classList.toggle('connected',active)}
async function acceptOffer(description){
 peer?.close();peer=new RTCPeerConnection();
 peer.ontrack=event=>{video.srcObject=event.streams[0];video.play().catch(()=>{});guide.hidden=true;setConnected('カメラ映像を受信中')};
 peer.onicecandidate=event=>{if(event.candidate)send({type:'ice-display',candidate:event.candidate.toJSON()})};
 await peer.setRemoteDescription(description);const answer=await peer.createAnswer();await peer.setLocalDescription(answer);send({type:'answer',description:{type:peer.localDescription.type,sdp:peer.localDescription.sdp}});
}
channel.onmessage=async event=>{const message=event.data;if(!message||message.source==='display')return;
 if(message.type==='control-ready'){setConnected('制御画面と接続済み');guide.querySelector('span').textContent='カメラを開始するか、デモカードを押してください';}
 if(message.type==='frame'){frame=message;lastFrameAt=performance.now();setConnected(message.running?'制御画面と接続済み・カメラ動作中':'制御画面と接続済み');if(message.demo)guide.hidden=true;}
 if(message.type==='offer')await acceptOffer(message.description);
 if(message.type==='ice-control'&&peer)await peer.addIceCandidate(message.candidate).catch(()=>{});
 if(message.type==='stream-stopped'){video.srcObject=null;peer?.close();peer=null;}
};
send({type:'projection-ready'});setInterval(()=>send({type:'projection-ready'}),1500);
document.querySelector('#projectionFullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('#projection').requestFullscreen()}catch{setConnected('全画面表示に失敗しました',false)}};
function line(a,b,color,width){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke()}
function drawGrid(){const backdrop=ctx.createLinearGradient(0,0,w,h);backdrop.addColorStop(0,'#e8f0dc');backdrop.addColorStop(1,'#9fc8b1');ctx.fillStyle=backdrop;ctx.fillRect(0,0,w,h);ctx.strokeStyle='#ffffff32';ctx.lineWidth=1;for(let i=0;i<w;i+=64){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,h);ctx.stroke()}for(let i=0;i<h;i+=64){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(w,i);ctx.stroke()}}
function draw(now){const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;
 const state=frame.state||{mode:'idle'},mode=frame.mode||state.mode||'idle';
 if(mode!==lastMode){if(mode==='bridge'||mode==='shock')walkStart=now;if(mode==='peek'){hiddenSince=now;wasHidden=true}else if(wasHidden)wasHidden=false;bubble.textContent=messages[mode]||messages.idle;lastMode=mode;}
 const lerp=(a,b)=>a+(b-a)*(1-Math.exp(-dt*7)),tilt=mode==='tilt'?(state.tilt||0):0;sceneTilt=lerp(sceneTilt,tilt*.22);
 let tx=.66,ty=.81,tsx=1,tsy=1,tr=0;
 if(mode==='tilt'){velocity=clamp(velocity+tilt*dt*.9,-.45,.45);x=clamp(x+velocity*dt,.07,.93);tx=x;tr=clamp(-velocity*.6,-.25,.25);if(x<=.07||x>=.93){velocity=0;tr=x<.5?-.25:.25;bubble.textContent='ぎゅっ！つかまえた！'}}else velocity=0;
 if(mode==='peek'){tsx=tsy=1+clamp((now-hiddenSince)/2500,0,.9);tx=.54;ty=.85}
 if(mode==='shock'){const t=(now-walkStart)/1100;tx=.75;ty=.81-Math.sin(clamp(t,0,1)*Math.PI)*.25;tsx=tsy=.8;tr=Math.sin(t*15)*.15}
 const cameraVisible=video.readyState>=2&&video.videoWidth>0,videoScale=cameraVisible?Math.max(w/video.videoWidth,h/video.videoHeight)*1.12:1;
 const project=p=>{if(!cameraVisible||frame.demo)return{x:(1-p.x)*w,y:p.y*h};const px=(.5-p.x)*video.videoWidth*videoScale,py=(p.y-.5)*video.videoHeight*videoScale;return{x:w/2+px*Math.cos(sceneTilt)-py*Math.sin(sceneTilt),y:h/2+px*Math.sin(sceneTilt)+py*Math.cos(sceneTilt)}};
 if(mode==='stretch'){tsx=clamp(state.amount||1,.4,2.6);tsy=clamp(1/Math.sqrt(tsx),.65,1.45);const left=state.left?project(state.left):null,right=state.right?project(state.right):null;tx=left?clamp((left.x+right.x)/2/w,.08,.92):.56;ty=left?clamp((left.y+right.y)/2/h+.12,.35,.88):.79}
 let bridge;if(mode==='bridge'&&state.start&&state.end){bridge={a:project(state.start),b:project(state.end)};const progress=clamp((now-walkStart)/4200,0,1);tx=(bridge.a.x+(bridge.b.x-bridge.a.x)*progress)/w;ty=(bridge.a.y+(bridge.b.y-bridge.a.y)*progress)/h;tr=Math.atan2(bridge.b.y-bridge.a.y,Math.abs(bridge.b.x-bridge.a.x))*.3}
 x=lerp(x,tx);y=lerp(y,ty);sx=lerp(sx,tsx);sy=lerp(sy,tsy);rotation=lerp(rotation,tr);
 ctx.clearRect(0,0,w,h);if(cameraVisible){ctx.save();ctx.translate(w/2,h/2);ctx.rotate(sceneTilt);ctx.scale(-1,1);ctx.drawImage(video,-video.videoWidth*videoScale/2,-video.videoHeight*videoScale/2,video.videoWidth*videoScale,video.videoHeight*videoScale);ctx.restore()}else drawGrid();
 const shade=ctx.createLinearGradient(0,0,w,0);shade.addColorStop(0,'#123f3a38');shade.addColorStop(.6,'#123f3a00');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
 if(frame.running&&!frame.demo&&frame.skeleton&&frame.showSkeleton){for(const [a,b]of[[11,13],[13,15],[12,14],[14,16]])if((frame.skeleton[a]?.visibility??1)>.45&&(frame.skeleton[b]?.visibility??1)>.45)line(project(frame.skeleton[a]),project(frame.skeleton[b]),'#ffffff80',5)}
 const size=Math.min(h*.36,w*.22),ch=size,cw=size*(sprite.width/(sprite.height||1)||.7),walk=mode==='bridge'&&now-walkStart<4200?Math.sin(now*.018)*5:Math.sin(now*.002)*3;
 ctx.save();ctx.translate(x*w,y*h);ctx.fillStyle='#263e3940';ctx.beginPath();ctx.ellipse(0,5,cw*.42*sx,10,0,0,Math.PI*2);ctx.fill();ctx.translate(0,-ch*sy/2+walk);ctx.rotate(rotation);ctx.scale(sx,sy);if(mode==='bridge'&&bridge&&bridge.b.x<bridge.a.x)ctx.scale(-1,1);if(sprite.complete&&sprite.naturalWidth)ctx.drawImage(sprite,-cw/2,-ch/2,cw,ch);
 if(mode==='cross'){const a={x:-cw*.22,y:ch*.22},b={x:cw*.22,y:ch*.3};line(a,b,'#241f1a',14);line(a,b,'#9e332c',10);line({x:cw*.23,y:ch*.2},{x:-cw*.19,y:ch*.31},'#241f1a',14);line({x:cw*.23,y:ch*.2},{x:-cw*.19,y:ch*.31},'#bc4634',10)}
 if(mode==='tilt'&&(x<.09||x>.91)){line({x:(x<.5?-1:1)*cw*.2,y:ch*.15},{x:(x<.5?-1:1)*cw*.5,y:-ch*.14},'#8e302b',11)}ctx.restore();
 if(mode==='shock'){ctx.font='bold 42px sans-serif';ctx.fillStyle='#fff4b5';ctx.fillText('!!',x*w+cw*.5,y*h-ch*.9)}
 bubble.style.left=clamp(x*100,18,82)+'%';bubble.style.top=clamp((y-ch*sy/h-.07)*100,13,72)+'%';
 if(performance.now()-lastFrameAt>5000){setConnected('制御画面を待っています',false);guide.hidden=false}requestAnimationFrame(draw)
}requestAnimationFrame(draw);

