import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Coordinates are traced from the corrected front view, normalized to a 2.2-unit head.
// X is character horizontal, Y is up, +Z is the face. Reference circles are excluded.
const EYE_BLUE='#564fff';
export const PALETTE = { shell: '#97abff', ink: EYE_BLUE, fin: EYE_BLUE, white: '#ffffff', iris: '#dfdcff', nape: '#cdd7ff' };
const X = p => (p - 411) / 210, Y = p => (335 - p) / 210;
const clamp = THREE.MathUtils.clamp;

function path(commands, mirror = false, offset = 0) {
  const s = new THREE.Shape();
  const x = n => (mirror ? -X(n) : X(n))+offset;
  for (const [op, ...v] of commands) {
    if (op === 'M') s.moveTo(x(v[0]), Y(v[1]));
    if (op === 'L') s.lineTo(x(v[0]), Y(v[1]));
    if (op === 'C') s.bezierCurveTo(x(v[0]), Y(v[1]), x(v[2]), Y(v[3]), x(v[4]), Y(v[5]));
    if (op === 'Q') s.quadraticCurveTo(x(v[0]), Y(v[1]), x(v[2]), Y(v[3]));
  }
  s.closePath();
  return s;
}

const smooth = (a,b,x) => {const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const headWidth = y => 1.087*Math.max(0,1-(y/(y>=0?1.01:1.18))**2)**(y>=0?.50:.16);
const headDepth = y => Math.max(0,1-(y/(y>=0?1.01:1.16))**2)**.46;
function eyePressure(x,y) {
  return .085*Math.exp(-(((Math.abs(x)-(.39+EYE_SPREAD))/.255)**4)-((y+.305)/.125)**2);
}
function frontDepth(x,y) {
  const w=Math.max(.001,headWidth(y));
  return .99*headDepth(y)*Math.sqrt(Math.max(0,1-(x/w)**2))-eyePressure(x,y);
}
// A separate solid white head under the hair. Its lower front is the actual chin;
// there is deliberately no blue contour or blue strip underneath it.
function faceWidth(y) {return .995*(1-.13*smooth(-.36,-.85,y))*Math.max(0,1-((y+.06)/.98)**2)**(.34+.10*smooth(-.30,-.80,y))*(1+.075*Math.exp(-(((y+.79)/.19)**2)));}
function chinY(x) {
  let lo=-1.04,hi=-.55;
  for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(faceWidth(mid)<Math.abs(x))lo=mid;else hi=mid;}
  return (lo+hi)/2;
}
function faceBaseDepth(x,y) {
  const w=Math.max(.001,faceWidth(y));
  return .035+(.90-.065*smooth(-.55,-.23,y))*Math.max(0,1-((y+.06)/.98)**2)**.40*Math.sqrt(Math.max(0,1-(x/w)**2));
}
const smoother=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*t*(t*(t*6-15)+10);};
const MUZZLE_PROJECTION=.0875;
const CHEEK_FULLNESS=.12;
// Measured from revision 04's mouth, including its round stroke and end caps.
const MOUTH_DROP=.06122143852214024;
function cheekDepth(x,y) {
  const w=faceWidth(y),a=Math.abs(x);
  if(w<=0||a>=w)return 0;
  // Broad, shallow cheek pads below the eyes. Smooth support preserves the
  // central muzzle, eye seats, and closed side/chin seams without hard edges.
  // Gradually blend the cheek into the centre instead of switching it on in
  // a narrow band next to the nose, which reads as a nasolabial crease.
  const across=Math.exp(-(((a-(.43+EYE_SPREAD))/.29)**2))*(1-Math.exp(-((a/.20)**2)))*(1-smoother(.82,.99,a/w));
  // Spread the upper cheek transition across the whole under-eye area.
  // The old short ramp formed a horizontal shelf exposed by closed eyelids.
  const below=smoother(-.16,-.73,y)*(1-smoother(-.89,-1.025,y));
  return CHEEK_FULLNESS*across*below*Math.exp(-(((y+.79)/.31)**2));
}
function sculptedFaceDepth(x,y) {
  // A broader falloff bridges nose and cheeks, retaining the exact centreline
  // height and chin silhouette while filling the two shallow side troughs.
  const base=faceBaseDepth(x,y)+cheekDepth(x,y),support=Math.min(.50,faceWidth(y)*.90);
  if(support<=0||Math.abs(x)>=support)return base;
  // A single C2-continuous mound avoids the crease between two intersecting
  // nose/lip pads. Its nose projection is exactly half the previous 0.175.
  // Offset the mound's centre so the nose keeps its eye-bottom height.
  const h=.0001,upper=.15;
  const slope=(faceBaseDepth(0,EYE_BOTTOM_Y+h)-faceBaseDepth(0,EYE_BOTTOM_Y-h))/(2*h);
  const centre=EYE_BOTTOM_Y-slope*upper*upper/(2*MUZZLE_PROJECTION);
  const width=upper+.095*smoother(centre,centre-.12,y);
  const noseOffset=(EYE_BOTTOM_Y-centre)/upper;
  const lengthwise=Math.exp(noseOffset*noseOffset-((y-centre)/width)**2);
  // The longer lower lobe rolls into the chin, then disappears smoothly at
  // the closed bottom pole. No independent lip shelf or carved crease.
  const chinTurn=1-smoother(-.925,-1.035,y);
  const crosswise=Math.max(0,1-(x/support)**2)**3;
  return base+MUZZLE_PROJECTION*lengthwise*crosswise*chinTurn;
}
function faceDepth(x,y) {
  const original=sculptedFaceDepth(x,y),bottom=-.88,top=-.22;
  if(y<=bottom||y>=top)return original;
  // One broad tangent-matched surface joins the upper face to the cheeks.
  // Sample along a face meridian, preserving the side silhouette and chin.
  const u=x/Math.max(.001,faceWidth(y));
  const weight=1-smoother(.72,.98,Math.abs(u));
  if(!weight)return original;
  const sample=v=>sculptedFaceDepth(u*faceWidth(v),v),h=.001,span=top-bottom,t=(y-bottom)/span;
  const a=sample(bottom),b=sample(top),da=(sample(bottom+h)-sample(bottom-h))/(2*h),db=(sample(top+h)-sample(top-h))/(2*h);
  const rounded=(2*t*t*t-3*t*t+1)*a+(t*t*t-2*t*t+t)*span*da+(-2*t*t*t+3*t*t)*b+(t*t*t-t*t)*span*db;
  return THREE.MathUtils.lerp(original,rounded,weight);
}
function eyeDepth(x,y) {
  // Smooth support bridges the face / hair junction; the hair underneath has
  // a real shallow depression rather than an overlaid dark painted outline.
  const unpressed=frontDepth(x,y)+eyePressure(x,y);
  const a=faceDepth(x,y),b=unpressed-.018,d=a-b;
  // Smooth the support union so the glass does not inherit a reflection seam.
  return (a+b+Math.sqrt(d*d+.04*.04))*.5;
}

