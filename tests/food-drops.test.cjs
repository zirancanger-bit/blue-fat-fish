const {test}=require('node:test'),assert=require('node:assert/strict');
test('food requires an established moving hold, stops on rest/release, and limits repeated drops',async()=>{
 const {ShakeGate}=await import('../src/food-drops.js');
 const gate=new ShakeGate(),state={held:true,weight:1,x:.8,y:0,reducedMotion:false};
 const run=(seconds,patch={})=>{let count=0;for(let t=0;t<seconds;t+=1/60)count+=Number(gate.update(1/60,{...state,...patch}));return count;};
 assert.equal(run(2,{held:false}),0);
 assert.equal(run(2,{weight:.6}),0);
 assert.equal(run(2,{x:0}),0);
 assert.equal(run(2,{reducedMotion:true}),0);
 const drops=run(10);assert.ok(drops>=10&&drops<=17,'cooldown bounds a prolonged shake');
 assert.equal(run(2,{x:0}),0,'stationary carry never emits');
 assert.equal(run(2,{held:false}),0,'release cannot emit');
});
