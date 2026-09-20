const {test}=require('node:test'),assert=require('node:assert/strict');
const {createFin}=require('../qa/lib/model.cjs');
const {Animator,CONTACT_TIMES,TAIL_TAP_DURATION}=require('../qa/lib/animator.cjs');
const {normalize,migrateSettings}=require('../app/state.cjs');
test('each eye shrinks by 1/12 about its own original center',()=>{
 const m=createFin();for(const c of m.eyes.centers){const eye=m.head.getObjectByName(`Eye ${c.side} / rounded solid`);eye.geometry.computeBoundingBox();const b=eye.geometry.boundingBox;assert.ok(Math.abs((b.max.x-b.min.x)/c.width-11/12)<1e-5);assert.ok(Math.abs((b.max.y-b.min.y)/c.height-11/12)<1e-5);assert.ok(Math.abs((b.min.x+b.max.x)/2-c.x)<1e-6);assert.ok(Math.abs((b.min.y+b.max.y)/2-c.y)<1e-6);}
});
test('angry eyes replace neutral lids, and both expressions share the selected iris color',()=>{
 const m=createFin(),fin=m.head.getObjectByName('Iris L'),body=m.head.getObjectByName('Eye L / rounded solid'),base=body.material.color.getHexString();
 m.setAppearance('red');assert.equal(fin.material.color.getHexString(),'ed5266');assert.equal(body.material.color.getHexString(),base);
 m.expression('angry');assert.equal(m.eyes.angry.visible,true);assert.equal(body.visible,false);assert.equal(m.head.getObjectByName('Angry Iris L').material.color.getHexString(),'ed5266');
 m.expression('shy');assert.equal(m.eyes.closed.visible,true);assert.equal(m.eyes.angry.visible,false);
 m.expression('idle');assert.equal(body.visible,true);m.setAppearance('lavender');assert.equal(fin.material.color.getHexString(),'dfdcff');
});
test('three fast contacts reach the floor and happen within 0.6 seconds',()=>{
 assert.ok(CONTACT_TIMES[2]-CONTACT_TIMES[0]<.6);assert.ok(TAIL_TAP_DURATION<1.5);
 const m=createFin(),a=new Animator(m);a.play('tailtap');let previous=0;
 for(const target of CONTACT_TIMES){while(target-previous>.1){a.update(.1);previous+=.1;}a.update(target-previous);previous=target;assert.ok(m.tail.morphTargetInfluences[0]>.999,'tail reaches its ground-contact morph');}
});
test('walking faces toward movement on either side',()=>{
 const m=createFin(),a=new Animator(m);for(const direction of [-1,1]){a.walkDirection=direction;a.play('walk');for(let i=0;i<60;i++)a.update(1/60);assert.ok(Math.sin(m.root.rotation.y)*direction>.5);}
});
test('iris setting migrates safely and survives normalization',()=>{
 assert.equal(migrateSettings({settingsVersion:2,sound:false}).irisColor,'lavender');
 assert.equal(normalize(JSON.parse(JSON.stringify(normalize({irisColor:'red',sound:false})))).irisColor,'red');
 assert.equal(normalize({irisColor:'red',sound:false}).sound,false);assert.equal(normalize({irisColor:'purple-ish'}).irisColor,'lavender');
});
