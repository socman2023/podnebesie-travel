import { rollD6, shuffle } from "./rng.js";
import { shortestPath, nearestCities, enumerateRoutes, verifySelectedPath } from "./graph.js";

/* src/engine.js */

/**
 * Deterministic, dependency-free engine. Every command returns a new state;
 * rejected commands throw without changing the input. UI/bots are outside this module.
 * Commands: roll, chooseRoute, chooseChoice, chooseDestination.
 */
const assert=(v,message)=>{if(!v) throw new Error(message)};
const eventLog=(s,type,details={})=>s.log.push({day:s.day,heroId:s.order[s.turnIndex],type,...details});
const current=(s)=>s.players[s.order[s.turnIndex]];
const enterOnce=(array,id)=>{if(array.includes(id))return false;array.push(id);return true};

function createGame(catalog,{heroIds,days=15,seed=1}={}) {
  assert(days===15||days===30,'days must be 15 or 30');
  assert(Array.isArray(heroIds)&&heroIds.length>=2&&heroIds.length<=8,'need 2..8 characters');
  assert(new Set(heroIds).size===heroIds.length,'duplicate heroes');
  for(const id of heroIds) assert(catalog.heroes[id],`unknown hero ${id}`);
  assert(Number.isInteger(seed)&&seed>=0&&seed<=0xffffffff,'seed is uint32');
  const order=[...heroIds].sort((a,b)=>catalog.heroes[a].order-catalog.heroes[b].order);
  const players={};
  for(const id of order) {
    const h=catalog.heroes[id],start=h.game_start;
    const homeCity=catalog.cityByNode[start.node_id];
    const homeControl=catalog.controlByNode[start.node_id];
    assert(homeCity||homeControl,`start must be a city or control: ${id}`);
    players[id]={heroId:id,node:start.node_id,previousNode:null,
      history:[start.node_id],score:start.initial_points,skips:0,
      visitedCities:homeCity?[homeCity.id]:[],
      visitedControls:homeControl?[homeControl.id]:[],
      visitedStates:[h.game_origin_state_id],
      gramotas:[],ownedCityCards:[],ownedStateCards:[],completedStates:[],
      earned:start.initial_points,spent:0,lost:0,missedTurns:0,throws:0};
  }
  const s={schemaVersion:1,gameDataVersion:catalog.data.version,graphVersion:catalog.map.audit_version,
    config:{days},rngSeed:seed>>>0,order,players,day:1,turnIndex:0,phase:'roll',
    lastRoll:null,pending:null,extraTurns:0,cityCardOwners:{},stateCardOwners:{},
    decks:{land:{draw:[],discard:[]},sea:{draw:[],discard:[]}},results:null,log:[]};
  for(const type of ['land','sea']) {
    s.decks[type].draw=shuffle(s,catalog.data.events[type].map(e=>e.id));
  }
  eventLog(s,'game_started',{order,days});
  return s;
}

