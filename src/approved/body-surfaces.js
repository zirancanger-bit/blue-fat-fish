import * as THREE from 'three';
const clamp=THREE.MathUtils.clamp;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

export function curveValue(keys,x){
 let i=0;while(i<keys.length-2&&x>keys[i+1][0])i++;
 const [x0,y0]=keys[i],[x1,y1]=keys[i+1],p=keys[Math.max(0,i-1)],n=keys[Math.min(keys.length-1,i+2)];
 const t=clamp((x-x0)/(x1-x0),0,1),d=x1-x0;
 const m0=i===0?0:(y1-p[1])/(x1-p[0]),m1=i===keys.length-2?0:(n[1]-y0)/(n[0]-x0);
 return (2*t**3-3*t*t+1)*y0+(t**3-2*t*t+t)*d*m0+(-2*t**3+3*t*t)*y1+(t**3-t*t)*d*m1;
}
function geom(p,ix){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g;}
// Two cut pieces. Their side edges are deliberately independent; the wider
// back piece is visible from the front as the darker inside of the cape.
const FRONT_HEM=[[0,-1.60],[.19,-2.16],[.39,-2.22],[.66,-2.105],[.84,-1.990],[1,-1.950]];
const BACK_HEM=[[0,-1.79],[.15,-1.97],[.44,-1.985],[.74,-1.86],[1,-1.68]];
export function clothRadius(y,back=false){
 const h=clamp((-y-1.0)/1.22,0,1);
 return (.337+.408*Math.pow(h,.82)+(back?.105*smooth(.28,.54,h):0))*clothWidthScale(y);
}
export function clothWidthScale(y){return 1+.14*smooth(-1.05,-1.90,y);}
function frontOpeningX(y){
 if(y>=-1.60)return 0;
 let lo=0,hi=.39;for(let i=0;i<24;i++){const m=(lo+hi)/2;if(curveValue(FRONT_HEM,m)>y)lo=m;else hi=m;}
 return clothRadius(y)*Math.sin((lo+hi)/2*(Math.PI/2+.24*smooth(-1.16,-1.60,y)));
}
// Rounded collar cross section. Keep the established lower cape unchanged.
export function clothDepth(y){
 const original=curveValue([[-2.30,.57],[-1.90,.535],[-1.50,.465],[-1.20,.355],[-1.025,.185],[-.95,.165]],y);
 const collar=curveValue([[-1.50,.465],[-1.20,.405],[-1.025,.365],[-.95,.35]],y);
 return THREE.MathUtils.lerp(original,collar,smooth(-1.50,-1.26,y));
}
export function clothSurfaceDepth(x,y,back=false){
 const r=clothRadius(y,back),d=clothDepth(y);
 return (back?-1:1)*d*Math.sqrt(Math.max(.0001,1-(x/r)**2));
}
function clothPoint(u,t,back=false,inside=false){
 const hem=curveValue(back?BACK_HEM:FRONT_HEM,Math.abs(u*2-1));
 const y=THREE.MathUtils.lerp(-1.005,hem,t),q=u*2-1;
 const a=q*(back?Math.PI/2:Math.PI/2+.24*smooth(-1.16,-1.60,y))+(back?0:Math.sign(q)*.31*smooth(.60,1,Math.abs(q))*smooth(-1.16,-1.60,y));
 const r=clothRadius(y,back),d=clothDepth(y),inset=inside?.018:0;
 return new THREE.Vector3((r-inset)*Math.sin(a),y,(back?-1:1)*(d-inset)*Math.cos(a));
}
function orientPositive(g){
 const p=g.attributes.position,ix=g.index.array;let v=0;
 for(let i=0;i<ix.length;i+=3){const a=ix[i],b=ix[i+1],c=ix[i+2];v+=p.getX(a)*(p.getY(b)*p.getZ(c)-p.getZ(b)*p.getY(c))+p.getY(a)*(p.getZ(b)*p.getX(c)-p.getX(b)*p.getZ(c))+p.getZ(a)*(p.getX(b)*p.getY(c)-p.getY(b)*p.getX(c));}
 if(v<0)for(let i=0;i<ix.length;i+=3)[ix[i+1],ix[i+2]]=[ix[i+2],ix[i+1]];
 g.computeVertexNormals();return g;
}
export function capePanel(back=false){
 const C=160,R=64,p=[],outer=[],inner=[],rim=[],offset=(C+1)*(R+1);
 for(const inside of [false,true])for(let j=0;j<=R;j++)for(let i=0;i<=C;i++)p.push(...clothPoint(i/C,j/R,back,inside).toArray());
 for(let j=0;j<R;j++)for(let i=0;i<C;i++){const a=j*(C+1)+i,b=a+C+1,c=a+1,d=b+1;outer.push(a,b,c,c,b,d);inner.push(a+offset,c+offset,b+offset,c+offset,d+offset,b+offset);}
 function stitch(a,b){rim.push(a,a+offset,b,b,a+offset,b+offset);}
 for(let i=0;i<C;i++){stitch(i+1,i);stitch(R*(C+1)+i,R*(C+1)+i+1);}
 for(let j=0;j<R;j++){stitch(j*(C+1),(j+1)*(C+1));stitch((j+1)*(C+1)+C,j*(C+1)+C);}
 const g=orientPositive(geom(p,[...outer,...inner,...rim]));
 g.addGroup(0,outer.length,0);g.addGroup(outer.length,inner.length,1);g.addGroup(outer.length+inner.length,rim.length,1);return g;
}
// Constant-width ribbons laid out as mirrored, intentional petal arcs in XY.
// The line is then conformed to the matching cloth surface, not a sine wave.
export function petalTrim(back=false,broad=false){
 const path=new THREE.CurvePath();
 function cubic(a,b,c,d){path.add(new THREE.CubicBezierCurve3(new THREE.Vector3(...a,0),new THREE.Vector3(...b,0),new THREE.Vector3(...c,0),new THREE.Vector3(...d,0)));}
 if(!back){
  cubic([.446,-1.275],[.492,-1.42],[.508,-1.715],[.304,-1.748]);
  cubic([.304,-1.748],[.302,-1.82],[.320,-2.015],[.111,-1.931]);
 }else if(!broad){
  cubic([0,-1.235],[.15,-1.245],[.35,-1.315],[.615,-1.535]);
 }else{
  cubic([0,-1.485],[.083,-1.61],[.223,-1.63],[.335,-1.535]);
  cubic([.335,-1.535],[.430,-1.64],[.552,-1.705],[.657,-1.600]);
 }
 const width=broad?.044:.012,N=256,W=8,p=[],ix=[];
 for(const sign of [-1,1]){
  const offset=p.length/3;
  for(let i=0;i<=N;i++){
   const t=i/N,v=path.getPointAt(t),dir=path.getTangentAt(t),normal=new THREE.Vector2(-dir.y,dir.x).normalize();
   if(!back&&broad){v.x+=.040;v.y-=.102;}
   v.x*=clothWidthScale(v.y);
   if(!back)v.x=Math.max(v.x,frontOpeningX(v.y)+Math.abs(normal.x)*width*.5+.002);
   const edgeX=clothRadius(v.y,back);
   const taper=back?(1-smooth(.94,1,t)):smooth(0,.05,t);
   const widthHere=Math.max(.0002,Math.min(width*taper,Math.max(.0002,(edgeX-Math.abs(v.x)-.003)*2/Math.max(.1,Math.abs(normal.x)))));
   for(let j=0;j<=W;j++){
    const edge=j/W*2-1;
    const x=sign*(v.x+normal.x*widthHere*.5*edge),y=v.y+normal.y*widthHere*.5*edge,z=clothSurfaceDepth(x,y,back)+(back?-.006:.006);p.push(x,y,z);
   }
   if(i<N)for(let j=0;j<W;j++){const a=offset+i*(W+1)+j,b=a+W+1;ix.push(a,a+1,b,b,a+1,b+1);}
  }
 }
 return geom(p,ix);
}
export function neckWrap(){
 const C=128,R=16,p=[],outer=[],inner=[],rim=[],offset=C*(R+1);
 for(const inside of [false,true])for(let j=0;j<=R;j++)for(let i=0;i<C;i++){
  const a=i/C*Math.PI*2,t=j/R,back=(1-Math.cos(a))/2;
  const front=Math.max(0,Math.cos(a))**3;
  const y=THREE.MathUtils.lerp(-.925,-1.11+.087*front,t),r=THREE.MathUtils.lerp(.325,clothRadius(y)+.008,t);
  const d=THREE.MathUtils.lerp(.207+.15*back,clothDepth(y)+.010-.016*front,t),ins=inside?.03:0;
  p.push((r-ins)*Math.sin(a),y,(d-ins)*Math.cos(a));
 }
 for(let j=0;j<R;j++)for(let i=0;i<C;i++){const k=(i+1)%C,a=j*C+i,b=(j+1)*C+i,c=j*C+k,d=(j+1)*C+k;outer.push(a,b,c,c,b,d);inner.push(a+offset,c+offset,b+offset,c+offset,d+offset,b+offset);}
 function stitch(a,b){rim.push(a,a+offset,b,b,a+offset,b+offset);}
 for(let i=0;i<C;i++){const k=(i+1)%C;stitch(k,i);stitch(R*C+i,R*C+k);}
 return orientPositive(geom(p,[...outer,...inner,...rim]));
}
export function straightLeg(sign){
 const C=64,p=[],bands=[[],[]],ys=[];
 for(let j=0;j<=48;j++)ys.push(-2.58+.73*j/48);
 ys.push(-2.565,-2.55,-2.445,-2.414,-2.392,-2.380);ys.sort((a,b)=>a-b);
 const radius=y=>y< -2.55? .112+.028*Math.sqrt(Math.max(0,1-((-2.55-y)/.03)**2)):.140+.048*(y+2.55)/.70;
 for(const y of ys){const r=radius(y);for(let i=0;i<C;i++){const a=i/C*Math.PI*2;p.push(sign*.224+r*Math.sin(a),y,.015+r*Math.cos(a));}}
 const bottom=p.length/3;p.push(sign*.224,-2.58,.015);const top=p.length/3;p.push(sign*.224,-1.85,.015);
 for(let i=0;i<C;i++){const k=(i+1)%C;bands[0].push(bottom,k,i,top,(ys.length-1)*C+i,(ys.length-1)*C+k);}
 const mat=y=>(y>=-2.445&&y<=-2.414)||(y>=-2.392&&y<=-2.380)?1:0;
 for(let j=0;j<ys.length-1;j++)for(let i=0;i<C;i++){const k=(i+1)%C,a=j*C+i,b=(j+1)*C+i,c=j*C+k,d=(j+1)*C+k;bands[mat((ys[j]+ys[j+1])/2)].push(a,c,b,c,d,b);}
 const g=geom(p,[...bands[0],...bands[1]]);g.addGroup(0,bands[0].length,0);g.addGroup(bands[0].length,bands[1].length,1);return g;
}

