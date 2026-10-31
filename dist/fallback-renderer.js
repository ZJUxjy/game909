import {spriteIdForUnit} from './sprite-map.js';
/** Painted canvas adapter. Assets are original generated art; battle state stays in engine.js. */
const IDS=['juggernaut','shadowfiend','muerta','ursa','abaddon','centaur','assassin','oracle','underlord','magnus','lina','enemy','enemy-hunter','enemy-caster','enemy-heavy'];
export function createFallbackRenderer(ctx){
 const sprites=new Map();let arena=null;const pending=[];
 function load(path,set){const img=new Image();pending.push(new Promise(resolve=>{img.onload=()=>{set(img);resolve(true)};img.onerror=()=>resolve(false)}));img.src=new URL(path,import.meta.url).href;}
 load('./assets/v4/arena.webp',im=>arena=im);for(const id of IDS)load(`./assets/v4/sprites/${id}.webp`,im=>sprites.set(id,im));
 const ready=Promise.all(pending);let motionTime=0,lastTime=null;
 function render({units=[],events=[],time=0,width:w,height:h,selected,paused=false}){
  if(!(w>0&&h>0))return[];const delta=lastTime===null?0:Math.min(100,time-lastTime);lastTime=time;if(!paused)motionTime+=Math.max(0,delta);
  ctx.clearRect(0,0,w,h);
  if(arena){const s=Math.max(w/arena.width,h/arena.height);ctx.drawImage(arena,(w-arena.width*s)/2,(h-arena.height*s)/2,arena.width*s,arena.height*s)}else{ctx.fillStyle='#d9d2bf';ctx.fillRect(0,0,w,h)}
  const compact=w<600,unitH=Math.min(h*.1875,w*.10875)*(compact?1.24:1),positions=new Map(),hits=[];
  // Formation anchors sit on the empty floor, clear of the scenery and HUD.
  const ally=[[.40,.55],[.47,.77],[.22,.40],[.27,.61],[.32,.82]],enemy=[[.55,.52],[.64,.75],[.66,.36],[.80,.50],[.86,.77]];
  for(const u of units){const xy=(u.team==='ally'?ally:enemy)[Math.max(0,Math.min(4,u.position))];const scale=u.boss?1.23:['centaur','ursa','magnus','underlord'].includes(u.id)?1.1:1;const safeTop=Math.min(95,h*.17)+unitH*scale;positions.set(u.uid,{x:xy[0]*w,y:Math.max(safeTop,xy[1]*h)});}
  for(const u of [...units].sort((a,b)=>positions.get(a.uid).y-positions.get(b.uid).y)){
   const p=positions.get(u.uid),dead=u.hp<=0,id=spriteIdForUnit(u),img=sprites.get(id),size=unitH*(u.boss?1.23:['centaur','ursa','magnus','underlord'].includes(u.id)?1.1:1),sw=img?size*img.width/img.height:size*.9;
   const recent=events.find(e=>e.source===u.uid&&e.type==='damage'&&time-e.created<230);const age=recent?Math.max(0,time-recent.created):0,dx=recent&&!paused?(u.team==='ally'?1:-1)*Math.sin(age/230*Math.PI)*w*.012:0;
   const bob=dead||paused?0:Math.sin(motionTime*.002+u.position)*1.1,x=p.x+dx,y=p.y+bob;
   ctx.save();ctx.globalAlpha=dead?.3:1;
   if(!dead){ctx.strokeStyle=selected===u.uid?'#f7f1cc':u.team==='ally'?'#78c9b2':'#c87862';ctx.lineWidth=selected===u.uid?3:1.5;ctx.beginPath();ctx.ellipse(x,y,sw*.26,size*.065,0,0,Math.PI*2);ctx.stroke();}
   if(img){ctx.save();ctx.translate(x,y);if(u.team==='enemy')ctx.scale(-1,1);if(dead)ctx.rotate(u.team==='ally'?-.8:.8);ctx.drawImage(img,-sw/2,-size,sw,size);ctx.restore();}
   else{ctx.fillStyle='#344840';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText(u.name,x,y-size*.5);}
   const bw=Math.max(32,Math.min(67,size*.62)),barY=y-size-10;
   ctx.fillStyle='#35463e';ctx.fillRect(x-bw/2-1,barY-1,bw+2,6);ctx.fillStyle='#e2dfd4';ctx.fillRect(x-bw/2,barY,bw,4);ctx.fillStyle=u.team==='ally'?'#83c7a6':'#cd7964';ctx.fillRect(x-bw/2,barY,bw*Math.max(0,Math.min(1,u.hp/u.maxHp)),4);
   if(u.shield>0){ctx.fillStyle='#8cc7da';ctx.fillRect(x-bw/2,barY+7,bw*Math.min(1,u.shield/u.maxHp),3)}
   if(u.casting){ctx.fillStyle='#8b5f40';ctx.fillRect(x-bw/2,barY-7,bw,3);ctx.fillStyle='#e9b765';ctx.fillRect(x-bw/2,barY-7,bw*(1-u.casting.remaining/u.casting.total),3)}
   if(selected===u.uid||u.stun>0){ctx.font=`600 ${compact?10:12}px sans-serif`;ctx.textAlign='center';ctx.fillStyle='#243a35';ctx.fillText(u.name+(u.stun>0?' · 眩晕':''),x,y+16);}
   ctx.restore();hits.push({u,x,y:y-size*.48,r:Math.max(23,size*.48)});
  }
  for(const e of events){const age=time-e.created,p=positions.get(e.target||e.source);if(!p||age<0||age>1000)continue;const text=e.type==='damage'?(e.amount>0?String(e.amount):'吸收'):e.type==='heal'?'+'+e.amount:e.type==='miss'?'闪避':e.type==='skill'?e.text:'';if(!text)continue;ctx.save();ctx.globalAlpha=1-age/1000;ctx.font=`600 ${compact?12:15}px sans-serif`;ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#f7f1e6';ctx.fillStyle=e.type==='heal'?'#39795b':e.type==='skill'?'#745832':'#743e34';const y=p.y-unitH*.7-age*.035;ctx.strokeText(text,p.x+(e.offset||0),y);ctx.fillText(text,p.x+(e.offset||0),y);ctx.restore();}
  return hits;
 }
 return{render,ready};
}