function gain(s,player,amount,reason){
  assert(Number.isInteger(amount)&&amount>=0,'gain amount invalid');
  player.score+=amount;player.earned+=amount;
  if(amount)eventLog(s,'gain',{points:amount,reason,total:player.score});
}
function lose(s,player,amount,reason,kind='lost'){
  assert(Number.isInteger(amount)&&amount>=0,'loss amount invalid');
  const actual=Math.min(player.score,amount);
  player.score-=actual;player[kind]+=actual;
  if(actual)eventLog(s,kind,{points:actual,reason,total:player.score});
}
function grantState(s,c,p,stateId){
  if(!stateId || !c.states[stateId]) return;
  if(!enterOnce(p.visitedStates,stateId)) return;
  p.gramotas.push(`gram_state_${stateId}`);
  eventLog(s,'state_visited',{stateId});
  if(!s.stateCardOwners[stateId] && c.heroes[p.heroId].game_origin_state_id!==stateId){
    s.stateCardOwners[stateId]=p.heroId;
    p.ownedStateCards.push(stateId);
    gain(s,p,c.states[stateId].card_value,`state_card:${stateId}`);
    eventLog(s,'state_captured',{stateId});
  }
}
/** First eligible external visitor can obtain card EVEN if original native player visited the region first. */
function captureStateEvenAfterNativeVisit(s,c,p,stateId){
  if(!stateId || !c.states[stateId]) return;
  if(!s.stateCardOwners[stateId] && c.heroes[p.heroId].game_origin_state_id!==stateId){
    s.stateCardOwners[stateId]=p.heroId;
    p.ownedStateCards.push(stateId);
    gain(s,p,c.states[stateId].card_value,`state_card:${stateId}`);
    eventLog(s,'state_captured',{stateId});
  }
}
function checkCollection(s,c,p,stateId){
  const state=c.states[stateId];
  if(!state?.full_city_set_bonus?.enabled || p.completedStates.includes(stateId))return;
  if(state.city_ids.length>1 && state.city_ids.every(id=>p.visitedCities.includes(id))){
    p.completedStates.push(stateId);
    gain(s,p,state.full_city_set_bonus.value,`complete_state:${stateId}`);
    eventLog(s,'state_completed',{stateId});
  }
}
function arriveAtNode(s,c,nodeId){
  const p=current(s);
  const city=c.cityByNode[nodeId];
  if(city){
    if(enterOnce(p.visitedCities,city.id)){
      p.gramotas.push(`gram_city_${city.id}`);
      gain(s,p,city.value,`visit_city:${city.id}`);
      eventLog(s,'city_visited',{cityId:city.id});
    }
    if(!s.cityCardOwners[city.id] && c.heroes[p.heroId].game_start.node_id!==nodeId){
      s.cityCardOwners[city.id]=p.heroId;
      p.ownedCityCards.push(city.id);
      gain(s,p,city.value,`city_card:${city.id}`);
      eventLog(s,'city_captured',{cityId:city.id});
    }
    grantState(s,c,p,city.state_id);
    captureStateEvenAfterNativeVisit(s,c,p,city.state_id);
    checkCollection(s,c,p,city.state_id);
  }
  const control=c.controlByNode[nodeId];
  if(control){
    if(enterOnce(p.visitedControls,control.id)){
      gain(s,p,control.map_marker_nominal,`visit_control:${control.id}`);
      eventLog(s,'control_visited',{controlId:control.id});
    }
    grantState(s,c,p,control.state_id);
    captureStateEvenAfterNativeVisit(s,c,p,control.state_id);
  }
}
function recordWalk(s,c,path){
  const p=current(s);
  for(let i=1;i<path.length;i++) {
    const from=p.node,to=path[i];
    assert(c.nodes[from]?.neighbors.includes(to),`not adjacent: ${from},${to}`);
    p.previousNode=from;
    p.node=to;
    p.history.push(to);
    eventLog(s,'step',{from,to});
    arriveAtNode(s,c,to);
  }
}
function recordBacktrack(s,c,steps){
  const p=current(s);let remaining=steps;
  while(remaining>0 && p.history.length>1){
    const from=p.node;
    p.history.pop();
    const to=p.history.at(-1);
    p.node=to;p.previousNode=from;
    eventLog(s,'step_back',{from,to});
    arriveAtNode(s,c,to);
    remaining--;
  }
  return remaining;
}
function endSlot(s){
  if(s.extraTurns>0){
    s.extraTurns--;s.phase='roll';s.pending=null;s.lastRoll=null;
    eventLog(s,'extra_turn_started');
    return;
  }
  s.turnIndex++;
  if(s.turnIndex>=s.order.length){s.turnIndex=0;s.day++;}
  if(s.day>s.config.days){
    s.phase='finished';s.pending=null;s.results=rankPlayers(s);
    eventLog(s,'game_finished',{winners:s.results.winners});
    return;
  }
  s.phase='roll';s.pending=null;s.lastRoll=null;
  consumeSkippedSlots(s);
}
function consumeSkippedSlots(s){
  while(s.phase==='roll') {
    const p=current(s);
    if(p.skips===0)return;
    p.skips--;p.missedTurns++;
    eventLog(s,'turn_skipped',{remaining:p.skips});
    endSlot(s);
  }
}
function rankPlayers(s){
  const entries=Object.values(s.players).map(p=>({
    heroId:p.heroId,score:p.score,visitedCities:p.visitedCities.length,
    cityCards:p.ownedCityCards.length,stateCards:p.ownedStateCards.length,
    completedStates:p.completedStates.length,visitedControls:p.visitedControls.length
  }));
  entries.sort((a,b)=>b.score-a.score || b.visitedCities-a.visitedCities || s.order.indexOf(a.heroId)-s.order.indexOf(b.heroId));
  let rank=0,previous=null;
  for (let i=0;i<entries.length;i++){
    const e=entries[i];
    if(!previous||e.score!==previous.score||e.visitedCities!==previous.visitedCities)rank=i+1;
    e.rank=rank;previous=e;
  }
  return {ranking:entries,winners:entries.filter(x=>x.rank===1).map(x=>x.heroId)};
}
function prepareRoute(s,c,steps,kind='forward',fromOrigin=false){
  assert(steps>=1 && steps<=6,'movement size outside 1..6');
  const p=current(s);
  const options=enumerateRoutes(c.nodes,p.node,p.previousNode,steps,
    fromOrigin || Boolean(c.cityByNode[p.node])).routes;
  assert(options.length>0,'no route on graph');
  s.pending={kind:'route',source:kind,steps,routes:options,fromOrigin};
  s.phase='route';
}
function finishMovement(s,c){
  const node=c.nodes[current(s).node];
  if(node.type==='event'){
    const deckName=node.event_deck;
    assert(deckName==='land'||deckName==='sea',`invalid event deck on node: ${node.id}`);
    const deck=s.decks[deckName];
    if(!deck.draw.length){
      assert(deck.discard.length,'empty deck and discard');
      deck.draw=shuffle(s,deck.discard);deck.discard=[];
      eventLog(s,'deck_reshuffled',{deck:deckName});
    }
    const eventId=deck.draw.pop();
    // Card is returned to discard after its immediate actions have been selected;
    // no second card can be drawn until those actions resolve or movement completes.
    const event=c.events[eventId];
    assert(event && event.deck===deckName,'invalid card deck');
    eventLog(s,'event_drawn',{eventId,deck:deckName,node:node.id});
    deck.discard.push(eventId);
    if(event.action_mode==='mandatory') applyActions(s,c,event.actions,eventId);
    else {
      s.phase='event_choice';
      s.pending={kind:'event_choice',eventId};
    }
  } else endSlot(s);
}
function applyActions(s,c,actions,eventId){
  for(let i=0;i<actions.length;i++) {
    const a=actions[i],p=current(s);
    switch(a.op){
      case 'skip_turns': p.skips+=a.amount;eventLog(s,'skip_added',{amount:a.amount,eventId});break;
      case 'lose_points':lose(s,p,a.amount,eventId);break;
      case 'gain_points':gain(s,p,a.amount,eventId);break;
      case 'pay_points':
        assert(p.score>=a.amount,`cannot pay ${a.amount}`);
        lose(s,p,a.amount,eventId,'spent');break;
      case 'extra_turn': s.extraTurns+=a.amount;eventLog(s,'extra_turn_awarded',{amount:a.amount});break;
      case 'move_forward':
        assert(i===actions.length-1,'movement must be last action');
        prepareRoute(s,c,a.amount,'event_forward');return;
      case 'move_backward': {
        assert(i===actions.length-1,'movement must be last action');
        const remainder=recordBacktrack(s,c,a.amount);
        if(remainder>0)prepareRoute(s,c,remainder,'event_backward_from_origin',true);
        else finishMovement(s,c);
        return;
      }
      case 'teleport_city':
        assert(i===actions.length-1,'movement must be last action');
        s.phase='destination';s.pending={kind:'destination',source:'teleport',eventId,
          options:Object.values(c.cities).map(x=>x.node_id).sort()};return;
      case 'move_nearest_city': {
        assert(i===actions.length-1,'movement must be last action');
        const options=nearestCities(c.nodes,p.node,c.cityByNode);
        assert(options.length>0,'no reachable city');
        s.phase='destination';s.pending={kind:'destination',source:'nearest_city',eventId,options};return;
      }
      default:throw new Error(`unknown operation ${a.op}`);
    }
  }
  finishOnlyNoEvent(s);
}
function finishOnlyNoEvent(s){endSlot(s);}

