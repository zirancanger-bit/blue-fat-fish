import * as THREE from 'three';

export const HAND_RADIUS=.245;
export const HAND_POSES={
 rest:[[-.69,-1.49,.42],[.69,-1.49,.42]],
 raise:[[-.83,-.84,.75],[.83,-.84,.75]],
 clasp:[[-.255,-1.32,.645],[.255,-1.32,.645]]
};
export function createHands(){
 const group=new THREE.Group();group.name='Hands assembly';
 const material=new THREE.MeshStandardMaterial({name:'Hands / soft white',color:'#fffefa',roughness:.60,metalness:0,envMapIntensity:.18});
 const geometry=new THREE.SphereGeometry(HAND_RADIUS,40,28);
 for(const [i,label] of ['L','R'].entries()){
  const hand=new THREE.Mesh(geometry,material);hand.name=`Hand ${label} / floating white sphere`;
  hand.position.fromArray(HAND_POSES.rest[i]);group.add(hand);
 }
 group.userData={radius:HAND_RADIUS,detached:true,poses:HAND_POSES};return group;
}
