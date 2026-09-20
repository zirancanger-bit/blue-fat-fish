import * as THREE from 'three';

// The suspension point is the narrow centre just before the two tail flukes.
// Rebase the entire rig about it: swinging cannot slide the tail out of the grip.
const HANG_GRIP=new THREE.Vector3(0,3.85,0);
const HANG_ROTATION=new THREE.Quaternion().setFromEuler(new THREE.Euler(.62,0,Math.PI));
const Z_AXIS=new THREE.Vector3(0,0,1),X_AXIS=new THREE.Vector3(1,0,0),IDENTITY=new THREE.Quaternion();
export class TailCarry{
 constructor(grip,heldGrip){this.restGrip=grip.clone();this.heldGrip=heldGrip.clone();this.grip=grip.clone();this.weight=0;this.target=new THREE.Vector3();this.rotated=new THREE.Vector3();this.swing=new THREE.Quaternion();}
 update(rig,{held,dt,time,motionX,motionY,lift,roll,strength}){
  this.weight=THREE.MathUtils.damp(this.weight,held?1:0,held?7.5:8,dt);
  if(Math.abs(this.weight-(held?1:0))<.0001)this.weight=held?1:0;
  const w=this.weight;
  this.grip.copy(this.restGrip).lerp(this.heldGrip,w);
  if(w===0){rig.scale.setScalar(1);rig.quaternion.setFromAxisAngle(Z_AXIS,roll);rig.position.set(0,lift,0);return;}
  // Leave extra room for the diagonal silhouette during the turn.
  const scale=1-.10*w-.12*Math.sin(Math.PI*w);
  rig.scale.setScalar(scale);
  rig.quaternion.copy(IDENTITY).slerp(HANG_ROTATION,w);
  const sway=(-motionX*.21+Math.sin(time*2.5)*.018)*w*strength+roll*(1-w);
  this.swing.setFromAxisAngle(Z_AXIS,sway);rig.quaternion.premultiply(this.swing);
  // Keep a little forward/back response, without turning the face away.
  this.swing.setFromAxisAngle(X_AXIS,motionY*.055*w*strength);
  rig.quaternion.premultiply(this.swing);
  this.target.copy(this.restGrip).lerp(HANG_GRIP,w);
  // Centre the wide diagonal silhouette inside the transparent window while
  // turning. The native grip follows this point, so it stays under the cursor.
  this.target.x+=1.05*Math.sin(Math.PI*w);
  this.rotated.copy(this.grip).multiplyScalar(scale).applyQuaternion(rig.quaternion);
  rig.position.copy(this.target).sub(this.rotated);rig.position.y+=lift*(1-w);
 }
}
