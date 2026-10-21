

/* src/catalog.js */
/** Pure, browser-safe catalog builder. Caller supplies already-loaded JSON objects. */
function buildCatalog(data,map) {
  const byId=list=>Object.fromEntries(list.map(x=>[x.id,x]));
  return {
    data,map,heroes:byId(data.heroes),cities:byId(data.cities),
    states:byId(data.states),controls:byId(data.territory_controls),
    nodes:byId(map.nodes),events:byId([...data.events.land,...data.events.sea]),
    cityByNode:Object.fromEntries(data.cities.map(c=>[c.node_id,c])),
    controlByNode:Object.fromEntries(data.territory_controls.map(c=>[c.node_id,c]))
  };
}

export { buildCatalog };
