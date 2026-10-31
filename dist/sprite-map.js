/** Enemy archetypes mirror engine positions; this module has no gameplay authority. */
export function spriteIdForUnit(unit){
 if(unit.team==='ally')return unit.id;
 if(unit.boss||unit.position<2)return 'enemy-heavy';
 return unit.position===3?'enemy-hunter':'enemy-caster';
}
