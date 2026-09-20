import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createFin} from './model.js';
import {Animator} from './animator.js';
import {createFoodDrops} from './food-drops.js';
export function createScene(canvas,{studio=false,onEvent=()=>{}}={}){
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-2,2,2.3,-2.3,.1,50);camera.position.set(0,1.95,7);camera.lookAt(0,1.95,0);
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.065);scene.environment=env.texture;scene.environmentIntensity=.12;pmrem.dispose();room.dispose();
 scene.add(new THREE.HemisphereLight(0xffffff,0xdad8e7,2.1));
 for(const [color,intensity,pos]of [[0xffffff,2,[-3,5,7]],[0xdce6ff,1.1,[3,2,-4]],[0xffffff,.35,[0,-3,5]]]){const l=new THREE.DirectionalLight(color,intensity);l.position.set(...pos);scene.add(l);}
 const model=createFin();scene.add(model.root);
 const foodDrops=createFoodDrops(scene,model);
 const particles=[],effects=new THREE.Group();let posing=false;model.root.add(effects);
 const ringGeometry=new THREE.RingGeometry(.94,1,40),ballGeometry=new THREE.SphereGeometry(.027,8,6);
 function burst(kind='heart',count=6){
  if(animator.reducedMotion)return;
  for(let i=0;i<Math.min(count,12);i++){
   const m=new THREE.Mesh(ballGeometry,new THREE.MeshBasicMaterial({color:kind==='heart'?'#e99bb5':'#c1ceff',transparent:true,depthWrite:false}));m.position.set((Math.random()-.5)*.65,2.10,1.0);m.userData={age:0,life:1.1,vy:.35+Math.random()*.25};effects.add(m);particles.push(m);
  }
 }
 const animator=new Animator(model,(event,action,contactTime)=>{
  if(event==='tail-contact'){
   const p=model.tail.userData.motion.contact,m=new THREE.Mesh(ringGeometry,new THREE.MeshBasicMaterial({color:'#a6b5ed',transparent:true,opacity:.4,depthWrite:false,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set(p.x,.013,p.z);m.scale.setScalar(.14);m.userData={age:0,life:.52,ring:true};effects.add(m);particles.push(m);
  }
  if(event==='catch')burst('star',8);if(!posing)onEvent(event,action,contactTime);
 });
 let width=400,height=458,quality='high',suspended=false,running=true,disposed=false,timer=0,raf=0,previous=performance.now(),lastCount=previous,frames=0,fps=0,total=0;
 function cameraFrame(w,h){const aspect=w/h,half=Math.max(2.36,(studio?2.75:2.30)/aspect);camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();}
 function resize(){const b=canvas.getBoundingClientRect(),w=Math.max(1,b.width),h=Math.max(1,b.height),ratio=Math.min(devicePixelRatio,quality==='eco'?1:1.25),size=renderer.getSize(new THREE.Vector2());if(Math.abs(w-size.x)<1.5&&Math.abs(h-size.y)<1.5&&renderer.getPixelRatio()===ratio)return;width=w;height=h;renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);cameraFrame(w,h);renderer.render(scene,camera);}
 const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
 const gripPoint=new THREE.Vector3();
 function update(dt){animator.update(dt);foodDrops.update(dt,animator);
  if(!posing&&animator.action==='drag'){
   gripPoint.copy(model.tailGrip);model.rig.localToWorld(gripPoint);gripPoint.project(camera);
   onEvent('drag-grip',{x:(gripPoint.x*.5+.5)*width,y:(.5-gripPoint.y*.5)*height,weight:animator.carry.weight});
  }
  for(let i=particles.length-1;i>=0;i--){const p=particles[i],d=p.userData;d.age+=dt;p.material.opacity=Math.max(0,1-d.age/d.life)*(d.ring?.4:.7);if(d.ring)p.scale.setScalar(.14+d.age*.75);else p.position.y+=d.vy*dt;if(d.age>=d.life){p.parent.remove(p);p.material.dispose();particles.splice(i,1);}}}
 function schedule(){if(disposed||suspended||!running)return;const max=animator.action==='sleep'&&animator.elapsed>2?8:animator.action==='idle'?(quality==='eco'?12:18):(quality==='eco'?20:30);timer=setTimeout(()=>{raf=requestAnimationFrame(draw);},1000/max);}
 function draw(now){if(disposed||suspended||!running)return;const dt=Math.min(.1,(now-previous)/1000);previous=now;update(dt);renderer.render(scene,camera);frames++;total++;if(now-lastCount>1000){fps=Math.round(frames*1000/(now-lastCount));frames=0;lastCount=now;}schedule();}
 function stopClock(){clearTimeout(timer);cancelAnimationFrame(raf);timer=raf=0;}
 schedule();
 const raycaster=new THREE.Raycaster(),point=new THREE.Vector2();
 function hitTest(x,y){if(x<0||y<0||x>width||y>height)return null;point.set(x/width*2-1,1-y/height*2);model.root.updateMatrixWorld(true);raycaster.setFromCamera(point,camera);const hits=raycaster.intersectObjects(model.hitTargets,false);return hits[0]||null;}
 function applySettings(s){quality=s.quality||'high';model.setAppearance(s.irisColor);animator.followCursor=s.followCursor;animator.reducedMotion=s.reducedMotion;document.documentElement.dataset.motion=s.reducedMotion?'reduced':'full';resize();}
 function renderPose(action,time=1.2,yaw=-.28,{shake=false}={}){stopClock();running=false;posing=true;foodDrops.clear();try{animator.followCursor=false;animator.baseYaw=yaw;model.root.rotation.y=yaw;animator.look={x:0,y:0};animator.carry.weight=action==='settle'?1:0;animator.setDragVelocity(0,0);animator.dragMotion.x=animator.dragMotion.y=0;animator.play(action);animator.time=0;animator.nextBlink=100;animator.blinkAt=-100;for(let t=0;t<time;t+=1/60){if(shake)animator.setDragVelocity(Math.sin(t*11)*.85,Math.cos(t*8)*.35);update(Math.min(1/60,time-t));}renderer.render(scene,camera);return {action:animator.action,triangles:renderer.info.render.triangles};}finally{animator.setDragVelocity(0,0);posing=false;}}
 function capture({width:outW=900,height:outH=1000,action=animator.action,time=1.2,yaw=animator.baseYaw,shake=false}={}){
  const oldSize=renderer.getSize(new THREE.Vector2()),oldRatio=renderer.getPixelRatio(),wasRunning=running,follow=animator.followCursor;
  const oldAction=animator.action,oldYaw=animator.baseYaw;
  renderer.setPixelRatio(1);renderer.setSize(outW,outH,false);cameraFrame(outW,outH);renderPose(action,time,yaw,{shake});const url=canvas.toDataURL('image/png');
  renderer.setPixelRatio(oldRatio);renderer.setSize(oldSize.x,oldSize.y,false);cameraFrame(oldSize.x,oldSize.y);animator.followCursor=follow;animator.baseYaw=oldYaw;animator.play(oldAction==='sleep'?'sleep':'idle');running=wasRunning;previous=performance.now();if(running)schedule();return url;
 }
 return {renderer,scene,camera,model,animator,hitTest,burst,applySettings,renderPose,capture,
  setSuspended(v){suspended=!!v;stopClock();previous=performance.now();if(!suspended)schedule();},
  resume(){stopClock();running=true;previous=performance.now();schedule();},
  getInfo(){return{action:animator.action,fps,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,particles:particles.length,foodParticles:foodDrops.count,renderedFrames:total,quality,suspended};},
  dispose(){disposed=true;stopClock();observer.disconnect();foodDrops.dispose();const geos=new Set(),mats=new Set();scene.traverse(m=>{if(m.geometry)geos.add(m.geometry);if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(a=>mats.add(a));});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());env.dispose();renderer.dispose();}
 };
}
