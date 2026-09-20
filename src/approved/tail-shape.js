// Shared rest spine, in final model coordinates. Used by both the mesh and
// its deformation so motion cannot drift away from the sculpted centreline.
export const TAIL_TURN = [0,-2.08108,-1.14616];
export const TAIL_START = [0,-1.54,-.16];
export const TAIL_END = [0,-1.6925,-2.04];
const sections = [
 [TAIL_START,[0,-1.92,-.70],[0,-2.08108,-.84],TAIL_TURN],
 [TAIL_TURN,[0,-2.08108,-1.46],[0,-1.9175,-1.7275],TAIL_END]
];
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
export function spinePoint(t){
 const section=t<=.52?0:1,u=section===0?t/.52:(t-.52)/.48,v=1-u;
 const [a,b,c,d]=sections[section];
 return a.map((x,i)=>v*v*v*x+3*v*v*u*b[i]+3*v*u*u*c[i]+u*u*u*d[i]);
}
export function spineRadius(t){
 // A buried narrow origin opens into a broad root, then steadily tapers.
 // The maximum thickness is on the descending spine, not a sphere cap.
 if(t<.30)return .14+(.375-.14)*ease(t/.30);
 return .175+(.375-.175)*(1-ease((t-.30)/.70));
}
export const spineDepth=t=>spineRadius(t)*(1-.08*ease(t/.20)*(1-ease((t-.65)/.35)));
