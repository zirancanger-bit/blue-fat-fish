import * as THREE from 'three';
import { tailPositions, tailIndices } from './tail-geometry.js';
import { makeKerchief } from './kerchief.js';
import { prepareTailGeometry,createTailAnimations } from './tail-motion.js';
import {createHands} from './hands.js';
export {HAND_POSES} from './hands.js';
export { tailWeights,applyTailWeights,SLAP_DURATION,IDLE_DURATION,FLOOR_Y } from './tail-motion.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createModel as createHead, PALETTE, chinAttachment } from './head-model.js';
import { capePanel, petalTrim, frustumBody, straightLeg, clothSurfaceDepth } from './body-surfaces.js';

const clamp=THREE.MathUtils.clamp;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const COLORS={cape:'#99adf5',lining:'#7e8cdb',legs:'#818ddd',white:'#fffefa',blue:PALETTE.ink};
function mesh(name,g,material,parent){const m=new THREE.Mesh(g,material);m.name=name;parent.add(m);return m;}
function geometry(p,indices){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();return g;}
function extrudedShape(shape,depth,bevel,project){
 const raw=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:bevel>0,bevelSegments:3,bevelSize:bevel,bevelThickness:bevel,curveSegments:18});
 let p=Array.from(raw.attributes.position.array);raw.dispose();
 // One uniform split keeps the caps conforming without excessive tessellation.
 const out=[];
 for(let i=0;i<p.length;i+=9){const a=p.slice(i,i+3),b=p.slice(i+3,i+6),c=p.slice(i+6,i+9),ab=a.map((x,k)=>(x+b[k])/2),bc=b.map((x,k)=>(x+c[k])/2),ca=c.map((x,k)=>(x+a[k])/2);out.push(...a,...ab,...ca,...ab,...b,...bc,...ca,...bc,...c,...ab,...bc,...ca);}
 p=out;
 if(project)for(let i=0;i<p.length;i+=3){const v=project(p[i],p[i+1],p[i+2]);p[i]=v.x;p[i+1]=v.y;p[i+2]=v.z;}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));const welded=mergeVertices(g,1e-6);g.dispose();welded.computeVertexNormals();return welded;
}
const capeFrontDepth=(x,y)=>clothSurfaceDepth(x,y);
function whaleTail(){
 const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer;
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(decode(tailPositions)),3));g.setIndex(new THREE.BufferAttribute(new Uint32Array(decode(tailIndices)),1));g.computeVertexNormals();return g;
}
export function createModel(){
 const root=new THREE.Group();root.name='FinCharacter_01';
 root.userData={title:'Fin character · body correction 08',reference:'User feedback: enlarge tail 25 percent, vertical sway and future floor tapping',headVersion:10,bodyVersion:8,tailRootDiameter:.75,notes:'Tail rebuilt around a shared continuous spine; buried root extends from the rear body with a softly arched dorsal surface. Enlarged flukes retained. The movable section starts at the upturn. Cross-sections follow the bent centreline, and successive angular poses preserve volume during floor taps.'};
 const head=createHead();head.name='Head assembly';root.add(head);
 const body=new THREE.Group();body.name='Body assembly';root.add(body);
 const cape=new THREE.Group();cape.name='Cape assembly';body.add(cape);
 const tail=new THREE.Group();tail.name='Tail assembly';body.add(tail);
 const mat={};for(const [k,c]of Object.entries(COLORS))mat[k]=new THREE.MeshStandardMaterial({name:k,color:c,roughness:.85,metalness:0,side:THREE.DoubleSide,envMapIntensity:.12});
 mat.tail=new THREE.MeshPhysicalMaterial({name:'Whale tail / eye blue',color:COLORS.blue,roughness:.39,clearcoat:.23,clearcoatRoughness:.27,ior:1.4,envMapIntensity:.45,side:THREE.DoubleSide});
 mesh('Body / rounded frustum and blue crotch',frustumBody(),[mat.white,mat.legs],body);
 for(const sign of [-1,1])mesh(`Leg ${sign<0?'L':'R'} / continuous rounded boot`,straightLeg(sign),[mat.legs,mat.white],body);
 for(const back of [false,true]){
  mesh(back?'Cape / independent back panel':'Cape / independent front panel',capePanel(back),[mat.cape,mat.lining],cape);
  for(const broad of [false,true])mesh(`Cape / ${back?'back':'front'} ${broad?'broad':'fine'} petal wave`,petalTrim(back,broad),mat.white,cape);
 }
 const bib=makeKerchief(head);
 mesh('Bib / continuous widened kerchief',bib.geometry,mat.blue,body);
 for(const a of [-.62,.62]){
  const pos=bib.point(a,.48),circle=new THREE.Shape();circle.absarc(0,0,.037,0,Math.PI*2,false);
  mesh('Bib / white round button',extrudedShape(circle,.006,.003,(x,y,z)=>new THREE.Vector3(pos.x+x,pos.y+y,bib.depth(pos.x+x,pos.y+y)+.005+z)),mat.white,body);
 }
 const diamond=new THREE.Shape();diamond.moveTo(0,.068);diamond.lineTo(.064,0);diamond.lineTo(0,-.068);diamond.lineTo(-.064,0);diamond.closePath();
 const gemCentre=bib.point(0,.54);
 mesh('Bib / white diamond',extrudedShape(diamond,.006,.004,(x,y,z)=>new THREE.Vector3(x,gemCentre.y+y,bib.depth(x,gemCentre.y+y)+.003+z)),mat.white,body);
 const tie=new THREE.Shape();tie.moveTo(0,0);tie.bezierCurveTo(-.045,-.055,-.084,-.14,0,-.27);tie.bezierCurveTo(.084,-.14,.045,-.055,0,0);tie.closePath();
 mesh('Bib / hanging teardrop',extrudedShape(tie,.012,.006,(x,y,z)=>new THREE.Vector3(x,-1.33+y,capeFrontDepth(x,-1.33+y)+.014+z)),mat.blue,body);
 const tailGeometry=whaleTail(),motion=prepareTailGeometry(tailGeometry);
 const tailMesh=mesh('Tail / continuous whale body and flukes',tailGeometry,mat.tail,tail);
 tailMesh.userData.motion=motion;root.animations=createTailAnimations(tailMesh);
 body.add(createHands());
 root.userData.bodyVersion=10;root.userData.title='Fin character · close-fitting hands study 10';
 root.updateMatrixWorld(true);return root;
}
