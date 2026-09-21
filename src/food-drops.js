import * as THREE from 'three';
import {HAND_RADIUS} from './approved/hands.js';
import {drawFoodIcon,FOOD_INK_RATIO} from './food-icons.js';

export class ShakeGate{
 constructor(){this.charge=0;this.cooldown=0;}
 update(dt,{held,weight,x,y,reducedMotion}){
  this.cooldown=Math.max(0,this.cooldown-dt);
  if(!held||weight<.85||reducedMotion){this.charge=0;return false;}
  const speed=Math.hypot(x,y);
  if(speed<.18){this.charge=0;return false;}
  this.charge+=dt*Math.min(speed,1.2);
  if(this.charge<.13||this.cooldown>0)return false;
  this.charge=0;this.cooldown=.62;return true;
 }
 reset(){this.charge=0;this.cooldown=0;}
}

export function createFoodDrops(scene,model,{random=Math.random}={}){
 const group=new THREE.Group();group.name='Falling rice and strawberry cake';scene.add(group);
 const textures=['rice','cake'].map(kind=>{
  const texture=new THREE.CanvasTexture(drawFoodIcon(kind));texture.colorSpace=THREE.SRGBColorSpace;return texture;
 });
 const pool=[],gate=new ShakeGate();let serial=0;
 const MAX=6,handDiameter=HAND_RADIUS*2,origin=new THREE.Vector3(),bodyCenter=new THREE.Vector3();
 function spawn(x,y){
  bodyCenter.set(0,-1.57,.65);model.asset.localToWorld(bodyCenter);
  for(let n=0;n<2&&pool.length<MAX;n++){
   const side=serial%2?-1:1,kind=(Math.floor(serial/2)+serial%2)%2;serial++;
   const material=new THREE.SpriteMaterial({map:textures[kind],transparent:true,depthWrite:false,depthTest:false,rotation:side*(.1+random()*.20),toneMapped:false});
   const p=new THREE.Sprite(material);p.name=kind?'Strawberry cake':'White rice bowl';p.renderOrder=20;
   origin.set(side*(.69+random()*.1),-1.57+(random()-.5)*.25,.65);model.asset.localToWorld(origin);
   // Inversion reverses local left/right. Emit outward in world coordinates,
   // so the falling stickers skirt the cheeks instead of covering the eyes.
   const outward=Math.sign(origin.x-bodyCenter.x)||-side;
   p.position.copy(origin);p.position.x=bodyCenter.x+outward*(1.04+random()*.10);p.position.z=2;
   // Count the painted icon, not its transparent padding, against the hand.
   p.scale.setScalar(handDiameter*1.5*model.rig.scale.x/FOOD_INK_RATIO);
   p.userData={age:0,life:1.35+random()*.25,vx:outward*(.35+random()*.15)-x*.10,vy:.18+random()*.30+y*.1,spin:outward*(.4+random()*.45)};
   group.add(p);pool.push(p);
  }
 }
 function update(dt,animator){
  const motion=animator.dragMotion;
  if(gate.update(dt,{held:animator.action==='drag',weight:animator.carry.weight,x:motion.targetX,y:motion.targetY,reducedMotion:animator.reducedMotion}))spawn(motion.x,motion.y);
  for(let i=pool.length-1;i>=0;i--){
   const p=pool[i],d=p.userData;d.age+=dt;d.vy-=2.5*dt;p.position.x+=d.vx*dt;p.position.y+=d.vy*dt;p.material.rotation+=d.spin*dt;
   p.material.opacity=Math.min(1,d.age/.07)*Math.min(1,Math.max(0,(d.life-d.age)/.36));
   if(d.age>=d.life){group.remove(p);p.material.dispose();pool.splice(i,1);}
  }
 }
 function clear(){for(const p of pool){group.remove(p);p.material.dispose();}pool.length=0;gate.reset();}
 return {update,clear,items:()=>pool,get count(){return pool.length;},dispose(){clear();textures.forEach(t=>t.dispose());group.removeFromParent();}};
}
