

/* app/route-list.js */
/** Rank every permissible path by its own projected rewards, not the first path to its endpoint. */
function rankedRoutes(routes,estimate){
 return routes.map((path,index)=>({index,end:path.at(-1),points:estimate(path)}))
   .sort((a,b)=>b.points-a.points || a.index-b.index);
}
/** Keep a map-selected path visible in the paginated chooser. */
function pageForRoute(choices,index,pageSize=12){
 if(!Number.isInteger(pageSize)||pageSize<1)throw Error('Invalid route page size');
 const rank=choices.findIndex(c=>c.index===index);
 return rank<0?0:Math.floor(rank/pageSize);
}

export { rankedRoutes, pageForRoute };
