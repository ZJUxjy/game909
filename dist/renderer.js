import {spriteIdForUnit} from './sprite-map.js';
/** Read-only Three.js adapter. Simulation and event authority remain in engine.js. */
import * as THREE from './vendor/three/three.module.min.js';
const reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
export function createBattleRenderer(host,{onSelect,onFailure,rendererFactory=canvas=>new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'})}) {
  const canvas=document.createElement('canvas');canvas.id='battlefield-3d';canvas.setAttribute('aria-label','3D 战场：点击英雄查看，点击敌人集火；拖动旋转，滚轮缩放');host.prepend(canvas);
  let renderer;
  try { renderer=rendererFactory(canvas); } catch(e){canvas.remove();throw e}
  renderer.setClearColor(0xb7c7c7);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xb7c7c7,22,48);
  const camera=new THREE.PerspectiveCamera(36,1,.1,100),target=new THREE.Vector3(0,.5,0);
  let yaw=0,pitch=.72,distance=21,width=1,height=1,enabled=true,lost=false,quality='high',identity=null,now=0;
  const labels=document.createElement('div');labels.className='unit-label-layer';host.append(labels);
  const actors=new Map(),effects=[],geo=new Map(),materials=new Map(),ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const mat=(color,glow=false)=>{const key=color+':'+glow;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.95,metalness:.03,flatShading:true,emissive:glow?color:0,emissiveIntensity:glow?.16:0}));return materials.get(key)};
  function geometry(type){if(!geo.has(type))geo.set(type,type==='sphere'?new THREE.IcosahedronGeometry(1,0):type==='cone'?new THREE.ConeGeometry(1,1,5):type==='cylinder'?new THREE.CylinderGeometry(1,1,1,8):type==='ring'?new THREE.TorusGeometry(1,.025,4,48):new THREE.BoxGeometry(1,1,1));return geo.get(type)}
  function part(parent,type,color,pos,scale,glow=false){const m=new THREE.Mesh(geometry(type),mat(color,glow));m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
  scene.add(new THREE.HemisphereLight(0xdde8df,0x9b8e6d,2.2));const sun=new THREE.DirectionalLight(0xffefcf,2.4);sun.position.set(-5,12,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-12,right:12,top:10,bottom:-10});sun.shadow.bias=-.001;scene.add(sun);
  const rim=new THREE.DirectionalLight(0xb7d2db,.8);rim.position.set(6,5,-8);scene.add(rim);
  const ground=part(scene,'cylinder',0xa89f83,[0,-.38,0],[10.1,.6,7.1]);ground.rotation.y=Math.PI/8;
  part(scene,'cylinder',0xc8bd9f,[0,-.07,0],[9.6,.12,6.7]).rotation.y=Math.PI/8;
  for(let x=-8;x<=8;x+=2)for(let z=-5;z<=5;z+=2)part(scene,'box',((x+z)%4)?0xcbbfa1:0xd2c6a8,[x,0,z],[1.96,.04,1.96]);
  // Sparse sandstone ruins keep the combat lanes open and readable.
  for(const x of [-8,8])for(const z of [-5,5]){part(scene,'box',0xc8bd9f,[x,.45,z],[.8,.9,.8]);part(scene,'box',0xded2b4,[x,.97,z],[1,.15,1]);}
  for(const x of [-7,-5]){part(scene,'box',0xc5b797,[x,1.7,-7],[.8,3.4,.9]);part(scene,'box',0xd9ccac,[x,3.5,-7],[1,.25,1]);}
  part(scene,'box',0xd2c3a0,[-6,3.6,-7],[3,.45,1]);
  for(const [x,z] of [[-8,-6],[8,-6],[-9,4],[8,5]]){part(scene,'cylinder',0x8c8065,[x,.7,z],[.12,1.4,.12]);part(scene,'sphere',0x869668,[x,1.8,z],[.9,.9,.8]);part(scene,'sphere',0x9ca879,[x+.45,2.1,z],[.65,.65,.6]);}
  const spriteTextures=new Map(),spriteMaterials=[];
  const spriteLoader=typeof Image==='undefined'?null:new THREE.TextureLoader();
  function paintedSprite(id,enemy){
    if(!spriteLoader)return null;
    const key=id+':'+enemy;
    if(!spriteTextures.has(key)){const texture=spriteLoader.load(new URL(`./assets/v4/sprites/${id}.webp`,import.meta.url).href,undefined,undefined,()=>{/* Keep the procedural actor when an art asset cannot load. */});texture.colorSpace=THREE.SRGBColorSpace;if(enemy){texture.center.x=.5;texture.repeat.x=-1;}spriteTextures.set(key,texture);}
    const material=new THREE.SpriteMaterial({map:spriteTextures.get(key),transparent:true,alphaTest:.06,depthWrite:false});spriteMaterials.push(material);const sprite=new THREE.Sprite(material);sprite.center.set(.5,0);sprite.scale.set(2.6,2.6,1);return sprite;
  }
  function position(u){const front=u.position<2;return new THREE.Vector3((u.team==='ally'?-1:1)*(front?2.3:5.6),0,front?[-1.7,1.7][u.position]:[-3.4,0,3.4][u.position-2])}
  function createActor(u){
    const root=new THREE.Group(),body=new THREE.Group();root.add(body);scene.add(root);root.position.copy(position(u));
    const color=u.color||'#b47773',dark=u.team==='ally'?0x263f48:0x463039,metal=0xb3b6a5,id=u.id||'',tank=['centaur','ursa','underlord','magnus'].includes(id)||u.boss,caster=['oracle','lina','shadowfiend'].includes(id)||u.spec==='远程'||(u.team==='enemy'&&u.position===4);
    const team=u.team==='ally'?0x6cd7c0:0xe59175;
    const ring=part(root,'ring',team,[0,.09,0],[.61,.61,1],true);ring.rotation.x=-Math.PI/2;
    const size=tank?1.22:1;body.scale.setScalar(u.boss?1.4:size);
    part(body,'cone',dark,[0,.62,0],[.45,1,.32]);part(body,'box',color,[0,1,0],[.65,.66,.42]);
    for(const side of [-1,1]){part(body,'box',dark,[side*.19,.26,.03],[.2,.52,.22]);part(body,'box',metal,[side*.2,.08,.12],[.24,.16,.34]);part(body,'sphere',color,[side*.43,1.2,0],[.25,.23,.23]);part(body,'box',dark,[side*.47,.88,0],[.17,.48,.18]);}
    part(body,'sphere',color,[0,1.57,0],[.3,.34,.27]);part(body,'box',dark,[0,1.55,.24],[.42,.17,.09]);for(const s of [-1,1])part(body,'box',0xd4fff0,[s*.11,1.57,.3],[.08,.035,.03],true);
    const weapon=new THREE.Group();weapon.position.set(.52,.9,.12);body.add(weapon);
    if(id==='centaur'){part(body,'box',color,[0,.58,-.4],[.8,.56,1]);for(const s of [-1,1])part(body,'box',dark,[s*.3,.26,-.75],[.22,.5,.22]);}
    if(tank||id==='shadowfiend'){for(const s of [-1,1]){const horn=part(body,'cone',id==='shadowfiend'?0xec795e:0xd7c59b,[s*.32,1.92,0],[.12,.6,.13]);horn.rotation.z=-s*.55;}}
    if(id==='ursa'){for(const s of [-1,1]){part(body,'sphere',color,[s*.23,1.84,0],[.15,.15,.12]);for(let i=0;i<3;i++)part(body,'cone',metal,[s*.5+i*.05,.65,.26],[.035,.35,.035]);}}
    else if(id==='oracle'||id==='lina'||caster){part(weapon,'cylinder',metal,[0,.3,0],[.035,1.55,.035]);part(weapon,'sphere',id==='lina'?0xff9c43:color,[0,1.12,0],[.23,.3,.23],true);if(id==='oracle'){const halo=part(body,'ring',0xffd484,[0,2.03,0],[.42,.42,1],true);halo.rotation.x=Math.PI/2;}if(id==='shadowfiend'){part(body,'sphere',0xff714e,[0,1,.25],[.2,.3,.1],true);}}
    else if(id==='muerta'){part(body,'cylinder',dark,[0,1.86,0],[.48,.09,.4]);for(const s of [-1,1])part(body,'box',metal,[s*.55,.9,.35],[.12,.14,.45]);}
    else {part(weapon,'box',metal,[0,.38,0],[id==='magnus'?.15:.09,1.25,.1]);part(weapon,'box',0xe2bd78,[0,-.03,0],[.37,.07,.12]);if(['magnus','underlord'].includes(id))part(weapon,'box',metal,[0,.9,0],[.7,.35,.25]);if(id==='assassin')part(body,'cone',dark,[0,1.76,-.04],[.37,.55,.34]);if(id==='juggernaut')part(body,'box',0xf2dfb3,[0,1.58,.28],[.35,.38,.08]);if(id==='abaddon')part(body,'box',0x839bad,[-.55,.94,.2],[.42,.66,.15]);}
    if(u.team==='enemy'){if(u.position<2)part(body,'box',0x6d7880,[-.5,.85,.2],[.45,.8,.16]);if(u.position===2||u.position===3){part(body,'cone',0x79698e,[0,.5,-.05],[.65,1,.45]);body.position.y=.15;}part(body,'cone',0x835e6a,[0,1.93,0],[.25,.45,.25]);if(u.boss){const crown=part(body,'ring',0xffb768,[0,2.12,0],[.42,.42,1],true);crown.rotation.x=Math.PI/2;}}
    body.rotation.y=u.team==='ally'?Math.PI/2:-Math.PI/2;
    const painted=paintedSprite(spriteIdForUnit(u),u.team==='enemy');if(painted){root.add(painted);painted.visible=false;body.visible=true;painted.scale.setScalar(u.boss?3.4:tank?2.9:2.6);}
    const shield=part(root,'sphere',0x83d5e8,[0,1,0],[.8,1.2,.8]);shield.material=new THREE.MeshBasicMaterial({color:0x83d5e8,wireframe:true,transparent:true,opacity:.15});shield.visible=false;
    const label=document.createElement('div');label.className='unit-label '+u.team;label.innerHTML='<span class="unit-name"></span><div class="unit-health"><i></i></div><div class="unit-mana"><i></i></div><small></small>';labels.append(label);label.querySelector('span').textContent=u.name;
    root.traverse(o=>{o.userData.uid=u.uid});return{root,body,painted,ring,shield,label,base:root.position.clone(),uid:u.uid,attack:-10,hit:-10,cast:-10,dead:null,unit:u};
  }
  function clear(){for(const a of actors.values()){scene.remove(a.root);a.shield.material.dispose();if(a.painted){a.painted.material.dispose();const i=spriteMaterials.indexOf(a.painted.material);if(i>=0)spriteMaterials.splice(i,1)}a.label.remove()}actors.clear();for(const e of effects){scene.remove(e.mesh);e.label?.remove();if(e.disposable){e.mesh.geometry.dispose();e.mesh.material.dispose()}}effects.length=0;}
  function event(e){const a=actors.get(e.source),b=actors.get(e.target);if(e.type==='skill'&&a){a.cast=now;spawn('ring',a.base,0xffd390,.8,e.text)}
    if(e.type==='damage'||e.type==='heal'||e.type==='miss'){if(a&&e.type==='damage')a.attack=now;if(b){if(e.type==='damage')b.hit=now;spawn(e.type==='heal'?'ring':'sphere',b.base,e.type==='heal'?0x8bf1bf:0xffd6a0,.4,e.type==='miss'?'闪避':e.type==='heal'?'+'+e.amount:e.amount>0?String(e.amount):'吸收');if(a&&e.type==='damage'&&(a.unit.spec==='远程'||a.unit.team==='enemy'&&a.unit.position===4)){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a.base.clone().add(new THREE.Vector3(0,1,0)),b.base.clone().add(new THREE.Vector3(0,1,0))]),new THREE.LineBasicMaterial({color:a.unit.color||0xffd390,transparent:true,opacity:.8}));scene.add(line);effects.push({mesh:line,start:now,life:.13,disposable:true});}}}
    if(e.type==='death'&&b)b.dead=now;
  }
  function spawn(type,p,color,life,text){if(effects.length>80)return;const m=part(scene,type,color,[p.x,.8,p.z],[.1,.1,.1],true);if(type==='ring')m.rotation.x=-Math.PI/2;const label=document.createElement('span');label.className='combat-float';label.textContent=text;label.style.color='#'+new THREE.Color(color).getHexString();labels.append(label);effects.push({mesh:m,start:now,life,label});}
  function resize(){const r=host.getBoundingClientRect();width=r.width;height=r.height;renderer.setSize(width,height,false);renderer.setPixelRatio(Math.min(devicePixelRatio||1,quality==='high'?1.7:1));camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(host);
  function setCamera(){const responsive=Math.max(1,1.5/camera.aspect);const d=distance*responsive;camera.position.set(Math.sin(yaw)*d*Math.cos(pitch),Math.sin(pitch)*d,Math.cos(yaw)*d*Math.cos(pitch));camera.lookAt(target);camera.updateMatrixWorld(true)}
  let down=null;
  canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,yaw,pitch,id:e.pointerId,moved:false};canvas.setPointerCapture(e.pointerId)});
  canvas.addEventListener('pointermove',e=>{if(!down)return;const dx=e.clientX-down.x,dy=e.clientY-down.y;if(Math.hypot(dx,dy)>5)down.moved=true;if(down.moved){yaw=THREE.MathUtils.clamp(down.yaw-dx*.004,-.65,.65);pitch=THREE.MathUtils.clamp(down.pitch+dy*.003,.45,1.05)}});
  canvas.addEventListener('pointercancel',()=>down=null);
  canvas.addEventListener('pointerup',e=>{if(!down)return;const click=!down.moved;down=null;if(!click)return;const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects([...actors.values()].map(a=>a.root),true)[0];if(hit)onSelect(actors.get(hit.object.userData.uid).unit)});
  canvas.addEventListener('wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.012,21,28)},{passive:false});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;onFailure('3D 显示暂时中断，已切换 2D；战斗与进度不受影响。')});canvas.addEventListener('webglcontextrestored',()=>{lost=false;resize()});
  function project(p){const v=p.clone().project(camera);return{x:(v.x*.5+.5)*width,y:(-.5*v.y+.5)*height,visible:v.z<1&&v.z>-1}}
  function render({units,events=[],key,dt=0,selected,paused=false}){if(identity!==key){clear();identity=key;now=0}if(!paused)now+=Math.min(dt,.2);const ids=new Set(units.map(u=>u.uid));for(const [uid,a]of actors)if(!ids.has(uid)){scene.remove(a.root);a.shield.material.dispose();if(a.painted){a.painted.material.dispose();const i=spriteMaterials.indexOf(a.painted.material);if(i>=0)spriteMaterials.splice(i,1)}a.label.remove();actors.delete(uid)}for(const u of units){if(!actors.has(u.uid))actors.set(u.uid,createActor(u));actors.get(u.uid).unit=u}events.forEach(event);setCamera();
    for(const a of actors.values()){const u=a.unit;a.base.copy(position(u));a.root.position.copy(a.base);const attackAge=now-a.attack;if(!reducedMotion&&attackAge<.28&&u.hp>0)a.root.position.x+=(u.team==='ally'?1:-1)*Math.sin(attackAge/.28*Math.PI)*.48;a.body.position.y=u.hp>0&&!reducedMotion?Math.sin(now*2+u.position)*.035:0;if(u.hp<=0&&a.dead===null)a.dead=now;const death=a.dead===null?0:THREE.MathUtils.clamp((now-a.dead)/.5,0,1);a.body.rotation.z=death*1.4;a.body.position.y-=death*.35;if(a.painted){const image=a.painted.material.map.image;const loaded=!!(image?.width&&image?.height);a.painted.visible=loaded;a.body.visible=!loaded;const size=u.boss?3.4:['centaur','ursa','magnus','underlord'].includes(u.id)?2.9:2.6;a.painted.scale.set(size*(image?.width&&image?.height?image.width/image.height:1),size,1);a.painted.position.y=a.body.position.y;a.painted.material.opacity=u.hp>0?1:.28;a.painted.material.rotation=death*.8;}a.ring.visible=u.hp>0;a.ring.scale.setScalar(selected===u.uid?.82:.61);a.shield.visible=u.hp>0&&u.shield>0;
      const hit=now-a.hit<.13;a.body.scale.setScalar((u.boss?1.4:['centaur','ursa','underlord','magnus'].includes(u.id)?1.22:1)*(hit?1.035:1));
      const p=project(a.root.position.clone().add(new THREE.Vector3(0,u.boss?3:2.5,0)));a.label.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-100%)`;a.label.hidden=!enabled||!p.visible;a.label.classList.toggle('dead',u.hp<=0);a.label.classList.toggle('selected',selected===u.uid);a.label.querySelector('.unit-health i').style.width=Math.max(0,u.hp/u.maxHp)*100+'%';a.label.querySelector('.unit-mana i').style.width=Math.min(100,u.mana||0)+'%';a.label.querySelector('small').textContent=u.hp<=0?'倒下':`${Math.ceil(u.hp)}${u.stun>0?' · 眩晕':u.shield>0?' · 护盾':''}`;
    }
    for(let i=effects.length-1;i>=0;i--){const e=effects[i],age=now-e.start;if(age>e.life){scene.remove(e.mesh);e.label?.remove();if(e.disposable){e.mesh.geometry.dispose();e.mesh.material.dispose()}effects.splice(i,1);continue}if(!e.disposable){e.mesh.scale.setScalar(.15+age*2);const p=project(e.mesh.position.clone().add(new THREE.Vector3(0,1.3+age,0)));e.label.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-50%)`;e.label.style.opacity=1-age/e.life;}}
    if(enabled&&!lost)renderer.render(scene,camera);
  }
  resize();renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  return{render,setEnabled(value){enabled=value;canvas.hidden=!value;labels.hidden=!value;if(value)resize()},resetCamera(){yaw=0;pitch=.72;distance=21},setQuality(value){quality=value;renderer.shadowMap.enabled=value==='high';resize()},get available(){return !lost},get diagnostics(){return{actors:actors.size,effects:effects.length,calls:renderer.info.render.calls,geometries:renderer.info.memory.geometries}},dispose(){observer.disconnect();clear();geo.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());spriteTextures.forEach(t=>t.dispose());spriteMaterials.forEach(m=>m.dispose());renderer.dispose();canvas.remove();labels.remove()}};
}