// Longitude starts at the forehead. A varying hem creates a real open front,
// two rounded side locks and the inverted-V rear fold without separate decals.
const hemKeys=[[0,-.033],[.27,-.267],[.52,-.405],[.67,-.77],[.87,-1.025],
  [1.02,-1.04],[1.22,-1.03],[1.57,-1.01],[1.92,-.965],[2.30,-.90],
  [2.53,-.785],[2.80,-.65],[Math.PI,-.57]];
function hemHeight(a) {
  a=Math.acos(Math.cos(a));let i=0;while(i<hemKeys.length-2&&a>hemKeys[i+1][0])i++;
  const [a0,v0]=hemKeys[i],[a1,v1]=hemKeys[i+1],t=(a-a0)/(a1-a0),d=a1-a0;
  const prev=hemKeys[Math.max(0,i-1)],next=hemKeys[Math.min(hemKeys.length-1,i+2)];
  const m0=i===0?0:(v1-prev[1])/(a1-prev[0]);
  const m1=i===hemKeys.length-2?0:(next[1]-v0)/(next[0]-a0);
  return (2*t*t*t-3*t*t+1)*v0+(t*t*t-2*t*t+t)*d*m0+(-2*t*t*t+3*t*t)*v1+(t*t*t-t*t)*d*m1;
}
function hairPoint(a,y) {
  const c=Math.cos(a),x=headWidth(y)*Math.sin(a);
  return new THREE.Vector3(x,y,(c>=0?.99:1.08)*headDepth(y)*c-(c>0?eyePressure(x,y)*c*c:0));
}
function innerHem(a) {
  const p=hairPoint(a,hemHeight(a)),back=smooth(1.27,1.90,Math.acos(Math.cos(a)));
  const q=new THREE.Vector3(p.x*.84,p.y+.050,p.z-.19*Math.cos(a));
  // This sloping blue underside is a continuous convex turnaround face of the
  // hair. It reaches the lower seam; it is not an inset hole in the rear cap.
  const bx=.34*Math.sin(a);
  const bottom=chinY(bx)-.002;
  q.lerp(new THREE.Vector3(bx,bottom,.12+.20*Math.cos(a)),back);
  return q;
}
function innerHairPoint(a,t) {
  const b=innerHem(a),h=hemHeight(a),y=1.01+(h-1.01)*(1-Math.cos(t*Math.PI/2));
  return hairPoint(a,y).multiplyScalar(.77).add(b.clone().sub(hairPoint(a,h).multiplyScalar(.77)).multiplyScalar(t**4));
}
function makeHairGeometry() {
  const cols=192,rows=64,roll=14,p=[],idx=[],groups=[];
  const add=v=>{p.push(v.x,v.y,v.z);return p.length/3-1;};
  const rings=[];
  // One connected ring grid: outer cap -> turned hem -> inner cap, with shared
  // vertices at both joins. The back fold is a material group on this same mesh.
  for(let j=1;j<=rows;j++){
    const t=j/rows,ring=[];
    for(let i=0;i<cols;i++){
      const a=i*2*Math.PI/cols,y=1.01+(hemHeight(a)-1.01)*(1-Math.cos(t*Math.PI/2));
      ring.push(add(hairPoint(a,y)));
    }rings.push(ring);
  }
  for(let j=1;j<=roll;j++){
    const t=j/roll,ring=[];
    for(let i=0;i<cols;i++){
      const a=i*2*Math.PI/cols,A=hairPoint(a,hemHeight(a)),B=innerHem(a),v=A.clone().lerp(B,t);
      const back=smooth(1.27,1.9,Math.acos(Math.cos(a)));
      // Roll the thicker front edge down and inward, with tangents matching
      // both skins. The outer head silhouette and the eye indent stay in place.
      const outDir=A.clone().sub(hairPoint(a,hemHeight(a)+.025)).normalize();
      const inDir=innerHairPoint(a,.995).sub(B).normalize();
      const length=A.distanceTo(B)*.32;
      const rounded=new THREE.CubicBezierCurve3(A,A.clone().addScaledVector(outDir,length),B.clone().addScaledVector(inDir,-length),B).getPoint(t);
      v.z+=Math.sin(t*Math.PI)*Math.cos(a)*.055*back;
      v.lerp(rounded,1-back);
      ring.push(add(v));
    }rings.push(ring);
  }
  for(let j=rows-1;j>=1;j--){
    const t=j/rows,ring=[];
    for(let i=0;i<cols;i++){
      const a=i*2*Math.PI/cols;ring.push(add(innerHairPoint(a,t)));
    }rings.push(ring);
  }
  const top=add(new THREE.Vector3(0,1.01,0)),insideTop=add(new THREE.Vector3(0,1.01*.77,0));
  const byMat=[[],[]];
  for(let i=0;i<cols;i++)byMat[0].push(top,rings[0][i],rings[0][(i+1)%cols]);
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<cols;i++){
    const k=(i+1)%cols,a=rings[j][i],b=rings[j+1][i],c=rings[j][k],d=rings[j+1][k];
    const back=Math.cos((i+.5)*2*Math.PI/cols)<-.025;
    const mat=j>=rows-1&&(j>=rows+roll-1||back)?1:0;
    byMat[mat].push(a,b,c,c,b,d);
  }
  const last=rings.at(-1);for(let i=0;i<cols;i++)byMat[1].push(last[i],insideTop,last[(i+1)%cols]);
  for(let m=0;m<byMat.length;m++){groups.push([idx.length,byMat[m].length,m]);for(const index of byMat[m])idx.push(index);}
  // The rear hem flows above the rounded jaw directly, avoiding a projected
  // clipping operation that would carve notches into the thicker hair tips.
  // Soften the underside transition after fitting it around the round jaw.
  // All rings remain connected; no separate edge strip or extra rim is added.
  const neighbors=Array.from({length:p.length/3},()=>new Set());
  for(let i=0;i<idx.length;i+=3)for(let j=0;j<3;j++){const a=idx[i+j],b=idx[i+(j+1)%3];neighbors[a].add(b);neighbors[b].add(a);}
  for(let pass=0;pass<6;pass++){
    const next=p.slice();
    for(let i=0;i<neighbors.length;i++){
      const amount=.34*smooth(-.68,-.96,p[i*3+1]);if(!amount)continue;
      const near=neighbors[i];let x=0,y=0,z=0;for(const j of near){x+=p[j*3];y+=p[j*3+1];z+=p[j*3+2];}
      next[i*3]+=(x/near.size-p[i*3])*amount;next[i*3+1]+=(y/near.size-p[i*3+1])*amount;next[i*3+2]+=(z/near.size-p[i*3+2])*amount;
    }for(let i=0;i<p.length;i++)p[i]=next[i];
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);
  for(const group of groups)g.addGroup(...group);g.computeVertexNormals();return g;
}
function makeFaceGeometry() {
  const cols=128,rows=72,p=[],idx=[];
  const add=(x,y,z)=>{p.push(x,y,z);return p.length/3-1;};
  const top=add(0,.92,.035),rings=[];
  const angles=Array.from({length:rows-1},(_,i)=>(i+1)*Math.PI/rows);
  for(let j=0;j<=36;j++)angles.push(Math.acos((-.42-.605*j/36+.06)/.98));
  angles.push(Math.acos((EYE_BOTTOM_Y+.06)/.98));angles.sort((a,b)=>a-b);
  for(const t of angles){
    const y=-.06+.98*Math.cos(t),w=faceWidth(y),ring=[];
    for(let i=0;i<cols;i++){
      const a=i*2*Math.PI/cols,c=Math.cos(a),x=w*Math.sin(a);
      const z=c>=0?faceDepth(x,y):.035+.67*Math.sin(t)*c;
      ring.push(add(x,y,z));
    }rings.push(ring);
  }
  const bottom=add(0,-1.04,.035);
  for(let i=0;i<cols;i++)idx.push(top,rings[0][i],rings[0][(i+1)%cols]);
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<cols;i++){
    const k=(i+1)%cols,a=rings[j][i],b=rings[j+1][i],c=rings[j][k],d=rings[j+1][k];idx.push(a,b,c,c,b,d);
  }
  for(let i=0;i<cols;i++)idx.push(rings.at(-1)[i],bottom,rings.at(-1)[(i+1)%cols]);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();
  // Extra mouth/cheek rings have uneven spacing. Use the actual surface
  // derivative on the front instead of letting ring spacing bias its normals.
  const normal=g.attributes.normal,h=.0002,v=new THREE.Vector3();
  for(let i=0;i<p.length;i+=3){
    const x=p[i],y=p[i+1],z=p[i+2];
    if(z<=.036||Math.abs(x)>faceWidth(y)*.985)continue;
    v.set(-(faceDepth(x+h,y)-faceDepth(x-h,y))/(2*h),-(faceDepth(x,y+h)-faceDepth(x,y-h))/(2*h),1).normalize();
    normal.setXYZ(i/3,v.x,v.y,v.z);
  }
  return g;
}

