// One wind-up, then three closely spaced contacts with a shared rebound.
export const LEAD=.32,CYCLE=.28,TAPS=3,TAIL_TAP_DURATION=1.36;
export const CONTACT_TIMES=Object.freeze(Array.from({length:TAPS},(_,i)=>LEAD+i*CYCLE));
export function tripleTailPose(time,impact=-.72){
 const keys=[[0,0],[.19,.28],[.32,impact],[.38,impact],[.49,.15],
  [.60,impact],[.66,impact],[.77,.15],[.88,impact],[.94,impact],
  [1.10,.065],[1.25,0],[TAIL_TAP_DURATION,0]];
 let i=0;while(i<keys.length-2&&time>keys[i+1][0])i++;
 const [t0,a]=keys[i],[t1,b]=keys[i+1],t=Math.max(0,Math.min(1,(time-t0)/(t1-t0)));
 const easing=b===impact&&a!==impact?t*t:t*t*(3-2*t);
 return {mode:'angle',time:a+(b-a)*easing};
}
export function crossedContacts(previous,time){return CONTACT_TIMES.filter(t=>previous<t&&time>=t);}
