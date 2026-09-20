import * as THREE from 'three';
import {createModel,tailWeights,applyTailWeights,HAND_POSES} from './approved/model.js';
import {faceDepth,frontDepth,eyeSurface} from './approved/head-model.js';
import {buildEyeDetails} from './eye-details.js';
import {TAIL_END} from './approved/tail-shape.js';
import {prepareTailTension} from './tail-tension.js';
export {tailWeights,applyTailWeights,HAND_POSES};
export const HEAD_REST_PITCH=-5*Math.PI/180;
const surface=(x,y)=>Math.max(faceDepth(x,y),frontDepth(x,y));
function line(points,r,material,parent,name){
 const curve=new THREE.CatmullRomCurve3(points.map(([x,y])=>new THREE.Vector3(x,y,surface(x,y)+.035)));
 const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,24,r,8,false),material);mesh.name=name;parent.add(mesh);return mesh;
}
function blush(sign,parent){
 const p=[],colors=[],ix=[],rings=6,N=40,cx=sign*.59,cy=-.69;
 for(let j=0;j<=rings;j++)for(let i=0;i<=N;i++){
  const r=j/rings,a=i/N*Math.PI*2,x=cx+Math.cos(a)*.23*r,y=cy+Math.sin(a)*.095*r;
  p.push(x,y,surface(x,y)+.020);colors.push(1,.28,.43,(1-r*r)**1.25*.82);
  if(j<rings&&i<N){const k=j*(N+1)+i;ix.push(k,k+1,k+N+1,k+1,k+N+2,k+N+1);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));g.setIndex(ix);
 const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));m.name=`Blush ${sign}`;parent.add(m);return m;
}
export function createFin(){
 const root=new THREE.Group(),rig=new THREE.Group(),asset=createModel();root.name='Fin pet';root.add(rig);rig.add(asset);asset.position.y=2.58;
 const head=asset.getObjectByName('Head assembly'),headPivot=new THREE.Group();headPivot.name='Neck motion';headPivot.position.y=-.98;asset.add(headPivot);headPivot.add(head);head.position.y=.98;
 headPivot.rotation.x=HEAD_REST_PITCH;
 const hands=asset.getObjectByName('Hands assembly').children;
 const tail=asset.getObjectByName('Tail / continuous whale body and flukes');
 const legs=['L','R'].map((side,i)=>{const leg=asset.getObjectByName(`Leg ${side} / continuous rounded boot`),pivot=new THREE.Group();pivot.position.set(i? .224:-.224,-1.85,0);leg.parent.add(pivot);pivot.add(leg);leg.position.copy(pivot.position).negate();return pivot;});
 const eyes=buildEyeDetails(head),openEyes=eyes.normal,closed=eyes.closed,eyebrows=[],originalMouth=[],smiling=new THREE.Group(),blushes=[];
 head.add(smiling);smiling.name='Gentle smile';
 head.traverse(m=>{if(!m.isMesh)return;if(/^Eyebrow /.test(m.name))eyebrows.push(m);if(/^Mouth /.test(m.name)||m.name==='Mouth rounded end')originalMouth.push(m);});
 const dark=new THREE.MeshStandardMaterial({color:'#202235',roughness:.8}),blue=new THREE.MeshStandardMaterial({color:'#564fff',roughness:.6});
 for(const s of [-1,1]){
  blushes.push(blush(s,head));
 }
 line([[-.075,-.797],[0,-.833],[.075,-.797]],.011,blue,smiling,'Smile');
 closed.visible=false;smiling.visible=false;
 const hitTargets=[],hitMaterial=new THREE.MeshBasicMaterial({visible:false}),hitGeometry=new THREE.SphereGeometry(1,16,12);
 function proxy(parent,name,pos,scale,action){const m=new THREE.Mesh(hitGeometry,hitMaterial);m.name=name;m.position.set(...pos);m.scale.set(...scale);m.userData.touchAction=action;parent.add(m);hitTargets.push(m);}
 proxy(head,'head hit',[0,0,0],[1.12,1.10,.97],'pet');
 proxy(head,'nose',[0,-.80,.78],[.18,.13,.14],'boop');
 proxy(asset,'body hit',[0,-1.60,0],[.78,.95,.55],'pet');
 proxy(asset,'tail',[0,-2.0,-1.05],[.39,.34,.65],'tailtap');
 proxy(asset,'tail',[0,-1.72,-2.02],[.85,.22,.32],'tailtap');
 hands.forEach(h=>proxy(h,'hand hit',[0,0,0],[.247,.247,.247],'shy'));
 function expression(mood,blink=false,strength=1){
  const close=blink||['smile','shy','sleep'].includes(mood);openEyes.forEach(m=>m.visible=!close&&mood!=='angry');closed.visible=close;eyes.angry.visible=!close&&mood==='angry';
  const smile=['smile','shy'].includes(mood);originalMouth.forEach(m=>m.visible=!smile);smiling.visible=smile;
  blushes.forEach(m=>m.material.opacity=['shy','smile'].includes(mood)?.96*strength:0);
  // Small translations preserve the already-approved curved bean surfaces.
  eyebrows.forEach((m,i)=>{m.position.y=(mood==='shy'?.028:mood==='angry'?-.028:0)*strength;m.position.x=(i?1:-1)*(mood==='angry'?-.018:0)*strength;});
 }
 const tailGrip=new THREE.Vector3(...TAIL_END).add(asset.position);
 const tailGripHeld=prepareTailTension(tail).add(asset.position);
 const result={root,rig,asset,headPivot,head,hands,tail,legs,expression,hitTargets,eyes,tailGrip,tailGripHeld,setAppearance:eyes.setAppearance};
 root.updateMatrixWorld(true);return result;
}