// Subdivide each face before projecting: markings wrap the volume instead of floating as cards.
function conform(shape, surface, lift=.012, subdivisions=2) {
  let g=new THREE.ShapeGeometry(shape,12).toNonIndexed();
  let p=Array.from(g.attributes.position.array);g.dispose();
  for(let n=0;n<subdivisions;n++) {
    const out=[];
    for(let i=0;i<p.length;i+=9) {
      const a=p.slice(i,i+3),b=p.slice(i+3,i+6),c=p.slice(i+6,i+9);
      const ab=a.map((v,k)=>(v+b[k])/2),bc=b.map((v,k)=>(v+c[k])/2),ca=c.map((v,k)=>(v+a[k])/2);
      out.push(...a,...ab,...ca,...ab,...b,...bc,...ca,...bc,...c,...ab,...bc,...ca);
    }
    p=out;
  }
  for(let i=0;i<p.length;i+=3)p[i+2]=surface(p[i],p[i+1])+lift;
  if(lift<0)for(let i=0;i<p.length;i+=9)for(let k=0;k<3;k++){const t=p[i+3+k];p[i+3+k]=p[i+6+k];p[i+6+k]=t;}
  const normals=[];
  for(let i=0;i<p.length;i+=3){const x=p[i],y=p[i+1],h=.0005;const n=new THREE.Vector3(-(surface(x+h,y)-surface(x-h,y))/(2*h),-(surface(x,y+h)-surface(x,y-h))/(2*h),1).normalize();if(lift<0)n.negate();normals.push(n.x,n.y,n.z);}
  g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  return g;
}

