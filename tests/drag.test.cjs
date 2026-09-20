const {test}=require('node:test'),assert=require('node:assert/strict');
const {dragAnchor}=require('../app/state.cjs');
test('a fast drag preserves the pressed point even if native input has already reached its endpoint',()=>{
 const bounds={x:-600,y:200,width:400,height:490};
 const current={x:-300,y:315},origin=dragAnchor(bounds,{x:180,y:175},current);
 const moved={x:bounds.x+current.x-origin.x,y:bounds.y+current.y-origin.y};
 assert.deepEqual(moved,{x:-480,y:140});
 assert.deepEqual({x:current.x-moved.x,y:current.y-moved.y},{x:180,y:175});
});
test('invalid local coordinates fall back to the native anchor',()=>{
 const b={x:0,y:0,width:400,height:490},c={x:230,y:170};
 for(const p of [null,{x:Infinity,y:0},{x:900,y:0},{x:-1,y:30}])assert.deepEqual(dragAnchor(b,p,c),c);
});
