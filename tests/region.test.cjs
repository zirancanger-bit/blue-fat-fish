const {test}=require('node:test'),assert=require('node:assert/strict');
const {mergeRects,projectMaskRects,maskRectsFor,containsPoint,sameRects,toShapeRects}=require('../qa/lib/region.cjs');

test('touching and overlapping rectangles merge without changing the covered area',()=>{
 const rects=[[10,10,20,20],[20,10,30,20],[10,20,20,30],[12,12,18,18]];
 const merged=mergeRects(rects);
 const covered=(list,x,y)=>containsPoint(list,x,y);
 for(let x=0;x<40;x++)for(let y=0;y<40;y++)assert.equal(covered(merged,x+.5,y+.5),covered(rects,x+.5,y+.5),`cell ${x},${y}`);
 assert.ok(merged.length<rects.length);
});
test('rectangles are clamped to the window and empty ones are dropped',()=>{
 assert.deepEqual(mergeRects([[-20,-20,30,40],[100,100,100,140]]),[[0,0,30,40]]);
});
test('world rectangles are projected with the pet camera framing',()=>{
 // The camera looks at y=1.95 with half height 2.6335 for the reference canvas,
 // so the world point (0,0) in camera space lands on the canvas centre.
 const half=2.6335,width=400,canvasHeight=458,aspect=width/canvasHeight;
 const rects=projectMaskRects([[-half*aspect,0,half*aspect,half]],width,canvasHeight);
 assert.deepEqual(rects,[[0,0,width,canvasHeight/2]]);
});
test('the idle region covers the pet body but not the window corners',()=>{
 const rects=maskRectsFor(['idle'],400,458);
 assert.ok(rects.length>4&&rects.length<200,'region stays a small rectangle list');
 assert.ok(containsPoint(rects,200,300),'body centre is clickable');
 assert.ok(containsPoint(rects,200,140),'head area is clickable');
 assert.equal(containsPoint(rects,2,2),false,'top-left corner stays click-through');
 assert.equal(containsPoint(rects,398,456),false,'bottom-right corner stays click-through');
 assert.equal(containsPoint(rects,200,489),false,'the toolbar strip below the canvas is not baked in');
});
test('unknown actions fall back to the union of every pose',()=>{
 const fallback=maskRectsFor(['not-an-action'],400,458);
 const idle=maskRectsFor(['idle'],400,458);
 assert.ok(containsPoint(fallback,200,300));
 for(let x=0;x<400;x+=10)for(let y=0;y<458;y+=10)
  if(containsPoint(idle,x,y))assert.ok(containsPoint(fallback,x,y),`idle pose at ${x},${y}`);
});
test('a region grows or stays the same when the previous action is still fading out',()=>{
 const both=maskRectsFor(['idle','walk'],400,458);
 const idle=maskRectsFor(['idle'],400,458);
 for(let x=0;x<400;x+=7)for(let y=0;y<458;y+=7)
  if(containsPoint(idle,x,y))assert.ok(containsPoint(both,x,y));
});
test('rectangles are handed to the window shape as Electron rectangles',()=>{
 assert.deepEqual(toShapeRects([[1,2,11,22]]),[{x:1,y:2,width:10,height:20}]);
 assert.ok(sameRects([[1,2,3,4]],[[1,2,3,4]]));
 assert.equal(sameRects([[1,2,3,4]],[[1,2,3,5]]),false);
});