const forehead = [
  ['M',352,265],['C',331,256,292,261,273,275],['C',253,290,232,318,230,334],
  ['C',225,352,239,369,255,371],['C',278,375,279,355,287,343],
  ['C',306,315,332,291,351,281],['C',360,277,361,269,352,265],
];
const eye = [
  ['M',291,394],['C',315,389,349,386,365,391],['C',379,393,382,406,380,425],
  ['C',380,450,374,466,357,471],['C',337,479,310,471,298,464],
  ['C',282,455,279,441,280,424],['C',280,410,282,400,291,394],
];
const EYE_POINTS=path(eye).getSpacedPoints(128).slice(0,-1);
const EYE_BOTTOM_Y=Math.min(...EYE_POINTS.map(p=>p.y));
const EYE_MIN_X=Math.min(...EYE_POINTS.map(p=>p.x));
const EYE_MAX_X=Math.max(...EYE_POINTS.map(p=>p.x));
const EYE_WIDTH=EYE_MAX_X-EYE_MIN_X;
// The two underlying eye bodies keep their 0.8-width gap; lids are separate solids.
const EYE_SPREAD=(EYE_WIDTH*.8+2*EYE_MAX_X)/2;
// Rigid inset of the complete eye assembly. The actual hair-mesh clearance
// at the lower outer eye edge limits the translation; retain a small margin.
const EYE_INSET=.0115;
const EYE_CENTRE=EYE_POINTS.reduce((a,p)=>a.add(p),new THREE.Vector2()).multiplyScalar(1/EYE_POINTS.length);
function eyeSurface(x,y) {
  const u=(Math.abs(x)-(Math.abs(EYE_CENTRE.x)+EYE_SPREAD))/(EYE_WIDTH*.53);
  const v=(y-EYE_CENTRE.y)/.245;
  return eyeDepth(x,y)+.031+.035*Math.max(0,1-u*u-v*v)**2;
}

