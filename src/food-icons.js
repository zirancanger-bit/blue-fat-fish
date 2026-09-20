// Small, offline canvas stickers. Their painted width is 136/160 of the tile.
export const FOOD_INK_RATIO=136/160;
export function drawFoodIcon(kind){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 const c=canvas.getContext('2d');c.scale(256/160,256/160);
 c.lineWidth=3.5;c.lineJoin='round';c.lineCap='round';
 function path(d,fill,stroke='#74698e'){const p=new Path2D(d);if(fill){c.fillStyle=fill;c.fill(p);}if(stroke){c.strokeStyle=stroke;c.stroke(p);}}
 function oval(x,y,rx,ry,fill,stroke=null,angle=0){c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.stroke();}}
 if(kind==='rice'){
  path('M15 78 Q18 123 57 134 L104 134 Q140 122 146 78 Z','#ebf5ff');
  path('M29 99 Q46 122 64 124 L99 124 Q121 119 134 101 L126 120 Q115 137 81 139 Q44 138 29 113 Z','#ccdef6',null);
  oval(81,79,66,15,'#d6e4f5','#74698e');
  path('M23 78 Q20 61 37 58 Q38 42 53 43 Q62 25 78 35 Q94 23 107 40 Q125 38 130 56 Q145 58 139 79 Q83 94 23 78 Z','#fffef5');
  c.strokeStyle='#e3dcca';c.lineWidth=3;
  for(const [x,y,a]of [[44,67,-.4],[61,53,.5],[80,44,-.3],[97,53,.6],[116,66,-.4],[76,69,-.5],[96,76,.3],[55,78,.3]]){
   c.save();c.translate(x,y);c.rotate(a);c.beginPath();c.moveTo(-3,0);c.quadraticCurveTo(0,-2,4,0);c.stroke();c.restore();
  }
  path('M15 81 Q81 109 146 81',null,'#74698e');
  path('M24 96 Q81 121 137 96',null,'#a1b9e3');
  path('M56 133 L55 140 Q81 146 105 140 L104 133','#f6faff');
  path('M71 117 Q81 124 91 117',null,'#8aabd8');
 }else{
  // A cream-covered strawberry layer cake, drawn as one readable slice.
  path('M14 76 L94 55 L148 82 L148 126 L65 147 L14 118 Z','#ffdbac');
  path('M65 104 L148 82 L148 126 L65 147 Z','#ffc6ad',null);
  path('M15 95 L65 121 L147 99 L147 112 L65 135 L15 108 Z','#fff9f0',null);
  path('M16 102 L65 128 L147 106',null,'#ed879a');
  path('M14 76 L93 48 L148 77 L65 106 Z','#fffef9');
  path('M14 76 L65 106 L148 77 L148 90 Q139 99 134 92 Q123 108 114 99 Q100 115 91 106 Q76 122 65 119 L20 97 Q14 95 14 88 Z','#fffaf8');
  path('M65 119 L65 144',null,'#d3969b');
  // Whipped cream and a strawberry with tiny golden seeds.
  path('M61 66 Q54 59 64 51 Q60 44 72 40 Q70 31 81 28 Q95 42 93 52 Q105 57 99 65 Q83 76 61 66 Z','#fffef9');
  path('M78 49 Q62 35 72 22 Q82 13 91 24 Q104 16 111 29 Q116 41 95 59 Q87 63 78 49 Z','#f15c77','#ac466b');
  path('M89 26 L80 18 L88 18 L92 11 L97 20 L107 18 L101 27 L94 24 Z','#81b99b','#588d7b');
  c.lineWidth=2.3;c.strokeStyle='#fff1b3';
  for(const [x,y]of [[79,32],[91,35],[104,32],[85,44],[97,45]]){c.beginPath();c.moveTo(x,y);c.lineTo(x-1,y+3);c.stroke();}
  oval(38,112,4,2,'#f9b979',null,.4);oval(116,128,4,2,'#f5a582',null,-.25);
 }
 return canvas;
}
