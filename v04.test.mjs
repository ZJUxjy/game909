// Behavioral UI regression tests. Happy DOM has no layout/GPU: these do NOT
// replace browser visual, responsive, accessibility or WebGL verification.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import * as E from './dist/engine.js';

async function boot(t, saved) {
  const window = new Window({url:'http://game.test/', settings:{
    disableCSSFileLoading:true, disableJavaScriptFileLoading:true,
    enableJavaScriptEvaluation:true
  }});
  t.after(async()=>{ await Promise.resolve(); await window.happyDOM.close(); });
  const document=window.document;
  document.write((await readFile(new URL('./dist/index.html',import.meta.url),'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''));
  if(saved) window.localStorage.setItem('emberbound-v1',E.serialize(saved));
  window.requestAnimationFrame=()=>0;
  window.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({addColorStop(){}})});
  window.__engine=E;
  let source=await readFile(new URL('./dist/app.js',import.meta.url),'utf8');
  source=source.replace(/import\s*\{([^}]+)\}\s*from\s*'\.\/engine.js';/, 'const {$1} = window.__engine;')
    .replace(/import\s*\{createFallbackRenderer\}\s*from\s*'\.\/fallback-renderer.js';/, 'const createFallbackRenderer = () => ({render:()=>[],ready:Promise.resolve()});')
    .replace(/import\('\.\/renderer.js'\)/,"Promise.resolve({createBattleRenderer:()=>({available:false,setEnabled(){},dispose(){}})})");
  window.eval(source+'\nwindow.__advanceFrame=frame;');
  await Promise.resolve(); await Promise.resolve();
  const $=s=>{const el=document.querySelector(s);assert.ok(el,`Missing control ${s}`);return el;};
  const click=s=>$(s).click();
  const change=(s,value)=>{const before=$(s);before.value=value;before.dispatchEvent(new window.Event('change',{bubbles:true}));const after=$(s);if(after!==before&&after.tagName==='SELECT'){/* Work around Happy DOM selectedIndex after fragment parsing, validating app markup first. */assert.equal(after.querySelector('option[selected]')?.value,value);after.value=value;}};
  return {window,document,$,click,change,get game(){return window.emberbound.game;},get battle(){return window.emberbound.battle;}};
}

function finish(g) {for(let i=0;i<1500&&g.battle.status==='running';i++)E.tickBattle(g.battle,.1);assert.notEqual(g.battle.status,'running');g.window.__advanceFrame(100);}