export function frustumBody(){
 const C=96,p=[],bands=[[],[]],rings=[];
 const levels=[[-1.91,.355,1],[-1.905,.382,1],[-1.894,.404,1],[-1.877,.417,1],[-1.855,.420,0]];
 for(let j=1;j<=48;j++){const y=THREE.MathUtils.lerp(-1.855,-1.025,j/48);levels.push([y,THREE.MathUtils.lerp(.420,.178,j/48),0]);}
 levels.push([-.980,.172,0],[-.955,.160,0]);
 for(const [baseY,r]of levels){const row=[];for(let i=0;i<C;i++){
  const a=i/C*Math.PI*2;let y=baseY;
  // White belly ends in a shallow point. Only the narrow band below it is blue.
  if(baseY===-1.855)y-=.022*Math.max(0,Math.cos(a))**4;
  row.push(p.length/3);p.push(r*Math.sin(a),y,r*Math.cos(a));
 }rings.push(row);}
 const bottom=p.length/3;p.push(0,-1.91,0);const top=p.length/3;p.push(0,-.950,0);
 for(let i=0;i<C;i++){const k=(i+1)%C;bands[1].push(bottom,rings[0][k],rings[0][i]);bands[0].push(top,rings.at(-1)[i],rings.at(-1)[k]);}
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<C;i++){const k=(i+1)%C,a=rings[j][i],b=rings[j+1][i],c=rings[j][k],d=rings[j+1][k];bands[j<4?1:0].push(a,c,b,c,d,b);}
 const g=geom(p,[...bands[0],...bands[1]]);g.addGroup(0,bands[0].length,0);g.addGroup(bands[0].length,bands[1].length,1);return g;
}
