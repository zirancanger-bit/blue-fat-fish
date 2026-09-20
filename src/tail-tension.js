import * as THREE from 'three';
import {spinePoint,TAIL_START} from './approved/tail-shape.js';

// A separate carry morph unfolds the curved spine without scaling the tail
// into a thin rod. Cross sections and the two flukes travel with the spine.
const N=128,rest=Array.from({length:N+1},(_,i)=>new THREE.Vector3(...spinePoint(i/N)));
const distances=[0];
for(let i=1;i<=N;i++)distances.push(distances[i-1]+rest[i].distanceTo(rest[i-1]));
const direction=new THREE.Vector3(0,-Math.cos(.62),-Math.sin(.62));
const side=new THREE.Vector3(0,-direction.z,direction.y),start=new THREE.Vector3(...TAIL_START);
const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export function tensionPoint(t){
 t=THREE.MathUtils.clamp(t,0,1);
 const f=t*N,i=Math.min(N-1,Math.floor(f)),length=THREE.MathUtils.lerp(distances[i],distances[i+1],f-i);
 const straight=start.clone().addScaledVector(direction,length).addScaledVector(side,.035*Math.sin(Math.PI*t));
 return new THREE.Vector3(...spinePoint(t)).lerp(straight,smooth(.06,.25,t));
}
const held=rest.map((_,i)=>tensionPoint(i/N));
const rotations=rest.map((p,i)=>{
 const lo=Math.max(0,i-1),hi=Math.min(N,i+1);
 return new THREE.Quaternion().setFromUnitVectors(rest[hi].clone().sub(rest[lo]).normalize(),held[hi].clone().sub(held[lo]).normalize());
});

export function prepareTailTension(tail){
 const geometry=tail.geometry,src=geometry.attributes.position,out=src.array.slice();
 const point=new THREE.Vector3(),closest=new THREE.Vector3(),offset=new THREE.Vector3(),q=new THREE.Quaternion();
 for(let v=0;v<src.count;v++){
  point.fromBufferAttribute(src,v);let best=Infinity,segment=0,along=0;
  for(let i=0;i<N;i++){
   const a=rest[i],b=rest[i+1],dy=b.y-a.y,dz=b.z-a.z;
   const t=THREE.MathUtils.clamp(((point.y-a.y)*dy+(point.z-a.z)*dz)/(dy*dy+dz*dz),0,1);
   const y=a.y+dy*t,z=a.z+dz*t,d=(point.y-y)**2+(point.z-z)**2;
   if(d<best){best=d;segment=i;along=t;}
  }
  closest.copy(rest[segment]).lerp(rest[segment+1],along);
  q.copy(rotations[segment]).slerp(rotations[segment+1],along);
  offset.copy(point).sub(closest).applyQuaternion(q);
  point.copy(held[segment]).lerp(held[segment+1],along).add(offset);
  out[v*3]=point.x;out[v*3+1]=point.y;out[v*3+2]=point.z;
 }
 const position=new THREE.Float32BufferAttribute(out,3);position.name='carry-straightened';
 const temporary=new THREE.BufferGeometry();temporary.setIndex(geometry.index);temporary.setAttribute('position',position);temporary.computeVertexNormals();
 const index=geometry.morphAttributes.position.length;
 geometry.morphAttributes.position.push(position);geometry.morphAttributes.normal.push(temporary.attributes.normal.clone());temporary.dispose();
 geometry.computeBoundingBox();geometry.computeBoundingSphere();tail.updateMorphTargets();
 tail.userData.tension={index,grip:held.at(-1).toArray(),spineLength:distances.at(-1)};
 return held.at(-1).clone();
}
