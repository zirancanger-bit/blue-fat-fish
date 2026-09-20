import * as THREE from 'three';
import {clothRadius,clothDepth} from './body-surfaces.js';
const clamp=THREE.MathUtils.clamp;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

// A single scarf shell, instead of a triangular bib intersecting a neck band.
// Its complete upper edge follows upward ray intersections with the finished head.
export function makeKerchief(head){
 const C=192,R=36,top=[],ray=new THREE.Raycaster();
 const targets=[head.getObjectByName('Hair / closed shell with continuous pale turnaround'),head.getObjectByName('Face / independent white solid')];
 head.updateMatrixWorld(true);
 for(let i=0;i<C;i++){
  const a=i/C*Math.PI*2,x=.410*Math.sin(a),rz=.435-.030*(1-Math.cos(a))/2,z=rz*Math.cos(a);
  ray.set(new THREE.Vector3(x,-1.5,z),new THREE.Vector3(0,1,0));
  const hit=ray.intersectObjects(targets,false)[0];
  top.push(new THREE.Vector3(x,(hit?.point.y??-.96)+.028,z));
 }
 function topAt(a){const f=((a/(Math.PI*2)%1+1)%1)*C,i=Math.floor(f);return top[i%C].clone().lerp(top[(i+1)%C],f-i);}
 function point(a,t){
  const v=topAt(a),c=Math.cos(a),s=Math.sin(a),back=smooth(0,.65,-c);
  // The full round opening reaches onto the underside of the face. The
  // rear edge still meets the filled shoulder profile from revision 04.
  const hem=-1.102-(c>0?.238*(1-Math.abs(s)):0)-.12*back;
  const y=THREE.MathUtils.lerp(v.y,hem,t);
  const roundR=THREE.MathUtils.lerp(.410,clothRadius(hem)+.023,t)+.012*Math.sin(Math.PI*t);
  const roundZ=THREE.MathUtils.lerp(v.z,(clothDepth(hem)+.024)*c,t)+.012*c*Math.sin(Math.PI*t);
  return new THREE.Vector3(roundR*s,y,roundZ);
 }
 function depth(x,y){
  let a=Math.asin(clamp(x/.41,-.98,.98)),t=.5;
  for(let i=0;i<16;i++){
   const v=topAt(a),hem=-1.102-.238*(1-Math.abs(Math.sin(a)));
   t=clamp((y-v.y)/(hem-v.y),0,1);
   const r=THREE.MathUtils.lerp(.410,clothRadius(hem)+.023,t)+.012*Math.sin(Math.PI*t);a=Math.asin(clamp(x/r,-.999,.999));
  }
  return point(a,t).z;
 }
 const p=[],ix=[],offset=(R+1)*C;
 for(const inside of [false,true])for(let j=0;j<=R;j++)for(let i=0;i<C;i++){
  const a=i/C*Math.PI*2,v=point(a,j/R);
  if(inside){v.x-=.012*Math.sin(a);v.z-=.012*Math.cos(a);}
  p.push(...v.toArray());
 }
 for(let j=0;j<R;j++)for(let i=0;i<C;i++){
  const k=(i+1)%C,a=j*C+i,b=(j+1)*C+i,c=j*C+k,d=(j+1)*C+k;
  ix.push(a,b,c,c,b,d,a+offset,c+offset,b+offset,c+offset,d+offset,b+offset);
 }
 for(let i=0;i<C;i++){
  const k=(i+1)%C;ix.push(k,k+offset,i,i,k+offset,i+offset);
  const a=R*C+i,b=R*C+k;ix.push(a,a+offset,b,b,a+offset,b+offset);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setIndex(ix);geometry.computeVertexNormals();
 return {geometry,point,depth,attachmentSamples:top.map(v=>v.toArray())};
}
