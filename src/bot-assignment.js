

/* src/bot-assignment.js */
/** Assign skills fairly, independently of the heroes' alphabetical turn order.
 * For 3+ bots every skill appears and counts differ by at most one.
 */
const BOT_STYLES=Object.freeze({
  random:{label:'Новичок',description:'Случайный выбор маршрутов'},
  basic:{label:'Опытный',description:'Оценка ближайших наград'},
  lookahead:{label:'Мастер',description:'Планирование следующих целей'}
});
function assignBotStyles(ids,random=Math.random){
  if(!Array.isArray(ids)||ids.length<1||ids.length>7 || new Set(ids).size!==ids.length)throw Error('Expected 1–7 unique bot hero IDs');
  const styles=Object.keys(BOT_STYLES);
  const draw=items=>{const a=[...items];for(let i=a.length-1;i>0;i--){const r=random();if(!Number.isFinite(r)||r<0||r>=1)throw Error('Invalid random sample');const j=Math.floor(r*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const slots=ids.length<=2?draw(styles).slice(0,ids.length):draw(Array.from({length:ids.length},(_,i)=>styles[i%3]));
  return Object.fromEntries(ids.map((id,i)=>[id,slots[i]]));
}

/** Optional preset. The mixed preset preserves fair randomized assignments. */
function assignBotStylesForMode(ids,mode='mixed',random=Math.random){
  if(mode==='mixed')return assignBotStyles(ids,random);
  const fixed={easy:'random',normal:'basic',hard:'lookahead'}[mode];
  if(!fixed)throw Error('Unknown bot difficulty mode');
  if(!Array.isArray(ids)||ids.length<1||ids.length>7||new Set(ids).size!==ids.length)throw Error('Expected 1–7 unique bot hero IDs');
  return Object.fromEntries(ids.map(id=>[id,fixed]));
}

export { BOT_STYLES, assignBotStyles, assignBotStylesForMode };