function makeEyeGeometry(mirror) {
  const offset=(mirror?1:-1)*EYE_SPREAD;
  const outline=EYE_POINTS.map(p=>new THREE.Vector2((mirror?-p.x:p.x)+offset,p.y));
  if(THREE.ShapeUtils.isClockWise(outline))outline.reverse();
  const center=outline.reduce((a,p)=>a.add(p),new THREE.Vector2()).multiplyScalar(1/outline.length);
  const positions=[],indices=[],rings=[],n=outline.length;
  const add=(x,y,z)=>{positions.push(x,y,z);return positions.length/3-1;};
  const front=eyeSurface;
  const poleFront=add(center.x,center.y,front(center.x,center.y));
  // Front cap, rounded rim, shallow wall, back cap: one closed solid eye.
  const sections=[];
  for(let j=1;j<=10;j++)sections.push([j/10,0,true]);
  sections.push([.983,-.003],[.996,-.009],[1,-.016],[1,-.056],[.996,-.063],[.983,-.069],[.962,-.072]);
  for(let j=9;j>=1;j--)sections.push([.962*j/10,-.072]);
  for(const [r,z,frontCap]of sections){
    const ring=[];for(const point of outline){
      // Keep the established glass surface and rounded edge sampling.
      const radial=frontCap?r*(.94-.055*smooth(center.y-.015,center.y+.12,point.y)):r;
      const x=THREE.MathUtils.lerp(center.x,point.x,radial),y=THREE.MathUtils.lerp(center.y,point.y,radial);ring.push(add(x,y,front(x,y)+z));
    }rings.push(ring);
  }
  const poleBack=add(center.x,center.y,front(center.x,center.y)-.072);
  for(let i=0;i<n;i++)indices.push(poleFront,rings[0][i],rings[0][(i+1)%n]);
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<n;i++){const k=(i+1)%n,a=rings[j][i],b=rings[j+1][i],c=rings[j][k],d=rings[j+1][k];indices.push(a,b,c,c,b,d);}
  for(let i=0;i<n;i++)indices.push(rings.at(-1)[i],poleBack,rings.at(-1)[(i+1)%n]);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);
  g.computeVertexNormals();
  // Analytic front normals keep sharp glass reflections continuous across
  // the radial mesh and the separately colored iris surface.
  const normal=g.attributes.normal,h=.0005;
  for(let i=0;i<=10*n;i++){
    const x=positions[i*3],y=positions[i*3+1];
    const v=new THREE.Vector3(-(front(x+h,y)-front(x-h,y))/(2*h),-(front(x,y+h)-front(x,y-h))/(2*h),1).normalize();
    normal.setXYZ(i,v.x,v.y,v.z);
  }
  return g;
}

