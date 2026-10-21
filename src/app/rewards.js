

/* app/rewards.js */
/** Read-only, deterministic presentation of the *currently knowable* rewards.
 * Event deck outcomes are deliberately excluded from all estimates.
 */
function rewardForNode(catalog,game,heroId,nodeId){
  const p=game.players[heroId],city=catalog.cityByNode[nodeId],control=catalog.controlByNode[nodeId];
  if(!city&&!control)return null;
  const stateId=(city||control).state_id;
  const visited=city?p.visitedCities.includes(city.id):p.visitedControls.includes(control.id);
  const originState=catalog.heroes[heroId].game_origin_state_id;
  const homeNode=catalog.heroes[heroId].game_start.node_id;
  const cityOwner=city?game.cityCardOwners[city.id]:null;
  const stateOwner=game.stateCardOwners[stateId];
  const freeCity=!!city&&!cityOwner&&homeNode!==nodeId;
  const freeState=!!catalog.states[stateId]&&!stateOwner&&originState!==stateId;
  const label=city?city.name:control.name;
  return {name:label,visited,cityOwner,stateOwner,freeCity,freeState,
    regularPoints:visited?0:city?city.value:control.map_marker_nominal,
    cityCardPoints:freeCity?city.value:0,
    stateCardPoints:freeState?catalog.states[stateId].card_value:0,
    total:(visited?0:city?city.value:control.map_marker_nominal)+(freeCity?city.value:0)+(freeState?catalog.states[stateId].card_value:0),
    cityId:city?.id,controlId:control?.id,stateId};
}
function availableRewards(catalog,game,heroId){
 const cities=Object.values(catalog.cities).filter(c=>!game.cityCardOwners[c.id] && catalog.heroes[heroId].game_start.node_id!==c.node_id);
 const states=Object.values(catalog.states).filter(s=>!game.stateCardOwners[s.id] && catalog.heroes[heroId].game_origin_state_id!==s.id);
 return {cities,states};
}
function summarizeRoute(catalog,game,heroId,path){
 const p=game.players[heroId],citiesVisited=new Set(p.visitedCities),controlsVisited=new Set(p.visitedControls),statesVisited=new Set(p.visitedStates),setsCompleted=new Set(p.completedStates);
 const capturedCities=new Set(),capturedStates=new Set();
 const out={regular:0,cityCards:0,stateCards:0,sets:0,total:0,newCities:[],newControls:[],newCityCards:[],newStateCards:[],completedSets:[]};
 for(const nodeId of path.slice(1)){
   const city=catalog.cityByNode[nodeId],control=catalog.controlByNode[nodeId];
   if(!city&&!control)continue;
   if(city){
     if(!citiesVisited.has(city.id)){citiesVisited.add(city.id);out.regular+=city.value;out.newCities.push(city.name);}
     if(!game.cityCardOwners[city.id]&&!capturedCities.has(city.id)&&catalog.heroes[heroId].game_start.node_id!==nodeId){capturedCities.add(city.id);out.cityCards+=city.value;out.newCityCards.push(city.name);}
   }
   if(control&&!controlsVisited.has(control.id)){controlsVisited.add(control.id);out.regular+=control.map_marker_nominal;out.newControls.push(control.name);}
   const stateId=(city||control).state_id,st=catalog.states[stateId];
   if(st){
     if(!game.stateCardOwners[stateId]&&!capturedStates.has(stateId)&&catalog.heroes[heroId].game_origin_state_id!==stateId){capturedStates.add(stateId);out.stateCards+=st.card_value;out.newStateCards.push(st.name);}
     statesVisited.add(stateId);
     if(city&&st.city_ids.length>1&&st.city_ids.every(x=>citiesVisited.has(x))&&!setsCompleted.has(stateId)){setsCompleted.add(stateId);out.sets+=st.full_city_set_bonus?.value||st.city_ids.length;out.completedSets.push(st.name);}
   }
 }
 out.total=out.regular+out.cityCards+out.stateCards+out.sets;
 return out;
}

export { rewardForNode, availableRewards, summarizeRoute };
