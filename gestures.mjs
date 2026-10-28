export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function classify(p){
 if(!p||p.length<33)return null;
 const [nose,ls,rs,le,re,lw,rw,lh,rh]=[0,11,12,13,14,15,16,23,24].map(i=>p[i]);
 if([ls,rs,lw,rw].some(v=>(v.visibility??1)<.45))return null;
 const width=Math.max(.1,distance(ls,rs));const mid={x:(ls.x+rs.x)/2,y:(ls.y+rs.y)/2};
 const hips={x:(lh.x+rh.x)/2,y:(lh.y+rh.y)/2};
 const tilt=clamp((mid.x-hips.x)/Math.max(.18,Math.abs(mid.y-hips.y)),-.65,.65);
 const covered=distance(lw,nose)<width*.8&&distance(rw,nose)<width*.8&&Math.abs(lw.y-nose.y)<width*.65&&Math.abs(rw.y-nose.y)<width*.65;
 if(covered)return {mode:'peek',covered:true,tilt};
 const cross=distance(lw,rs)<width*.65&&distance(rw,ls)<width*.65&&lw.y>mid.y-width*.2&&rw.y>mid.y-width*.2;
 if(cross)return {mode:'cross',tilt};
 for(const [shoulder,elbow,wrist] of [[ls,le,lw],[rs,re,rw]]){
  if(Math.abs(wrist.x-shoulder.x)>width*1.05&&Math.abs(wrist.y-shoulder.y)<width*.38&&distance(shoulder,wrist)>.85*(distance(shoulder,elbow)+distance(elbow,wrist)))return {mode:'bridge',start:shoulder,end:wrist,tilt};
 }
 if(Math.abs(tilt)>.18)return {mode:'tilt',tilt};
 const handsUp=lw.y<hips.y&&rw.y<hips.y&&lw.y>nose.y+width*.25&&rw.y>nose.y+width*.25;
 if(handsUp&&Math.abs(lw.y-rw.y)<width*.55)return {mode:'stretch',amount:clamp(distance(lw,rw)/width,.35,2.8),left:lw,right:rw,tilt};
 return {mode:'idle',tilt};
}
