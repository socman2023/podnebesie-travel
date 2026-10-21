import { current, possibleActions } from "./engine.js";

/* src/bots.js */

/** Public observations deliberately exclude the shuffled deck order, rng seed and future dice.
 * The bot sees only public players' positions/collections/scores and the current legal actions.
 */
function publicObservation(game,catalog){
  const activeHeroId=game.order[game.turnIndex];
  const players={};
  for(const [id,p] of Object.entries(game.players)) players[id]={
    heroId:id,node:p.node,previousNode:p.previousNode,score:p.score,skips:p.skips,
    visitedCities:[...p.visitedCities],visitedControls:[...p.visitedControls],
    visitedStates:[...p.visitedStates],completedStates:[...p.completedStates],
    ownedCityCards:[...p.ownedCityCards],ownedStateCards:[...p.ownedStateCards]
  };
  return {
    phase:game.phase,activeHeroId,day:game.day,days:game.config.days,
    players,order:[...game.order],
    cityCardOwners:{...game.cityCardOwners},stateCardOwners:{...game.stateCardOwners},
    legal:possibleActions(game,catalog)
  };
}

function botRandom(seed){
  let x=(seed>>>0)||0x9e3779b9;
  return ()=>{
    x^=(x<<13);x^=(x>>>17);x^=(x<<5);
    return (x>>>0)/4294967296;
  };
}

const memo = new WeakMap();
function distances(catalog){
  if(memo.has(catalog))return memo.get(catalog);
  const nodes=catalog.nodes,table={};
  for(const source of Object.keys(nodes)){
    const q=[source],d={[source]:0};
    for(let i=0;i<q.length;i++)for(const n of nodes[q[i]].neighbors){
      if(d[n]!==undefined)continue;
      d[n]=d[q[i]]+1;q.push(n);
    }
    table[source]=d;
  }
  memo.set(catalog,table);return table;
}

function gainAt(obs,c,heroId,city,control,visitedCities,visitedControls,visitedStates){
  const p=obs.players[heroId];let value=0;
  if(city){
    if(!visitedCities.has(city.id))value+=city.value;
    if(!visitedCities.has(city.id) && !obs.cityCardOwners[city.id] && c.heroes[heroId].game_start.node_id!==city.node_id)value+=city.value;
    if(!visitedStates.has(city.state_id) && !obs.stateCardOwners[city.state_id] && c.heroes[heroId].game_origin_state_id!==city.state_id){
      value+=c.states[city.state_id]?.card_value||0;
    }
    const st=c.states[city.state_id];
    if(st?.full_city_set_bonus?.enabled&&!p.completedStates.includes(st.id)&&!visitedCities.has(city.id)){
      const missing=st.city_ids.filter(x=>!visitedCities.has(x));
      if(missing.length===1)value+=st.full_city_set_bonus.value;
      else if(missing.length<=3)value+=0.3;
    }
    visitedCities.add(city.id);
    if(city.state_id)visitedStates.add(city.state_id);
  }
  if(control){
    if(!visitedControls.has(control.id))value+=control.map_marker_nominal;
    if(!visitedStates.has(control.state_id)&&!obs.stateCardOwners[control.state_id] && c.heroes[heroId].game_origin_state_id!==control.state_id)
      value+=c.states[control.state_id]?.card_value||0;
    visitedControls.add(control.id);visitedStates.add(control.state_id);
  }
  return value;
}

function targets(obs,c,heroId,visitedCities,visitedControls,visitedStates){
  const out=[];
  for(const city of Object.values(c.cities)){
    const vc=visitedCities.has(city.id),free=!obs.cityCardOwners[city.id]&&c.heroes[heroId].game_start.node_id!==city.node_id;
    const stateFree=!visitedStates.has(city.state_id)&&!obs.stateCardOwners[city.state_id]&&c.heroes[heroId].game_origin_state_id!==city.state_id;
    let reward=(vc?0:city.value)+(free?city.value:0)+(stateFree?c.states[city.state_id]?.card_value||0:0);
    if(!vc){
      const st=c.states[city.state_id],p=obs.players[heroId];
      if(st?.full_city_set_bonus?.enabled&&!p.completedStates.includes(st.id)){
        const missing=st.city_ids.filter(x=>!visitedCities.has(x));
        if(missing.length===1)reward+=st.full_city_set_bonus.value;
      }
    }
    if(reward>0)out.push({node:city.node_id,reward,cityId:city.id});
  }
  for(const ctr of Object.values(c.controls)){
    const free=!visitedStates.has(ctr.state_id)&&!obs.stateCardOwners[ctr.state_id]&&c.heroes[heroId].game_origin_state_id!==ctr.state_id;
    const reward=(visitedControls.has(ctr.id)?0:ctr.map_marker_nominal)+(free?c.states[ctr.state_id]?.card_value||0:0);
    if(reward>0)out.push({node:ctr.node_id,reward,controlId:ctr.id});
  }
  return out;
}

