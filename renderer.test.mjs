// Real Three scene/math with a non-GPU backend. Does not validate pixels/shaders.
import assert from 'node:assert/strict';
import {createBattleRenderer} from './dist/renderer.js';
import {createGame,startBattle,tickBattle} from './dist/engine.js';
class Element {
  constructor(){this.children=[];this.listeners={};this.style={};this.nodes={};this.classList={toggle(){}};this.hidden=false;this.parent=null}
  append(...items){for(const e of items){this.children.push(e);e.parent=this}} prepend(e){this.append(e)}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}
  setAttribute(){} setPointerCapture(){} addEventListener(k,f){this.listeners[k]=f}
  querySelector(k){return this.nodes[k]??=new Element()}
  getBoundingClientRect(){return{width:this.width||1000,height:this.height||500,left:0,top:0}}
}
globalThis.document={createElement:()=>new Element()};globalThis.ResizeObserver=class{observe(){}disconnect(){}};globalThis.devicePixelRatio=2;
let scene,camera,renderCalls=0,failures=0,selected=null,disposed=false;
const backend={shadowMap:{},info:{render:{calls:0},memory:{geometries:0}},setClearColor(){},setSize(){},setPixelRatio(){},render(s,c){scene=s;camera=c;s.updateMatrixWorld(true);c.updateMatrixWorld(true);renderCalls++},dispose(){disposed=true}};
const host=new Element(),adapter=createBattleRenderer(host,{onSelect:u=>selected=u,onFailure:()=>failures++,rendererFactory:()=>backend});
const game=createGame(20261031),b=startBattle(game);adapter.render({units:b.units,key:b,dt:.016});adapter.render({units:b.units,key:b,dt:.016});assert.equal(adapter.diagnostics.actors,10);assert(scene.isScene);assert(camera.isPerspectiveCamera);assert(scene.children.length>50);
const layer=host.children.find(x=>x.className==='unit-label-layer');assert.equal(layer.children.length,10);
for(const label of layer.children){const [x,y]=label.style.transform.match(/translate\(([-.\d]+)px,([-\.\d]+)px/).slice(1).map(Number);assert(x>0&&x<1000,`label offscreen x ${x}`);assert(y>0&&y<500,`label offscreen y ${y}`)}
console.log('PASS real Three scene hierarchy, 10 actor meshes, default camera projects every label inside desktop viewport');
const canvas=host.children.find(x=>x.id==='battlefield-3d');canvas.listeners.pointerdown({clientX:50,clientY:50,pointerId:1});canvas.listeners.pointermove({clientX:120,clientY:80});canvas.listeners.pointerup({clientX:120,clientY:80});assert.equal(selected,null);adapter.resetCamera();
let last=0;for(let i=0;i<500&&b.status==='running';i++){tickBattle(b,.1);const events=b.events.filter(e=>e.id>last);if(events.length)last=events.at(-1).id;adapter.render({units:b.units,key:b,dt:.1,events})}assert.equal(b.status,'won');assert(adapter.diagnostics.effects<=81);const labelsBefore=layer.children.map(x=>x.style.transform);adapter.render({units:b.units,key:b,dt:.2,paused:true});assert.deepEqual(layer.children.map(x=>x.style.transform),labelsBefore);
console.log('PASS full deterministic battle through 3D adapter; bounded effects, drag does not select, paused effects do not advance');
canvas.listeners.webglcontextlost({preventDefault(){}});assert.equal(failures,1);assert.equal(adapter.available,false);const count=renderCalls;adapter.render({units:b.units,key:b,dt:.1});assert.equal(renderCalls,count);canvas.listeners.webglcontextrestored();assert(adapter.available);adapter.setEnabled(false);adapter.render({units:b.units,key:b,dt:.1});assert.equal(renderCalls,count);adapter.setEnabled(true);adapter.setQuality('low');assert.equal(backend.shadowMap.enabled,false);adapter.setQuality('high');assert(backend.shadowMap.enabled);
const b2=startBattle(createGame(123));adapter.render({units:b2.units,key:b2,dt:.01});assert.equal(adapter.diagnostics.effects,0);assert.equal(adapter.diagnostics.actors,10);assert.equal(layer.children.length,10);adapter.dispose();assert(disposed);assert.equal(host.children.length,0);
const failedHost=new Element();assert.throws(()=>createBattleRenderer(failedHost,{rendererFactory:()=>{throw new Error('GPU unavailable')}}));assert.equal(failedHost.children.length,0);
console.log('PASS context loss/restoration, 2D visibility, quality modes, new-battle cleanup, disposal and initialization failure cleanup');
console.log('NOTE: GPU pixels, lighting and shader performance still require a WebGL2 browser.');