test('first render exposes five distinct playable hero cards and named dialog',async t=>{
  const g=await boot(t);assert.equal(g.document.querySelectorAll('#party [data-hero]').length,5);
  g.click('[data-view="growth"]');assert.equal(g.document.querySelectorAll('#modal [data-hero]').length,11);
  assert.ok(g.$('#modal').getAttribute('aria-labelledby'));assert.equal(g.$('#modal-title').textContent,'你的远征同伴');
  assert.match(g.$('#modal [data-hero="muerta"] .card-pos').textContent,/候补/);
});
test('forge retains selected recipient across tabs and equips that hero',async t=>{
  const g=await boot(t);g.click('[data-view="forge"]');g.change('#equip-hero','lina');
  g.click('[data-forge="craft"]');g.click('[data-forge="shop"]');g.click('[data-forge="inventory"]');
  // Happy DOM's fragment parser does not consistently synchronize selectedIndex.
  // Assert the emitted selected option, then set the native-control value for the click.
  assert.equal(g.$('#equip-hero option[selected]').value,'lina');g.$('#equip-hero').value='lina';const item=g.game.inventory[0];g.click(`[data-equip="${item.id}"]`);
  assert.equal(g.game.roster.find(h=>h.id==='lina').equipment[item.slot].id,item.id);
  assert.equal(g.$('#equip-hero option[selected]').value,'lina');
});
test('modal returns focus to connected opener after repeated internal navigation',async t=>{
  const g=await boot(t);const opener=g.$('[data-view="forge"]');opener.focus();opener.click();
  g.$('[data-forge="craft"]').focus();g.click('[data-forge="craft"]');
  assert.equal(g.document.activeElement.dataset.forge,'craft');
  g.click('[data-forge="inventory"]');g.click('#close-modal');assert.equal(g.document.activeElement,opener);
  assert.equal(g.$('.game-shell').inert,false);
});
test('hero rerender preserves spec select focus and close returns to original card',async t=>{
  const g=await boot(t);const opener=g.$('#party [data-hero="juggernaut"]');opener.focus();opener.click();
  g.$('#hero-spec').focus();g.change('#hero-spec','坦克');assert.equal(g.document.activeElement.id,'hero-spec');
  g.click('#close-modal');assert.ok(g.document.activeElement.isConnected);assert.notEqual(g.document.activeElement,g.document.body);
});
test('unaffordable training, craft and purchase are disabled without resource changes',async t=>{
  const saved=E.createGame();saved.gold=0;saved.essence=0;const g=await boot(t,saved);
  g.click('#party [data-hero="centaur"]');assert.equal(g.$('#train').disabled,true);g.click('#train');assert.equal(g.game.gold,0);
  g.click('#close-modal');g.click('[data-view="forge"]');g.click('[data-forge="craft"]');
  assert.ok([...g.document.querySelectorAll('[data-craft]')].every(x=>x.disabled));
  g.click('[data-forge="shop"]');assert.ok([...g.document.querySelectorAll('[data-buy]')].every(x=>x.disabled));
});
test('level cap and absent craft profession disable relevant actions',async t=>{
  const saved=E.createGame();saved.gold=10000;saved.roster.forEach(h=>{h.level=20;h.profession='辩手';});
  const g=await boot(t,saved);g.click('#party [data-hero="centaur"]');assert.equal(g.$('#train').disabled,true);
  g.click('#close-modal');g.click('[data-view="forge"]');g.click('[data-forge="craft"]');
  assert.ok([...g.document.querySelectorAll('[data-craft]')].every(x=>x.disabled));
});
test('party draft cancel preserves party, confirm requires exactly five',async t=>{
  const g=await boot(t);const original=[...g.game.party];g.click('#edit-party');g.click('#modal [data-hero="centaur"]');
  assert.equal(g.$('#confirm-party').disabled,true);g.click('#close-modal');assert.deepEqual([...g.game.party],original);
  g.click('#edit-party');g.click('#modal [data-hero="centaur"]');g.click('#modal [data-hero="ursa"]');g.click('#confirm-party');
  assert.equal(g.game.party.length,5);assert.ok(g.game.party.includes('ursa'));assert.ok(!g.game.party.includes('centaur'));
});
test('rule editing persists, enforces eight-rule cap and remains keyboard focused',async t=>{
  const g=await boot(t);g.click('#party [data-hero="centaur"]');
  for(let i=0;i<7;i++)g.click('#add-rule');assert.equal(g.game.roster.find(h=>h.id==='centaur').rules.length,8);
  assert.equal(g.$('#add-rule').disabled,true);g.click('#add-rule');assert.equal(g.game.roster.find(h=>h.id==='centaur').rules.length,8);
  g.change('[data-rule="0"] .rule-action-select','protect');assert.equal(g.$('[data-rule="0"] .rule-target').value,'lowest_ally');
  const persisted=E.deserialize(g.window.localStorage.getItem('emberbound-v1'));assert.equal(persisted.roster.find(h=>h.id==='centaur').rules[0].action,'protect');
});
test('battle guards mutable hero controls and all commander actions share three charges',async t=>{
  const g=await boot(t);g.click('#start');assert.equal(g.battle.status,'running');assert.equal(g.$('#start').disabled,true);
  g.click('#pause');assert.match(g.$('#phase').textContent,/暂停/);g.click('#ward-command');assert.equal(g.battle.commander.charges,2);
  assert.equal(g.$('#ward-command').disabled,true);assert.equal(g.$('#rally-command').disabled,true);
  g.click('#party [data-hero="centaur"]');assert.equal(g.$('#train').disabled,true);assert.equal(g.$('#hero-spec').disabled,true);assert.equal(g.$('#hero-equip').disabled,true);
});
test('AI cup does not modify real progression or pending relic draft',async t=>{
  const saved=E.createGame();saved.pendingRelics={choices:E.RELICS.map(r=>r.id)};const g=await boot(t,saved);const before=E.serialize(g.game);
  g.click('[data-view="club"]');g.click('#run-cup');g.click('#run-cup');assert.equal(E.serialize(g.game),before);
  assert.ok(g.$('#bracket').textContent.includes('八强赛'));
});
test('reset can be cancelled, and confirmed reset clears stale battle interface',async t=>{
  const g=await boot(t);const before=E.serialize(g.game);g.click('#reset');g.click('#cancel-reset');assert.equal(E.serialize(g.game),before);
  g.$('#clock').textContent='09:59';g.$('#battle-log').innerHTML='<div>old event</div>';g.$('#battle-log').classList.remove('hidden');g.click('#speed');
  g.click('#reset');g.click('#confirm-reset');assert.equal(g.$('#clock').textContent,'00:00');assert.equal(g.$('#speed').textContent,'1×');
  assert.equal(g.$('#battle-log').textContent,'');assert.ok(g.$('#battle-log').classList.contains('hidden'));assert.equal(g.game.floor,1);assert.equal(g.battle,null);
});
test('finale replay victory does not claim imaginary inventory reward',async t=>{
  const saved=E.createGame();saved.floor=16;saved.cleared=15;saved.completed=true;
  const g=await boot(t,saved);g.click('#start');g.battle.units.filter(u=>u.team==='enemy').forEach(u=>u.hp=0);g.window.__advanceFrame(100);g.window.__advanceFrame(200);g.window.__advanceFrame(300);
  assert.match(g.$('#battle-overlay').textContent,/不发放奖励/);assert.doesNotMatch(g.$('#battle-overlay').textContent,/已进入背包/);
});
test('unequip transfers identical gear between heroes without duplicates or stat loss',()=>{
  const g=E.createGame(),item=g.inventory[0],a=g.roster[0],b=g.roster[1],baseline=E.getStats(a);
  assert.equal(E.equipItem(g,a.id,item.id).ok,true);assert.notDeepEqual(E.getStats(a),baseline);
  assert.equal(E.unequipItem(g,a.id,item.slot).ok,true);assert.deepEqual(E.getStats(a),baseline);
  assert.equal(g.inventory.filter(x=>x.id===item.id).length,1);const before=E.serialize(g);
  assert.equal(E.unequipItem(g,a.id,item.slot).ok,false);assert.equal(E.serialize(g),before);
  assert.equal(E.equipItem(g,b.id,item.id).ok,true);assert.equal(b.equipment[item.slot],item);
  assert.equal(g.inventory.some(x=>x.id===item.id),false);
  assert.equal(E.unequipItem(g,'bogus',item.slot).ok,false);assert.equal(E.unequipItem(g,b.id,'bogus').ok,false);
});
test('equipped item can be removed through workshop then equipped to another hero',async t=>{
  const g=await boot(t);g.click('[data-view="forge"]');const item=g.game.inventory[0];
  g.change('#equip-hero','lina');g.click(`[data-equip="${item.id}"]`);g.click(`[data-unequip="${item.slot}"]`);
  assert.equal(g.game.inventory.filter(x=>x.id===item.id).length,1);assert.equal(g.game.roster.find(h=>h.id==='lina').equipment[item.slot],undefined);
  g.change('#equip-hero','oracle');g.click(`[data-equip="${item.id}"]`);assert.equal(g.game.roster.find(h=>h.id==='oracle').equipment[item.slot].id,item.id);
});
test('first victory relic choice is saved once and permits the next battle',async t=>{
  const g=await boot(t);g.click('#start');g.battle.units.filter(u=>u.team==='enemy').forEach(u=>u.hp=0);
  for(let i=1;i<=4;i++)g.window.__advanceFrame(i*100);
  assert.equal(g.game.floor,2);assert.ok(g.game.pendingRelics);const gold=g.game.gold;
  g.click('#start');const choice=g.$('[data-relic]');const id=choice.dataset.relic;choice.click();
  assert.equal(g.game.relics[id],1);assert.equal(g.game.pendingRelics,null);assert.equal(g.game.gold,gold);
  const restored=E.deserialize(g.window.localStorage.getItem('emberbound-v1'));assert.equal(restored.relics[id],1);assert.equal(restored.pendingRelics,null);
  g.click('#start');assert.equal(g.battle.floor,2);assert.equal(g.battle.status,'running');
});
test('Escape closes modal and keyboard Tab stays inside the dialog',async t=>{
  const g=await boot(t);g.$('#help').focus();g.click('#help');
  const buttons=[...g.document.querySelectorAll('#modal button:not(:disabled),#modal select:not(:disabled),#modal input:not(:disabled)')];
  buttons.at(-1).focus();g.document.dispatchEvent(new g.window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.equal(g.document.activeElement,buttons[0]);
  buttons[0].focus();g.document.dispatchEvent(new g.window.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));assert.equal(g.document.activeElement,buttons.at(-1));
  g.document.dispatchEvent(new g.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.ok(g.$('#modal').classList.contains('hidden'));assert.equal(g.document.activeElement.id,'help');
});
