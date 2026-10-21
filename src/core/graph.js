

/* src/graph.js */
const same = (a,b) => a.length === b.length && a.every((x,i)=>x===b[i]);

/** Unrestricted topological BFS, used by the nearest-city card. */
function shortestPath(nodes, from, to) {
  if (from === to) return [from];
  const queue = [from], parent = new Map([[from,null]]);
  for (let i=0;i<queue.length;i++) {
    const u=queue[i];
    for (const v of nodes[u].neighbors) {
      if (parent.has(v)) continue;
      parent.set(v,u);
      if (v===to) { const path=[to];let p=u;while(p!==null){path.push(p);p=parent.get(p);}return path.reverse(); }
      queue.push(v);
    }
  }
  return null;
}

function nearestCities(nodes, from, cityByNode) {
  let min=Infinity, best=[];
  for (const cityNode of Object.keys(cityByNode)) {
    if (cityNode===from) continue;
    const p=shortestPath(nodes,from,cityNode);
    if (!p) continue;
    const distance=p.length-1;
    if (distance<min) {min=distance;best=[cityNode];}
    else if (distance===min) best.push(cityNode);
  }
  return best.sort();
}

/** No immediate U-turn on a continuous movement, except when starting on a city.
 * If a full-length route cannot exist without a U-turn, allow one as a last resort.
 * Intermediate city crossings do NOT grant a U-turn.
 */
function enumerateRoutes(nodes, start, previous, steps, startingCity = false, opts={}) {
  if (!Number.isInteger(steps) || steps<1 || steps>6) throw new Error('steps outside 1..6');
  const limit=opts.limit??15000;
  const collect=(allowFallback)=>{
    const routes=[], path=[start];
    function visit(cur,prev,remaining) {
      if (routes.length>limit) throw new Error('too many routes');
      if (remaining===0) {routes.push([...path]);return;}
      for (const next of nodes[cur].neighbors) {
        const isBack=next===prev;
        if (isBack && !allowFallback && !(path.length===1 && startingCity)) continue;
        path.push(next);visit(next,cur,remaining-1);path.pop();
      }
    }
    visit(start,previous,steps);
    return routes;
  };
  const direct=collect(false);
  if (direct.length) return {routes:direct, fallbackReverse:false};
  return {routes:collect(true),fallbackReverse:true};
}

function verifySelectedPath(options,path) {
  return Array.isArray(path) && options.some(p=>same(p,path));
}

export { same, shortestPath, nearestCities, enumerateRoutes, verifySelectedPath };
