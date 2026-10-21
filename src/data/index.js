import { OFFLINE_ASSETS } from '../assets.js';
import { OFFLINE_GAME_DATA } from './game.js';
import { OFFLINE_MAP_DATA } from './map.js';
import { OFFLINE_GUIDE_DATA } from './guide.js';
for (const entry of Object.values(OFFLINE_GUIDE_DATA.cities)) entry.image=OFFLINE_ASSETS.guide[entry.image];
for (const entry of Object.values(OFFLINE_GUIDE_DATA.states)) entry.image=OFFLINE_ASSETS.guide[entry.image];
export { OFFLINE_GAME_DATA, OFFLINE_MAP_DATA, OFFLINE_GUIDE_DATA };
