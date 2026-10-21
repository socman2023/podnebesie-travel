

/* app/guide.js */
/** Read-only lore companion. Does not touch scoring or game transitions. */
function openedGuideEntries(game, guide, heroId) {
  if (!game || !guide || !game.players[heroId]) return {cities:[],states:[]};
  const p=game.players[heroId];
  const cities=(p.visitedCities||[]).map(id=>guide.cities[id]).filter(Boolean);
  const states=(p.visitedStates||[]).map(id=>guide.states[id]).filter(Boolean);
  const compare=(a,b)=>a.name.localeCompare(b.name,'ru');
  return {cities:cities.sort(compare),states:states.sort(compare)};
}
function discoveriesFromEvents(events, heroId, guide) {
  const unique=new Set(),found=[];
  for(const ev of events){
    if(ev.heroId!==heroId)continue;
    const kind=ev.type==='city_visited'?'city':ev.type==='state_visited'?'state':null;
    const id=kind==='city'?ev.cityId:kind==='state'?ev.stateId:null;
    if (!id || !(kind==='city'?guide.cities:guide.states)[id] || unique.has(kind+':'+id)) continue;
    unique.add(kind+':'+id);found.push({kind,id,name:guide[kind==='city'?'cities':'states'][id].name});
  }
  return found;
}
function guideEntryAccessible(game,heroId,kind,id) {
  const p=game?.players?.[heroId];
  return !!(p && (kind==='city'?p.visitedCities:kind==='state'?p.visitedStates:[]).includes(id));
}

export { openedGuideEntries, discoveriesFromEvents, guideEntryAccessible };
