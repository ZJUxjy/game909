import assert from 'node:assert/strict';
import {createFallbackRenderer} from './dist/fallback-renderer.js';
import {createGame,startBattle,tickBattle} from './dist/engine.js';
class FakeImage{set src(v){this.width=300;this.height=270;queueMicrotask(()=>this.onload?.())}}globalThis.Image=FakeImage;
const calls=[];const ctx=new Proxy({}, {get(t,k){return t[k]??((...v)=>calls.push([k,...v]))},set(t,k,v){t[k]=v;return true}});
const view=createFallbackRenderer(ctx);await view.ready;
const b=startBattle(createGame(1));
for(const [width,height] of [[1440,700],[390,500],[768,600]]){const hits=view.render({units:b.units,width,height,time:1000});assert.equal(hits.length,10);assert(hits.every(h=>h.x>=0&&h.x<width&&h.y>=0&&h.y<height&&h.r>0));}
let last=0;for(let i=0;i<100;i++){tickBattle(b,.1);const events=b.events.filter(e=>e.id>last).map(e=>({...e,created:i*100}));if(events.length)last=events.at(-1).id;view.render({units:b.units,width:1440,height:700,time:i*100,events,paused:false})}
assert(calls.some(c=>c[0]==='drawImage'));assert.deepEqual(view.render({width:0,height:0}),[]);
console.log('PASS painted fallback assets, formation hitboxes at desktop/tablet/mobile, live events and zero-sized view. Canvas pixels require browser QA.');