// A broad upper stroke with a clean tapered inner corner and a longer outer
// downstroke, traced to match the user's eyeliner paint-over. This is a
// separate solid sitting over the glass, not a dark rim inside the eye.
const upperEyeliner=[
  ['M',292,454],['C',285,452,281,447,279,439],
  ['C',276,423,271,407,267,393],['Q',265,386,266,384],
  ['Q',267,383,270,385],['L',278,388],['C',298,385,316,379,339,378],
  ['C',357,377,368,387,377,399],['C',381,405,384,410,385,413],
  ['Q',386,416,382,414],['C',377,412,373,407,369,404],
  ['C',361,398,353,397,340,397],['C',321,399,301,400,287,398],
  ['C',288,413,290,430,294,443],['Q',297,453,292,454],
];
function makeUpperEyeliner(mirror, commands=upperEyeliner) {
  if(mirror){
    // Reuse exactly the same tessellation on both sides, including normals.
    const g=makeUpperEyeliner(false,commands);g.scale(-1,1,1);
    const ix=g.index.array;for(let i=0;i<ix.length;i+=3){const t=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=t;}
    return g;
  }
  const offset=(mirror?1:-1)*EYE_SPREAD;
  const g0=new THREE.ExtrudeGeometry(path(commands,mirror,offset),{
    depth:.032,bevelEnabled:true,bevelSegments:3,steps:1,
    bevelSize:.0028,bevelThickness:.004,curveSegments:12,
  });
  // Uniform subdivision keeps shared cap/wall edges watertight while bending
  // the entire strip to the head. Bevels give both ends a softly rounded edge.
  let p=Array.from(g0.attributes.position.array);g0.dispose();
  for(let pass=0;pass<2;pass++){
    const out=[];
    for(let i=0;i<p.length;i+=9){
      const a=p.slice(i,i+3),b=p.slice(i+3,i+6),c=p.slice(i+6,i+9);
      const ab=a.map((v,k)=>(v+b[k])/2),bc=b.map((v,k)=>(v+c[k])/2),ca=c.map((v,k)=>(v+a[k])/2);
      out.push(...a,...ab,...ca,...ab,...b,...bc,...ca,...bc,...c,...ab,...bc,...ca);
    }p=out;
  }
  for(let i=0;i<p.length;i+=3){
    const x=p[i],y=p[i+1],t=clamp((p[i+2]+.004)/.040,0,1);
    const front=eyeSurface(x,y)+.034;
    const back=Math.min(frontDepth(x,y)-.007,eyeSurface(x,y)-.020);
    p[i+2]=THREE.MathUtils.lerp(back,front,t);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  const welded=mergeVertices(g,1e-6);g.dispose();welded.computeVertexNormals();
  const pos=welded.attributes.position,normal=welded.attributes.normal,h=.0005;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i);
    if(Math.abs(pos.getZ(i)-eyeSurface(x,y)-.034)>1e-5)continue;
    const v=new THREE.Vector3(-(eyeSurface(x+h,y)-eyeSurface(x-h,y))/(2*h),-(eyeSurface(x,y+h)-eyeSurface(x,y-h))/(2*h),1).normalize();
    normal.setXYZ(i,v.x,v.y,v.z);
  }
  return welded;
}

function ellipse(cx,cy,rx,ry,rotation=0) {
  const s=new THREE.Shape();s.absellipse(X(cx),Y(cy),rx/210,ry/210,0,Math.PI*2,false,rotation);return s;
}

// Curving a sparsely triangulated front cap and its separate painted markings
// creates mismatched planes. Subdivide both first, then bend and smooth them.
function prepareFinSurface(geometry,maxEdge=.065) {
  const raw=geometry.index?geometry.toNonIndexed():geometry;
  const src=raw.attributes.position.array,out=[];
  const midpoint=(a,b)=>a.map((v,k)=>(v+b[k])/2);
  function triangle(a,b,c,depth=0){
    const dist=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);
    if(depth<5&&Math.max(dist(a,b),dist(b,c),dist(c,a))>maxEdge){
      const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);
      triangle(a,ab,ca,depth+1);triangle(ab,b,bc,depth+1);triangle(ca,bc,c,depth+1);triangle(ab,bc,ca,depth+1);
    }else out.push(...a,...b,...c);
  }
  for(let i=0;i<src.length;i+=9)triangle(Array.from(src.slice(i,i+3)),Array.from(src.slice(i+3,i+6)),Array.from(src.slice(i+6,i+9)));
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(out,3));
  const result=mergeVertices(g,1e-5);g.dispose();if(raw!==geometry)raw.dispose();geometry.dispose();return result;
}

