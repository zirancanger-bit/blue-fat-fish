const {test}=require('node:test'),assert=require('node:assert/strict');
const {createFin}=require('../qa/lib/model.cjs');
const {Animator}=require('../qa/lib/animator.cjs');

test('tail stays at the grip while the head hangs below it and the body swings',()=>{
 const m=createFin(),a=new Animator(m);a.play('drag');
 for(let i=0;i<110;i++)a.update(1/60);
 const point=()=>m.rig.localToWorld(m.tailGrip.clone());
 const grip=point(),head=m.head.getWorldPosition(m.tailGrip.clone());
 assert.ok(head.y<grip.y-1.8,'head hangs below the tail');
 const stretch=m.tail.userData.tension.index;
 assert.equal(m.tail.morphTargetInfluences[stretch],1,'held tail uses its straightened shape');
 assert.ok(m.tail.morphTargetInfluences.slice(0,stretch).every(v=>Math.abs(v)<1e-7),'tail cannot flap out of the grip');
 const feet=m.legs.map(leg=>leg.rotation.x);
 for(let i=0;i<18;i++)a.update(1/60);
 assert.ok(m.legs.every((leg,i)=>Math.abs(leg.rotation.x-feet[i])>.08),'both feet swing while held');
 assert.ok(Math.abs(m.legs[0].rotation.x+m.legs[1].rotation.x)<1e-7,'feet kick in opposite phases');
 for(const x of [-1,1,0]){a.setDragVelocity(x,.7);for(let i=0;i<60;i++)a.update(1/60);assert.ok(point().distanceTo(grip)<1e-7,'tail is pinned during swaying');}
 a.play('settle');for(let i=0;i<120;i++)a.update(1/60);
 assert.equal(a.action,'idle');assert.equal(a.carry.weight,0);
 assert.equal(m.rig.scale.x,1);assert.ok(m.rig.position.length()<1e-7);
 assert.equal(m.tail.morphTargetInfluences[stretch],0,'release restores the curved tail');
 assert.ok(m.legs.every(leg=>leg.rotation.x===0&&leg.rotation.z===0),'feet return to their resting pose');
 assert.ok(m.head.getWorldPosition(m.tailGrip.clone()).y>point().y,'head returns above the tail');
});

test('fast release, re-grab and a low frame rate retain continuous carry transforms',()=>{
 const m=createFin(),a=new Animator(m);a.reducedMotion=true;
 a.play('drag');for(let i=0;i<4;i++)a.update(.05);
 const before=m.rig.quaternion.clone();a.play('settle');a.update(.01);
 assert.ok(before.angleTo(m.rig.quaternion)<.2,'release does not snap upright');
 a.play('drag');for(let i=0;i<16;i++)a.update(.1);assert.ok(a.carry.weight>.999);
 a.play('idle');for(let i=0;i<16;i++)a.update(.1);
 assert.equal(a.carry.weight,0);assert.ok(m.rig.position.length()<1e-7);
});
