import * as THREE from 'three';
import {eyeSurface,makeUpperEyeliner} from './approved/head-model.js';

export const EYE_SCALE=11/12;
export const IRIS_COLORS=Object.freeze({lavender:'#dfdcff',red:'#ed5266'});
// Broad closed-eye arcs and inward-sloping angry lids, traced from the paint-over.
const closedOutline=[
 ['M',279,432],['Q',276,428,281,425],['C',299,414,321,411,340,413],
 ['C',355,414,367,417,378,421],['L',376,435],
 ['C',346,429,318,428,285,439],['Q',277,441,279,432],
];
const angryOutline=[
 ['M',292,454],['Q',283,452,280,440],['L',268,391],
 ['Q',265,383,271,386],['L',279,389],
 ['C',308,386,352,400,377,410],['Q',388,415,382,422],
 ['C',355,421,320,410,288,406],['L',296,446],['Q',298,455,292,454],
];

function warp(geometry,xy){
 const g=geometry.clone(),p=g.attributes.position,front=[];
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),[nx,ny]=xy(x,y);
  front.push(g.attributes.normal.getZ(i)>.55);
  p.setXYZ(i,nx,ny,p.getZ(i)+eyeSurface(nx,ny)-eyeSurface(x,y));
 }
 g.computeVertexNormals();
 // Keep the eye and its colored inset on the same smooth glass surface.
 const n=g.attributes.normal,h=.0005,v=new THREE.Vector3();
 for(let i=0;i<p.count;i++)if(front[i]){
  const x=p.getX(i),y=p.getY(i);
  v.set(-(eyeSurface(x+h,y)-eyeSurface(x-h,y))/(2*h),-(eyeSurface(x,y+h)-eyeSurface(x,y-h))/(2*h),1).normalize();
  n.setXYZ(i,v.x,v.y,v.z);
 }
 g.computeBoundingBox();g.computeBoundingSphere();return g;
}

export function buildEyeDetails(head){
 const normal=[],angry=new THREE.Group(),closed=new THREE.Group(),irisMaterials=new Set();
 angry.name='Angry eyes';closed.name='Closed soft eyes';head.add(angry,closed);
 const centers=[];
 for(const [side,sign] of [['L',-1],['R',1]]){
  const body=head.getObjectByName(`Eye ${side} / rounded solid`),iris=head.getObjectByName(`Iris ${side}`),lid=head.getObjectByName(`Upper eyeliner ${side} / raised solid`);
  body.geometry.computeBoundingBox();const box=body.geometry.boundingBox.clone(),center=box.getCenter(new THREE.Vector3());
  centers.push({side,x:center.x,y:center.y,width:box.max.x-box.min.x,height:box.max.y-box.min.y});
  const shrink=(x,y)=>[center.x+(x-center.x)*EYE_SCALE,center.y+(y-center.y)*EYE_SCALE];
  const scowl=(x,y)=>{
   const inner=THREE.MathUtils.clamp((Math.max(Math.abs(box.min.x),Math.abs(box.max.x))-Math.abs(x))/(box.max.x-box.min.x),0,1);
   // The lid covers the eye from above; keep the lower iris oval intact.
   return shrink(x,Math.min(y,-.330-.080*inner));
  };
  for(const mesh of [body,iris]){
   const m=new THREE.Mesh(warp(mesh.geometry,scowl),mesh.material);m.name=`Angry ${mesh.name}`;m.position.copy(mesh.position);angry.add(m);
  }
  const angryLid=new THREE.Mesh(makeUpperEyeliner(sign>0,angryOutline),lid.material);
  angryLid.name=`Angry upper eyeliner ${side}`;angryLid.position.copy(lid.position);
  const angryBase=angryLid.geometry;angryLid.geometry=warp(angryBase,shrink);angryBase.dispose();angry.add(angryLid);
  const shut=new THREE.Mesh(makeUpperEyeliner(sign>0,closedOutline),new THREE.MeshStandardMaterial({color:'#242635',roughness:.8}));
  shut.name=`Closed eyelid ${sign}`;shut.position.copy(lid.position);
  const shutBase=shut.geometry;shut.geometry=warp(shutBase,shrink);shutBase.dispose();closed.add(shut);
  for(const mesh of [body,iris,lid]){const original=mesh.geometry;mesh.geometry=warp(original,shrink);original.dispose();normal.push(mesh);}
  irisMaterials.add(iris.material);
 }
 angry.visible=false;closed.visible=false;
 function setAppearance(color='lavender'){const hex=IRIS_COLORS[color]||IRIS_COLORS.lavender;irisMaterials.forEach(m=>m.color.set(hex));}
 return {normal,angry,closed,centers,setAppearance};
}
