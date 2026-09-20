import * as THREE from 'three';
import {spinePoint,TAIL_TURN,TAIL_START} from './tail-shape.js';
export const SLAP_DURATION=1.86,IDLE_DURATION=4.4,FLOOR_Y=-2.58;
const PIVOT_Y=-2.08108,PIVOT_Z=-1.14616,READY_ANGLE=.36;
const BEND_START=1.04616,BEND_END=1.54616;
const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const zero=()=>[0,0,0,0,0,0];
function targetAngles(impact){return [impact,impact*.75,impact*.50,impact*.25,READY_ANGLE*.5,READY_ANGLE];}
function weightsForAngle(angle,impact){
 const knots=targetAngles(impact).map((a,i)=>({a,i}));knots.splice(4,0,{a:0,i:-1});
 angle=THREE.MathUtils.clamp(angle,impact,READY_ANGLE);
 let k=0;while(k<knots.length-2&&angle>knots[k+1].a)k++;
 const l=knots[k],r=knots[k+1],t=(angle-l.a)/(r.a-l.a),weights=zero();
 if(l.i>=0)weights[l.i]=1-t;if(r.i>=0)weights[r.i]=t;return weights;
}
export function tailWeights(mode,time,impactAngle=-.72){
 let angle=0;
 if(mode==='idle')angle=.13*Math.sin(time/IDLE_DURATION*Math.PI*2);
 else if(mode==='angle')angle=time;
 else if(mode==='ready')angle=READY_ANGLE;
 else if(mode==='impact')angle=impactAngle;
 else if(mode==='slap'){
  const keys=[[0,0],[.40,READY_ANGLE],[.53,READY_ANGLE],[.70,impactAngle],[.77,impactAngle],
   [1.00,.12],[1.24,-.055],[1.53,.028],[SLAP_DURATION,0]];
  let i=0;while(i<keys.length-2&&time>keys[i+1][0])i++;
  const [t0,a]=keys[i],[t1,b]=keys[i+1],t=THREE.MathUtils.clamp((time-t0)/(t1-t0),0,1);
  // Accelerate into contact; do not ease to a stop while still in the air.
  const eased=i===2?t*t:t*t*(3-2*t);angle=THREE.MathUtils.lerp(a,b,eased);
 }
 return weightsForAngle(angle,impactAngle);
}
export function applyTailWeights(tail,weights){for(let i=0;i<weights.length;i++)tail.morphTargetInfluences[i]=weights[i];}
const restSamples=Array.from({length:257},(_,i)=>new THREE.Vector3(...spinePoint(i/256)));
function restCenterY(z){
 const end=restSamples.at(-1),before=restSamples.at(-2);
 if(z<=end.z)return end.y+(z-end.z)*(end.y-before.y)/(end.z-before.z);
 let lo=0,hi=256;while(hi-lo>1){const mid=(lo+hi)>>1;if(restSamples[mid].z>z)lo=mid;else hi=mid;}
 const a=restSamples[lo],b=restSamples[hi];return THREE.MathUtils.lerp(a.y,b.y,(z-a.z)/(b.z-a.z));
}
function makeBend(angle){
 // Transport each cross-section along a bent centreline. Integrating its
 // rotated tangent prevents the inner notch caused by fading a rigid rotation
 // independently on each vertex near the hinge.
 const step=.0035,count=480,table=[{y:restCenterY(-BEND_START),z:-BEND_START}];
 for(let i=1;i<=count;i++){
  const z0=-BEND_START-(i-1)*step,z1=z0-step,dy=restCenterY(z1)-restCenterY(z0),theta=angle*smooth(BEND_START,BEND_END,-(z0+z1)/2),prev=table[i-1];
  table.push({y:prev.y+dy*Math.cos(theta)+step*Math.sin(theta),z:prev.z+dy*Math.sin(theta)-step*Math.cos(theta)});
 }
 return (y,z)=>{
  if(z>=-BEND_START)return [y,z];
  const f=THREE.MathUtils.clamp((-z-BEND_START)/step,0,count-.000001),i=Math.floor(f),t=f-i,a=table[i],b=table[i+1];
  const theta=angle*smooth(BEND_START,BEND_END,-z),offset=y-restCenterY(z);
  return [THREE.MathUtils.lerp(a.y,b.y,t)+offset*Math.cos(theta),THREE.MathUtils.lerp(a.z,b.z,t)+offset*Math.sin(theta)];
 };
}
export function prepareTailGeometry(g){
 const p=g.attributes.position;
 // Geometry is already built around the shared rest spine in final units.
 // No flattened caps or local vertex offsets: all volume comes from the loft.
 g.computeVertexNormals();
 const base=p.array.slice();
 function minimumY(angle){const bend=makeBend(angle);let min=Infinity;for(let i=0;i<p.count;i++)min=Math.min(min,bend(p.getY(i),p.getZ(i))[0]);return min;}
 // Find the first safe ground contact along the descending rotation arc.
 let safe=0,blocked=-1.20;
 for(let i=0;i<30;i++){const a=(safe+blocked)/2;if(minimumY(a)>=FLOOR_Y+.008)safe=a;else blocked=a;}
 const impactAngle=safe,angles=targetAngles(impactAngle),targets=[];
 let contact,lowest=Infinity;
 for(let k=0;k<angles.length;k++){
  const positions=base.slice(),bend=makeBend(angles[k]);
  for(let i=0;i<p.count;i++){
   const [y,z]=bend(p.getY(i),p.getZ(i));positions[i*3+1]=y;positions[i*3+2]=z;
   if(k===0&&y<lowest){lowest=y;contact={x:p.getX(i),y,z};}
  }
  targets.push(positions);
 }
 g.morphAttributes.position=[];g.morphAttributes.normal=[];
 const names=['turn-contact','turn-down-three-quarters','turn-down-half','turn-down-quarter','turn-up-half','turn-up-full'];
 for(let i=0;i<targets.length;i++){
  const position=new THREE.Float32BufferAttribute(targets[i],3);position.name=names[i];
  const temporary=new THREE.BufferGeometry();temporary.setIndex(g.index);temporary.setAttribute('position',position);temporary.computeVertexNormals();
  g.morphAttributes.position.push(position);g.morphAttributes.normal.push(temporary.attributes.normal.clone());temporary.dispose();
 }
 g.morphTargetsRelative=false;g.computeBoundingBox();g.computeBoundingSphere();
 return {scale:1.25,root:TAIL_START,floorY:FLOOR_Y,contact,impactAngle,
  pivot:[0,PIVOT_Y,PIVOT_Z],bendStartZ:-BEND_START,bendEndZ:-BEND_END,
  construction:'continuous spine and tapered elliptical sections',morphTargets:names};
}
export function createTailAnimations(tail){
 function clip(name,mode,duration){
  const steps=Math.ceil(duration*30),times=[],values=[];
  for(let i=0;i<=steps;i++){const t=i/steps*duration;times.push(t);values.push(...tailWeights(mode,t,tail.userData.motion.impactAngle));}
  return new THREE.AnimationClip(name,duration,[new THREE.NumberKeyframeTrack(tail.uuid+'.morphTargetInfluences',times,values)]);
 }
 return [clip('Tail_Sway_UpDown','idle',IDLE_DURATION),clip('Tail_FloorTap','slap',SLAP_DURATION)];
}
