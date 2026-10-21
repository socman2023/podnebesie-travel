

/* src/rng.js */
/** Reproducible PRNG for tests and fair games. Not cryptographic. */
function nextRandom(seed) {
  const nextSeed = ((seed >>> 0) + 0x6D2B79F5) >>> 0;
  let t = nextSeed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { seed: nextSeed, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}
function rollD6(state) {
  const {seed, value} = nextRandom(state.rngSeed);
  state.rngSeed = seed;
  return 1 + Math.floor(value * 6);
}
function shuffle(state, values) {
  const items = [...values];
  for (let i = items.length - 1; i > 0; i--) {
    const r = nextRandom(state.rngSeed);
    state.rngSeed = r.seed;
    const j = Math.floor(r.value * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export { nextRandom, rollD6, shuffle };