function routeValue(obs,c,heroId,path,style){
  const p=obs.players[heroId],vc=new Set(p.visitedCities),vct=new Set(p.visitedControls),vs=new Set(p.visitedStates);
  let immediate=0;
  for(let i=1;i<path.length;i++)immediate+=gainAt(obs,c,heroId,c.cityByNode[path[i]],c.controlByNode[path[i]],vc,vct,vs);
  const target=path[path.length-1],futureTargets=targets(obs,c,heroId,vc,vct,vs);
  const dist=distances(c)[target];
  const remain=obs.days-obs.day;
  const future=(list,focus)=>{
    const arr=[];
    for(const t of list){
      const d=dist[t.node];if(!Number.isFinite(d))continue;
      let prize=t.reward;
      if(style==='lookahead'){
        const opponents=Object.entries(obs.players).filter(([id])=>id!==heroId);
        // Opponents are public, but future rolls and events are never consulted.
        if(!obs.cityCardOwners[t.cityId]||!obs.stateCardOwners[t.controlId]){
          const bestOther=Math.min(Infinity,...opponents.map(([id,v])=>distances(c)[v.node][t.node]??Infinity));
          if(bestOther+1.3<d)prize*=0.68;
        }
      }
      const score=prize/(1+(d/3.5))**1.4;
      arr.push({node:t.node,score,d,reward:prize});
    }
    arr.sort((a,b)=>b.score-a.score); if(!arr.length)return 0;
    if(style==='basic')return arr[0].score*0.78+(arr[1]?.score||0)*0.06;
    const a=arr.slice(0,4);let best=0;
    for(const first of a){
      let second=0;
      for(const follow of arr){
        if(first.node===follow.node)continue;
        const dd=distances(c)[first.node][follow.node];
        const v=follow.reward/(1+dd/3.5)**1.5;
        if(v>second)second=v;
      }
      const plan=first.score+0.48*second/(1+first.d/5);
      if(plan>best)best=plan;
    }
    return best*0.83;
  };
  const horizon=Math.min(1,remain/2+0.25);
  const prospect=future(futureTargets,1)*horizon;
  const endNode=c.nodes[target];
  // Expected value of an event is uncertain; route planning never knows top deck card.
  const eventPenalty=endNode.type==='event'?0.18:0;
  // Movement beginning on an unproductive city can move backwards freely later.
  return immediate+prospect-eventPenalty;
}

function destinationValue(obs,c,id,node,style){
  const fake={...obs,players:{...obs.players,[id]:{...obs.players[id],node}}};
  const v=routeValue(fake,c,id,[obs.players[id].node,node],style);
  return v;
}

function pickBest(values,rand,randomTie=0.0005){
  let max=-Infinity,idx=[];
  for(let i=0;i<values.length;i++){
    const v=values[i];
    if(v>max+randomTie){max=v;idx=[i];}
    else if(v>=max-randomTie){idx.push(i);}
  }
  return idx[Math.floor(rand()*idx.length)];
}

/** Bot never receives private engine state. Random decisions use independent seed. */
function selectBotAction(observation,catalog,style='basic',rand=Math.random){
  if(!['random','basic','lookahead'].includes(style))throw Error('unknown bot style');
  const {legal,activeHeroId:id}=observation;
  if(legal.phase==='finished')return null;
  if(legal.phase==='roll')return {type:'roll'};
  if(legal.phase==='route'){
    if(style==='random')return {type:'chooseRoute',path:legal.routes[Math.floor(rand()*legal.routes.length)]};
    const scores=legal.routes.map(path=>routeValue(observation,catalog,id,path,style));
    return {type:'chooseRoute',path:legal.routes[pickBest(scores,rand)]};
  }
  if(legal.phase==='destination'){
    if(style==='random')return {type:'chooseDestination',nodeId:legal.options[Math.floor(rand()*legal.options.length)]};
    const scores=legal.options.map(node=>destinationValue(observation,catalog,id,node,style));
    return {type:'chooseDestination',nodeId:legal.options[pickBest(scores,rand)]};
  }
  if(legal.phase==='event_choice'){
    const opts=legal.choices.filter(x=>x.available);
    if(!opts.length)throw Error('no affordable choice');
    if(style==='random')return {type:'chooseChoice',choiceId:opts[Math.floor(rand()*opts.length)].id};
    const event=catalog.events[legal.eventId];
    const scores=opts.map(opt=>{
      const actions=event.choices.find(x=>x.id===opt.id).actions;
      let utility=0;
      for(const a of actions){
        if(a.op==='pay_points'||a.op==='lose_points')utility-=Math.min(observation.players[id].score,a.amount);
        if(a.op==='gain_points')utility+=a.amount;
        if(a.op==='skip_turns')utility-=a.amount*(observation.days-observation.day<2?1.2:2.1);
        if(a.op==='move_forward')utility+=a.amount*0.9;
        if(a.op==='extra_turn')utility+=a.amount*3.4;
        if(a.op==='move_nearest_city')utility+=2.4;
      }
      return utility;
    });
    return {type:'chooseChoice',choiceId:opts[pickBest(scores,rand)].id};
  }
  throw Error(`Unsupported phase: ${legal.phase}`);
}

export { publicObservation, botRandom, memo, distances, gainAt, targets, routeValue, destinationValue, pickBest, selectBotAction };