export function createModel() {
  const root=new THREE.Group();root.name='FinHead_01';
  root.userData={title:'Fin-ear head · soft nose-cheek transition revision 10',reference:'Corrected three-view drawing, eyeliner paint-over and head refinement feedback by the user',axes:'X horizontal, Y up, +Z front',notes:'Smooth broad transition from nose to cheeks. Ear fins match the eye blue. Fitted glass-like eyes and crisp raised upper eyeliner.',eyeBottomY:EYE_BOTTOM_Y,noseTipY:EYE_BOTTOM_Y,noseBaseZ:faceBaseDepth(0,EYE_BOTTOM_Y),muzzleProjection:MUZZLE_PROJECTION,previousMuzzleProjection:.175,cheekFullness:CHEEK_FULLNESS,mouthDrop:MOUTH_DROP,eyeThickness:.072,eyeWidth:EYE_WIDTH,eyeSpread:EYE_SPREAD,targetEyeGapRatio:.8,eyeInset:EYE_INSET};
  const mats={};
  for(const [k,c] of Object.entries(PALETTE))mats[k]=new THREE.MeshStandardMaterial({name:k,color:c,roughness:.86,metalness:0,side:THREE.DoubleSide});
  for(const key of ['shell','fin','nape'])mats[key]=new THREE.MeshPhysicalMaterial({name:key,color:PALETTE[key],roughness:.39,metalness:0,clearcoat:.23,clearcoatRoughness:.27,ior:1.4,specularIntensity:.60,envMapIntensity:.45,side:THREE.DoubleSide});
  mats.nape.roughness=.53;mats.nape.clearcoat=.12;mats.nape.specularIntensity=.45;
  const skinWhite=new THREE.MeshPhysicalMaterial({name:'white skin marking',color:PALETTE.white,roughness:.39,metalness:0,clearcoat:.23,clearcoatRoughness:.27,ior:1.4,specularIntensity:.60,envMapIntensity:.45,side:THREE.DoubleSide});
  mats.white.envMapIntensity=.13;mats.ink.roughness=.52;mats.ink.envMapIntensity=.20;mats.iris.roughness=.52;mats.iris.envMapIntensity=.20;
  const glassEye=new THREE.MeshPhysicalMaterial({name:'Violet glass eye',color:PALETTE.ink,roughness:.085,metalness:0,ior:1.50,specularIntensity:1,clearcoat:1,clearcoatRoughness:.035,envMapIntensity:3.2});
  const glassIris=glassEye.clone();glassIris.name='Lavender glass iris';glassIris.color.set(PALETTE.iris);
  const liner=new THREE.MeshStandardMaterial({name:'Raised black upper eyeliner',color:'#08090e',roughness:.66,metalness:0,envMapIntensity:.10});
  const patchMats={};for(const [key,mat]of Object.entries(mats)){patchMats[key]=mat.clone();patchMats[key].name=key+' surface marking';patchMats[key].side=THREE.FrontSide;}
  patchMats.white=skinWhite.clone();patchMats.white.side=THREE.FrontSide;
  const mesh=(name,g,mat,parent=root)=>{const m=new THREE.Mesh(g,mat);m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const hairGroup=new THREE.Group();hairGroup.name='Hair assembly';root.add(hairGroup);
  const faceGroup=new THREE.Group();faceGroup.name='Face assembly';root.add(faceGroup);
  mesh('Hair / closed shell with continuous pale turnaround',makeHairGeometry(),[mats.shell,mats.nape],hairGroup);
  mesh('Face / independent white solid',makeFaceGeometry(),mats.white,faceGroup);
  const addPatch=(name,shape,mat,lift=.015,surface=frontDepth,sub=2,parent=hairGroup)=>mesh(name,conform(shape,surface,lift,sub),patchMats[mat.name],parent);
  for(const mirror of [false,true]) {
    const side=mirror?'R':'L', flip=p=>mirror?822-p:p,offset=(mirror?1:-1)*EYE_SPREAD;
    addPatch(`Forehead white bean ${side}`,path(forehead,mirror,offset),mats.white);
    addPatch(`Eyebrow ${side}`,ellipse(flip(351)+offset*210,349,22,17,mirror?-.35:.35),mats.ink,.022);
    mesh(`Eye ${side} / rounded solid`,makeEyeGeometry(mirror),glassEye,faceGroup).position.z=-EYE_INSET;
    mesh(`Iris ${side}`,conform(ellipse(flip(333)+offset*210,430,25,32,-.025),eyeSurface,.006,3),glassIris,faceGroup).position.z=-EYE_INSET;
    mesh(`Upper eyeliner ${side} / raised solid`,makeUpperEyeliner(mirror),liner,faceGroup).position.z=-EYE_INSET;
    addPatch(`Cheek spot outer ${side}`,ellipse(flip(303),479,8,10),mats.ink,.015,faceDepth,2,faceGroup);
    addPatch(`Cheek spot inner ${side}`,ellipse(flip(323),484,8,7.7),mats.ink,.015,faceDepth,2,faceGroup);
  }
  const mouthPoints=[[394,496],[411,489],[429,496]].map(([px,py])=>{const x=X(px),y=Y(py)-MOUTH_DROP;return new THREE.Vector3(x,y,faceDepth(x,y)+.018);});
  const mouthCurve=new THREE.CatmullRomCurve3(mouthPoints,false,'centripetal');
  mesh('Mouth / small chevron',new THREE.TubeGeometry(mouthCurve,32,.014,8,false),mats.ink,faceGroup);
  for(const p of [mouthPoints[0],mouthPoints[2]])mesh('Mouth rounded end',new THREE.SphereGeometry(.014,12,8),mats.ink,faceGroup).position.copy(p);

  // Dorsal crest: a soft triangular cross section, extended toward the rear.
  const sections=[
    [.22,.91,.92,.05], [.15,.97,1.10,.13], [.055,1.01,1.31,.17],
    [-.065,1.00,1.34,.18],[-.22,.975,1.29,.18],[-.43,.90,1.16,.17],
    [-.64,.76,.99,.135],[-.80,.59,.74,.07],[-.88,.47,.48,.01],
  ];
  const centerCurve=new THREE.CatmullRomCurve3(sections.map(s=>new THREE.Vector3(s[0],s[1],s[2])),false,'centripetal');
  const widthCurve=new THREE.CatmullRomCurve3(sections.map((s,i)=>new THREE.Vector3(i,s[3],0)),false,'centripetal');
  const fp=[],fi=[],N=64,K=32;
  for(let j=0;j<=N;j++){
    const u=j/N,p=centerCurve.getPoint(u),w=widthCurve.getPoint(u).y;
    for(let i=0;i<=K;i++){
      const a=i*2*Math.PI/K, sy=Math.sin(a);
      const xx=w*Math.cos(a)*(1-.33*Math.max(0,sy));
      const yy=p.y+(p.z-p.y)*Math.max(0,sy)**1.18+.045*Math.min(0,sy);
      fp.push(xx,yy,p.x);
      if(j<N&&i<K){const n=j*(K+1)+i;fi.push(n,n+1,n+K+1,n+1,n+K+2,n+K+1);}
    }
  }
  const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.Float32BufferAttribute(fp,3));fg.setIndex(fi);fg.computeVertexNormals();
  mesh('Crest / soft dorsal fin',fg,mats.shell,hairGroup);

  // Ear fins are solid, thin sculpted membranes, including matching white insets on both sides.
  const finOutline=[
    ['M',632,286],['C',656,277,674,251,688,253],['C',710,252,704,274,697,286],
    ['C',690,302,679,326,670,347],['C',688,348,706,352,705,368],
    ['C',704,387,680,403,669,408],['C',687,408,692,419,684,430],
    ['C',675,442,651,452,637,454],['C',630,411,630,356,632,286],
  ];
  const finInlays=[
    [['M',643,318],['C',655,304,679,280,687,282],['C',694,284,675,321,663,342],['C',655,353,647,356,643,350],['C',641,339,641,327,643,318]],
    [['M',644,377],['C',656,366,687,363,693,370],['C',695,376,670,394,654,401],['C',644,406,642,394,644,377]],
    [['M',645,421],['C',656,416,675,418,677,423],['C',677,430,656,441,647,443],['C',642,441,642,429,645,421]],
  ];
  for(const sign of [-1,1]){
    const group=new THREE.Group();group.name=`Ear fin ${sign===1?'R':'L'}`;root.add(group);
    const shape=path(finOutline,false);
    const eg=new THREE.ExtrudeGeometry(shape,{depth:.072,bevelEnabled:true,bevelSegments:5,steps:1,bevelSize:.016,bevelThickness:.016,curveSegments:20});
    eg.translate(0,0,-.036);
    mesh('Blue membrane',prepareFinSurface(eg),mats.fin,group);
    for(let i=0;i<3;i++)for(const back of [false,true]){
      const geom=new THREE.ShapeGeometry(path(finInlays[i]),24);geom.translate(0,0,back?-.058:.058);
      mesh(`White membrane ${i+1} ${back?'back':'front'}`,prepareFinSurface(geom,.05),skinWhite,group);
    }
    // Each fin sweeps backward as it widens. The reference shows much more
    // membrane in the turned view than a front-facing flat plate would show.
    group.traverse(part=>{if(!part.isMesh)return;const p=part.geometry.attributes.position;
      for(let i=0;i<p.count;i++){
        const x=p.getX(i),y=p.getY(i),rootWeight=1-smooth(1.09,1.27,x);
        p.setZ(i,p.getZ(i)+.10-(x-1.05)*1.45);
        // Bury the root along the curved hair, especially the lower corner.
        p.setX(i,x-(.065+.068*smooth(.20,-.58,y))*rootWeight);
      }
      p.needsUpdate=true;part.geometry.computeVertexNormals();
    });
    group.scale.x=sign;
  }
  root.updateMatrixWorld(true);
  return root;
}

export function chinAttachment(x){const y=chinY(x)+.012;return new THREE.Vector3(x,y,faceDepth(x,y)+.005);}

export {faceDepth,frontDepth,eyeSurface,makeUpperEyeliner};
