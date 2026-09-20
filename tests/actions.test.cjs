const {test}=require('node:test'),assert=require('node:assert/strict');
const {createFin,HEAD_REST_PITCH}=require('../qa/lib/model.cjs');
const {Animator,ACTIONS,CONTACT_TIMES,TAIL_TAP_DURATION}=require('../qa/lib/animator.cjs');
test('triple tap produces exactly three contacts at normal and reduced frame rates, then returns idle',()=>{
 for(const step of [1/60,1/20,.1]){
  const events=[],model=createFin(),a=new Animator(model,(event,action,time)=>{if(event==='tail-contact')events.push(time);});
  a.play('tailtap');for(let elapsed=0;elapsed<TAIL_TAP_DURATION+.5;elapsed+=step)a.update(step);
  assert.deepEqual(events,CONTACT_TIMES);assert.equal(a.action,'idle');
  model.root.traverse(m=>{if(m.geometry)m.geometry.dispose();});
 }
});
test('interrupting and replaying a tail action cannot leave stale contact events',()=>{
 const events=[],a=new Animator(createFin(),event=>{if(event==='tail-contact')events.push(event);});a.play('tailtap');for(let i=0;i<9;i++)a.update(.05);assert.equal(events.length,1);
 a.play('shy');for(let i=0;i<90;i++)a.update(.05);assert.equal(events.length,1);
 a.play('tailtap');for(let i=0;i<100;i++)a.update(.05);assert.equal(events.length,4);
});
test('shy expression is visible, hands gather, and all of it resets on idle',()=>{
 const m=createFin(),a=new Animator(m);a.play('shy');for(let i=0;i<75;i++)a.update(1/60);
 assert.equal(m.head.getObjectByName('Closed soft eyes').visible,true);
 assert.ok(m.head.getObjectByName('Blush 1').material.opacity>.8);
 const deepBlush=m.head.getObjectByName('Blush 1').material.opacity;
 m.expression('smile');assert.equal(m.head.getObjectByName('Blush 1').material.opacity,deepBlush,'smile shares the deeper blush');
 assert.ok(Math.abs(m.hands[0].position.x)<.3);assert.ok(m.headPivot.rotation.x-HEAD_REST_PITCH>.04);
 a.play('idle');for(let i=0;i<60;i++)a.update(1/60);assert.equal(m.head.getObjectByName('Blush 1').material.opacity,0);
 assert.ok(Math.abs(m.hands[0].position.x)>.6);assert.ok(Math.abs(m.headPivot.rotation.x-HEAD_REST_PITCH)<.001);
});
test('all visible menu actions have implementations',()=>{
 const {MENU_ACTIONS}=require('../app/interactions.cjs');for(const [name]of MENU_ACTIONS)assert.ok(name in ACTIONS,name);
});