function command(game,c,cmd) {
  assert(game.phase!=='finished','game finished');
  const s=structuredClone(game);
  switch(cmd.type){
    case 'roll':{
      assert(s.phase==='roll','not waiting for dice');
      const value=rollD6(s);
      assert(Number.isInteger(value)&&value>=1&&value<=6,'invalid dice');
      s.lastRoll=value;current(s).throws++;
      eventLog(s,'dice',{value});
      prepareRoute(s,c,value,'dice');
      return s;
    }
    case 'chooseRoute':{
      assert(s.phase==='route','not waiting for route');
      assert(verifySelectedPath(s.pending.routes,cmd.path),'route not allowed');
      const origin=s.pending.source;
      recordWalk(s,c,cmd.path);
      eventLog(s,'movement_finished',{origin,endpoint:current(s).node});
      finishMovement(s,c);
      return s;
    }
    case 'chooseChoice':{
      assert(s.phase==='event_choice','not waiting for choice');
      const event=c.events[s.pending.eventId];
      const option=event.choices.find(o=>o.id===cmd.choiceId);
      assert(option,`unknown choice ${cmd.choiceId}`);
      assert(current(s).score >= (option.required_points||0),'insufficient score');
      eventLog(s,'event_choice',{eventId:event.id,choiceId:cmd.choiceId});
      applyActions(s,c,option.actions,event.id);
      return s;
    }
    case 'chooseDestination':{
      assert(s.phase==='destination','not waiting for destination');
      assert(s.pending.options.includes(cmd.nodeId),'destination not allowed');
      const destination=s.pending, p=current(s),from=p.node;
      if(destination.source==='teleport'){
        p.node=cmd.nodeId;p.previousNode=null;
        p.history=[cmd.nodeId]; // New continuous-travel anchor: portals are not physical edges.
        eventLog(s,'teleport',{from,to:cmd.nodeId});
        arriveAtNode(s,c,cmd.nodeId);
      }else {
        const path=shortestPath(c.nodes,p.node,cmd.nodeId);
        assert(path,'nearest-city route missing');
        recordWalk(s,c,path);
        eventLog(s,'nearest_city',{from,to:cmd.nodeId,path});
      }
      // All event destinations are cities, so no new event card can be drawn here.
      endSlot(s);
      return s;
    }
    default:throw new Error(`unknown command ${cmd.type}`);
  }
}

/** Read-only capabilities for future UI and (stage 5) bot controllers. */
function possibleActions(s,c){
  if(s.phase==='finished')return {phase:'finished',results:s.results};
  if(s.phase==='roll')return {phase:'roll',heroId:s.order[s.turnIndex],day:s.day};
  if(s.phase==='route')return {phase:'route',heroId:s.order[s.turnIndex],day:s.day,
    routes:s.pending.routes.map(x=>[...x]),steps:s.pending.steps,source:s.pending.source};
  if(s.phase==='destination')return {phase:'destination',heroId:s.order[s.turnIndex],
    options:[...s.pending.options],source:s.pending.source};
  const event=c.events[s.pending.eventId];
  return {phase:'event_choice',heroId:s.order[s.turnIndex],eventId:event.id,
    choices:event.choices.map(o=>({id:o.id,available:current(s).score>=(o.required_points||0)}))};
}

export { assert, eventLog, current, enterOnce, createGame, gain, lose, grantState, captureStateEvenAfterNativeVisit, checkCollection, arriveAtNode, recordWalk, recordBacktrack, endSlot, consumeSkippedSlots, rankPlayers, prepareRoute, finishMovement, applyActions, finishOnlyNoEvent, command, possibleActions };
