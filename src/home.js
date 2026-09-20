import {createScene} from './scene.js';
import {pickLine} from './dialogue.js';
const native=!!window.fin,listeners=new Map();
const defaults={size:1,theme:'astral',sound:true,irisColor:'lavender',speech:true,alwaysOnTop:true,roam:false,followCursor:true,reducedMotion:false,quality:'high',stats:{pets:0,stars:0}};
let previewSettings={...defaults},previewFocus={active:false};
function send(name,value){for(const fn of listeners.get(name)||[])fn(value);}
const bridge=window.fin||{
 async init(){return{settings:previewSettings,focus:previewFocus};},
 async settings(patch){previewSettings={...previewSettings,...patch};send('settings',previewSettings);return previewSettings;},
 async action(name){send('action',name);return true;},
 on(name,fn){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);},
 async center(){send('action','wave');},async quit(){send('action','sleep');},
 async focus(command,minutes){previewFocus=command==='start'?{active:true,endAt:Date.now()+minutes*60000}:{active:false};send('focus',previewFocus);},
 async savePhoto(url){const r=await fetch('/_capture/'+currentAction+'.png',{method:'POST',headers:{'Content-Type':'image/png'},body:Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0))});if(!r.ok)throw Error('Save failed');return r.json();}
};
const initial=await bridge.init();let settings=initial.settings,focus=initial.focus,currentAction='idle',contacts=0;
const canvas=document.querySelector('#portrait'),line=document.querySelector('#line'),poseLabel=document.querySelector('#pose-label');
const names={idle:'在这里陪你',shy:'有点害羞',tailtap:'尾巴连拍三下',pet:'摸摸时间',wave:'看到你啦',jump:'轻轻蹦一下',dance:'摇摇摆摆',sleep:'小憩中',wake:'醒啦',smile:'眉眼弯弯',angry:'鼓脸了',walk:'散步中',think:'一起专注',boop:'鼻尖收到',drag:'被提住尾巴了',settle:'翻回来，站稳'};
const engine=createScene(canvas,{studio:true,onEvent(event,action){if(event==='tail-contact'){contacts++;poseLabel.textContent=`咚 · ${contacts}/3`;}if(event==='end')poseLabel.textContent='在这里陪你';}});engine.applySettings(settings);
function play(action){currentAction=action==='tail'?'tailtap':action;contacts=0;engine.resume();engine.animator.play(currentAction);line.textContent=pickLine(currentAction);poseLabel.textContent=names[currentAction]||'陪在身边';}
bridge.on('action',play);bridge.on('suspend',v=>engine.setSuspended(v));bridge.on('settings',s=>{settings=s;engine.applySettings(s);syncSettings();});bridge.on('focus',f=>{focus=f;});
bridge.on('roam',direction=>{engine.animator.walkDirection=direction;play('walk');});
bridge.on('roam-stop',()=>{if(engine.animator.action==='walk')play('idle');});
function syncSettings(){document.querySelectorAll('[data-iris]').forEach(el=>{el.classList.toggle('selected',el.dataset.iris===settings.irisColor);el.setAttribute('aria-pressed',String(el.dataset.iris===settings.irisColor));});document.querySelector('#size').value=Math.round(settings.size*100);document.querySelector('#size-value').textContent=Math.round(settings.size*100)+'%';document.querySelectorAll('[data-setting]').forEach(el=>el.checked=settings[el.dataset.setting]);document.querySelectorAll('[data-quality]').forEach(el=>el.classList.toggle('selected',el.dataset.quality===settings.quality));}
syncSettings();document.querySelectorAll('[data-action]').forEach(el=>el.onclick=()=>bridge.action(el.dataset.action));
document.querySelectorAll('[data-setting]').forEach(el=>el.onchange=()=>bridge.settings({[el.dataset.setting]:el.checked}));document.querySelectorAll('[data-quality]').forEach(el=>el.onclick=()=>bridge.settings({quality:el.dataset.quality}));
document.querySelectorAll('[data-iris]').forEach(el=>el.onclick=()=>bridge.settings({irisColor:el.dataset.iris}));
let sizeTimer;document.querySelector('#size').oninput=e=>{document.querySelector('#size-value').textContent=e.target.value+'%';clearTimeout(sizeTimer);sizeTimer=setTimeout(()=>bridge.settings({size:Number(e.target.value)/100}),140);};
document.querySelector('#recall').onclick=()=>bridge.center();document.querySelector('#quit').onclick=()=>bridge.quit();
const liftButton=document.querySelector('#preview-lift');let lifted=false,liftPointer=null,liftVelocityTimer;
function beginLift(){if(lifted)return;lifted=true;play('drag');liftButton.textContent='松手放下';}
function endLift(){if(!lifted)return;lifted=false;liftPointer=null;clearTimeout(liftVelocityTimer);engine.animator.setDragVelocity(0,0);play('settle');liftButton.textContent='按住提尾巴';}
liftButton.onpointerdown=e=>{if(e.button!==0)return;beginLift();liftPointer={x:e.clientX,y:e.clientY,at:performance.now()};liftButton.setPointerCapture(e.pointerId);};
liftButton.onpointermove=e=>{if(!lifted||!liftPointer)return;const now=performance.now(),dt=Math.max(.016,(now-liftPointer.at)/1000);engine.animator.setDragVelocity((e.clientX-liftPointer.x)/dt/950,(e.clientY-liftPointer.y)/dt/950);liftPointer={x:e.clientX,y:e.clientY,at:now};clearTimeout(liftVelocityTimer);liftVelocityTimer=setTimeout(()=>engine.animator.setDragVelocity(0,0),100);};
liftButton.onpointerup=liftButton.onpointercancel=liftButton.onlostpointercapture=endLift;
liftButton.onkeydown=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();beginLift();}};
liftButton.onkeyup=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();endLift();}};
liftButton.onblur=endLift;window.addEventListener('blur',endLift);
document.querySelector('#reset-view').onclick=()=>{engine.animator.baseYaw=0;engine.resume();};document.querySelector('#side-view').onclick=()=>{engine.animator.baseYaw=-1.15;engine.resume();};
let pointer=null;canvas.onpointerdown=e=>{if(e.button!==0)return;pointer={x:e.clientX,yaw:engine.animator.baseYaw,moved:false};canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!pointer)return;if(Math.abs(e.clientX-pointer.x)>5)pointer.moved=true;engine.animator.baseYaw=pointer.yaw+(e.clientX-pointer.x)*.009;};canvas.onpointerup=e=>{if(pointer&&!pointer.moved)bridge.action(engine.animator.action==='sleep'?'wake':'pet');pointer=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);};canvas.onpointercancel=()=>pointer=null;canvas.ondblclick=()=>engine.animator.baseYaw=-.28;
canvas.onkeydown=e=>{if(e.key==='ArrowLeft')engine.animator.baseYaw-=.15;else if(e.key==='ArrowRight')engine.animator.baseYaw+=.15;else if(e.key==='Enter'||e.key===' ')bridge.action('pet');else return;e.preventDefault();};
document.querySelector('#photo').onclick=async()=>{const button=document.querySelector('#photo');button.disabled=true;try{await bridge.savePhoto(engine.capture({action:currentAction,time:currentAction==='tailtap'?.62:1.2,yaw:engine.animator.baseYaw}));poseLabel.textContent=names[engine.animator.action]||'在这里陪你';line.textContent=native?'照片已保存到 photos 文件夹。':'预览图已保存。';}catch(e){line.textContent='照片未保存成功，请检查目录是否可写。';console.error(e);}finally{button.disabled=false;}};
document.querySelector('#focus-start').onclick=()=>bridge.focus('start',Math.max(1,Math.min(120,Number(document.querySelector('#minutes').value)||25)));document.querySelector('#focus-stop').onclick=()=>bridge.focus('stop');
const clock=setInterval(()=>{const seconds=focus?.active?Math.max(0,Math.ceil((focus.endAt-Date.now())/1000)):0;document.querySelector('#focus-state').textContent=focus?.active?`陪你专注 ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:'我陪你慢慢做。';},1000);
if(['1','true'].includes(new URLSearchParams(location.search).get('qa'))){
 document.querySelector('#review').hidden=false;
 let reviewShake=false;
 document.querySelector('#review-lift').onclick=()=>{reviewShake=false;play('drag');};
 document.querySelector('#review-drop').onclick=()=>{reviewShake=false;play('settle');};
 document.querySelector('#review-food').onclick=()=>{reviewShake=true;play('drag');document.querySelector('#freeze').click();};
 document.querySelector('#freeze').onclick=()=>{engine.renderPose(currentAction,Number(document.querySelector('#review-time').value)||0,engine.animator.baseYaw,{shake:reviewShake&&currentAction==='drag'});document.querySelector('#review-info').textContent=JSON.stringify({...engine.getInfo(),contacts},null,2);};
 document.querySelector('#resume').onclick=()=>{engine.resume();play(currentAction);};
 document.querySelector('#review-save').onclick=async()=>{await bridge.savePhoto(engine.capture({action:currentAction,time:Number(document.querySelector('#review-time').value)||0,yaw:engine.animator.baseYaw,shake:reviewShake&&currentAction==='drag'}));document.querySelector('#review-info').textContent=`已保存 ${currentAction}`;};
}
document.addEventListener('visibilitychange',()=>engine.setSuspended(document.hidden));window.addEventListener('beforeunload',()=>{clearInterval(clock);clearTimeout(sizeTimer);engine.dispose();});
window.__FIN_HOME__={engine,play};
