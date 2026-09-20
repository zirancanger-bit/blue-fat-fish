import * as THREE from 'three';
import {HAND_POSES,tailWeights,applyTailWeights,HEAD_REST_PITCH} from './model.js';
import {tripleTailPose,crossedContacts,TAIL_TAP_DURATION} from './tail-sequence.js';
import {TailCarry} from './tail-carry.js';
export {CONTACT_TIMES,TAIL_TAP_DURATION} from './tail-sequence.js';
export const ACTIONS=Object.freeze({idle:Infinity,pet:3.4,shy:5.5,tailtap:TAIL_TAP_DURATION,wave:3.1,jump:1.8,star:1.8,dance:6.0,sleep:Infinity,wake:2.0,think:5,smile:4,angry:3.5,cool:4,boop:3.4,drag:Infinity,settle:.8,walk:Infinity});
const smooth=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
export class Animator{
 constructor(model,onEvent=()=>{}){Object.assign(this,{model,onEvent,action:'idle',elapsed:0,time:0,baseYaw:-.28,followCursor:true,reducedMotion:false,target:{x:0,y:0},look:{x:0,y:0},nextBlink:3.2,blinkAt:-100,walkDirection:1,dragMotion:{x:0,y:0,targetX:0,targetY:0},handPose:'rest',sleepWeight:0,carry:new TailCarry(model.tailGrip,model.tailGripHeld)});}
 play(action){if(action==='tail')action='tailtap';if(!(action in ACTIONS))return false;if(action==='wake'&&this.action!=='sleep')action='wave';this.action=action;this.elapsed=0;this.onEvent('start',action);return true;}
 setPointer(x,y){this.target.x=THREE.MathUtils.clamp(x,-1,1);this.target.y=THREE.MathUtils.clamp(y,-1,1);}
 setDragVelocity(x,y){this.dragMotion.targetX=THREE.MathUtils.clamp(Number(x)||0,-1,1);this.dragMotion.targetY=THREE.MathUtils.clamp(Number(y)||0,-1,1);}
 update(dt){
  dt=THREE.MathUtils.clamp(dt,0,.25);const prev=this.elapsed;this.time+=dt;this.elapsed+=dt;
  if(this.action==='tailtap')for(const contact of crossedContacts(prev,this.elapsed))this.onEvent('tail-contact','tailtap',contact);
  if(['jump','star'].includes(this.action)&&prev<.67&&this.elapsed>=.67)this.onEvent('catch',this.action);
  if(['jump','star'].includes(this.action)&&prev<1.10&&this.elapsed>=1.10)this.onEvent('land',this.action);
  if(this.elapsed>ACTIONS[this.action]){const old=this.action;this.action='idle';this.elapsed=0;this.onEvent('end',old);}
  const m=this.model,a=this.action,e=this.elapsed,t=this.time,duration=ACTIONS[a],fade=Number.isFinite(duration)?smooth(e/.28)*(1-smooth((e-duration+.40)/.40)):smooth(e/.35),strength=this.reducedMotion?.25:1;
  this.look.x=THREE.MathUtils.damp(this.look.x,this.followCursor&&a!=='drag'?this.target.x:0,4,dt);this.look.y=THREE.MathUtils.damp(this.look.y,this.followCursor&&a!=='drag'?this.target.y:0,4,dt);
  this.sleepWeight=THREE.MathUtils.damp(this.sleepWeight,a==='sleep'?1:0,4,dt);
  if(t>this.nextBlink){this.blinkAt=t;this.nextBlink=t+3+Math.random()*3;}
  const blink=t-this.blinkAt<.13;
  let mood='idle',handPose='rest',lift=0,roll=Math.sin(t*.7)*.006*strength,pitch=0,yaw=this.baseYaw+this.look.x*.07;
  if(['pet','smile','wave','dance'].includes(a))mood='smile';
  if(a==='shy'||a==='boop'){mood='shy';handPose='clasp';pitch=.08*fade;roll=.035*fade;yaw-=.18*fade;}
  if(a==='think'){handPose='clasp';pitch=.025*fade;roll=-.035*fade;}
  if(a==='angry'){mood='angry';handPose='clasp';roll=Math.sin(e*12)*.01*fade;}
  if(a==='cool')mood='cool';
  if(a==='sleep'||this.sleepWeight>.5){mood='sleep';pitch=.12*this.sleepWeight;roll=-.025*this.sleepWeight;}
  if(['jump','star'].includes(a)){lift=Math.max(0,Math.sin(Math.PI*(e-.18)/.92))*.33*strength*fade;handPose='raise';mood='smile';}
  if(a==='dance'){roll=Math.sin(e*5.8)*.055*fade*strength;lift=Math.abs(Math.sin(e*5.8))*.035*fade*strength;handPose='raise';}
  if(a==='wave')handPose='raise';
  if(a==='tailtap'){roll=0;yaw=THREE.MathUtils.lerp(yaw,-.70,fade);handPose='clasp';}
  this.dragMotion.x=THREE.MathUtils.damp(this.dragMotion.x,a==='drag'?this.dragMotion.targetX:0,6,dt);
  this.dragMotion.y=THREE.MathUtils.damp(this.dragMotion.y,a==='drag'?this.dragMotion.targetY:0,6,dt);
  if(a==='drag'){pitch=-.025;mood='shy';handPose='raise';yaw=-.24;roll=0;}
  if(a==='settle')lift=Math.abs(Math.sin(e*12))*Math.exp(-e*6)*.04*strength;
  if(a==='walk'){yaw=this.walkDirection>0?.58:-.58;roll=Math.sin(e*9)*.015*strength;}
  m.root.rotation.y=THREE.MathUtils.damp(m.root.rotation.y,yaw,6,dt);
  this.carry.update(m.rig,{held:a==='drag',dt,time:t,motionX:this.dragMotion.x,motionY:this.dragMotion.y,lift,roll,strength});
  m.tailGrip.copy(this.carry.grip);
  m.headPivot.rotation.x=THREE.MathUtils.damp(m.headPivot.rotation.x,HEAD_REST_PITCH+pitch-this.look.y*.018,7,dt);m.headPivot.rotation.z=THREE.MathUtils.damp(m.headPivot.rotation.z,(a==='shy'?.015:Math.sin(t*.6)*.005)*strength,7,dt);
  this.handPose=handPose;
  m.hands.forEach((h,i)=>{
   let target=HAND_POSES[handPose][i].slice();
   if(a==='wave'&&i===0)target=HAND_POSES.rest[i].slice();
   if(a==='wave'&&i===1){target[0]+=Math.sin(e*9)*.085*fade*strength;target[1]+=.06*fade;}
   if(a==='shy'||a==='boop'){target[1]+=Math.sin(e*3)*.018*fade;target[0]+=(i?1:-1)*.012*fade;}
   if(a==='dance')target[1]+=Math.sin(e*5.8+i*Math.PI)*.10*fade*strength;
   if(a==='walk')target[2]+=Math.sin(e*9+i*Math.PI)*.07*strength;
   if(a==='drag'){target[0]+=(i?1:-1)*Math.sin(e*4.5)*.025*strength;target[1]+=.025*Math.sin(e*3.2+i)*strength;}
   for(let k=0;k<3;k++){const axis=['x','y','z'][k];h.position[axis]=THREE.MathUtils.damp(h.position[axis],target[k],9,dt);}
  });
  m.legs.forEach((leg,i)=>{
   const phase=e*9+i*Math.PI,w=this.carry.weight*strength;
   leg.position.y=-1.85+(a==='walk'?Math.max(0,Math.sin(phase))*.055*strength:0);
   leg.rotation.x=(a==='walk'?Math.sin(phase)*.085*strength:0)+w*(Math.sin(t*3.4+i*Math.PI)*.18+this.dragMotion.y*.07);
   leg.rotation.z=w*((i?-.055:.055)+Math.sin(t*2.8+i*1.9)*.045);
  });
  let tailMode='idle',tailTime=t;
  if(a==='tailtap'){const pose=tripleTailPose(e,m.tail.userData.motion.impactAngle);tailMode=pose.mode;tailTime=pose.time;}
  else if(a==='sleep'){tailMode='idle';tailTime=t*.35;}
  const weights=tailWeights(tailMode,tailTime,m.tail.userData.motion.impactAngle);
  const quiet=(a==='sleep'?.25:this.reducedMotion&&a!=='tailtap'?.3:1)*(1-this.carry.weight);
  applyTailWeights(m.tail,weights.map(w=>w*quiet));m.tail.morphTargetInfluences[m.tail.userData.tension.index]=this.carry.weight;
  m.expression(mood,blink,mood==='shy'?fade:1);m.root.updateMatrixWorld(true);
 }
}
