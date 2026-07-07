'use strict';
/* ============================================================================
 * AS THE DROPLETS FALL — world.js
 * WorldGenerator / Chunk — infinite recyclable roadside scenery. Deterministic
 * per-chunk PRNG means chunks regenerate identically forever without needing
 * to be kept in memory permanently.
 *
 * Puddles now carry `resolved` / `cleared` flags that PuddleSystem mutates in
 * place (via the `_src` back-reference handed out in collectVisible) so a
 * puddle is only ever scored once, even though it's re-flattened into a new
 * plain object every frame.
 *
 * The ambient "life" pool has been narrowed to just quiet, stationary detail
 * (a litter bag) — no birds, no cats. The empty, hushed street is part of
 * the mood; scattering little creatures around would undercut it.
 * ==========================================================================*/
window.ER = window.ER || {};

ER.CHUNK_WIDTH = 900;

const RIGHT_TYPES = [
  { type: 'house', weight: 3 },
  { type: 'tree', weight: 3 },
  { type: 'bush', weight: 3 },
  { type: 'fenceRun', weight: 2 },
  { type: 'mailbox', weight: 1 },
  { type: 'vending', weight: 1 },
  { type: 'bicycle', weight: 1 },
  { type: 'lampRight', weight: 1 },
];
const LEFT_TYPES = [
  { type: 'mirror', weight: 1 },
  { type: 'sign', weight: 1 },
  { type: 'lampLeft', weight: 1 },
  { type: 'none', weight: 3 },
];

function weightedPick(rng, table) {
  const total = table.reduce((s, t) => s + t.weight, 0);
  let r = rng() * total;
  for (const t of table) { if ((r -= t.weight) <= 0) return t.type; }
  return table[table.length - 1].type;
}

ER.WorldGenerator = class WorldGenerator {
  constructor() {
    this.chunks = new Map();
  }

  _generateChunk(index) {
    const rng = ER.Util.mulberry32(index * 7919 + 13);
    const objects = [];

    const rightCount = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < rightCount; i++) {
      objects.push({
        side: 1,
        type: weightedPick(rng, RIGHT_TYPES),
        localX: rng() * ER.CHUNK_WIDTH,
        scale: 0.8 + rng() * 0.5,
        seed: rng(),
      });
    }
    const leftCount = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < leftCount; i++) {
      const type = weightedPick(rng, LEFT_TYPES);
      if (type === 'none') continue;
      objects.push({ side: -1, type, localX: rng() * ER.CHUNK_WIDTH, scale: 0.9 + rng() * 0.3, seed: rng() });
    }
    objects.sort((a, b) => a.localX - b.localX);

    const puddles = [];
    const puddleCount = rng() < 0.6 ? 1 : rng() < 0.85 ? 2 : 0;
    for (let i = 0; i < puddleCount; i++) {
      puddles.push({
        localX: 60 + rng() * (ER.CHUNK_WIDTH - 120),
        width: 34 + rng() * 46,
        depth: 0.5 + rng() * 0.5,
        seed: rng(),
        resolved: false, // becomes true once the player has crossed it (jumped or missed)
        cleared: false,  // true only if it was actually jumped
      });
    }

    // Rare, quiet ambient detail — kept deliberately sparse.
    const ambientRoll = rng();
    const ambient = ambientRoll < 0.07
      ? { type: 'litterBag', localX: rng() * ER.CHUNK_WIDTH }
      : null;

    return { index, objects, puddles, ambient };
  }

  getChunk(index) {
    let c = this.chunks.get(index);
    if (!c) { c = this._generateChunk(index); this.chunks.set(index, c); }
    return c;
  }

  /** Ensure chunks covering [minX, maxX] exist; prune far-away ones to bound memory. */
  ensureRange(minX, maxX) {
    const first = Math.floor(minX / ER.CHUNK_WIDTH) - 1;
    const last = Math.floor(maxX / ER.CHUNK_WIDTH) + 1;
    for (let i = first; i <= last; i++) this.getChunk(i);
    for (const key of this.chunks.keys()) {
      if (key < first - 3 || key > last + 3) this.chunks.delete(key);
    }
  }

  /** Flatten visible objects/puddles into world-space coordinates. */
  collectVisible(minX, maxX) {
    const first = Math.floor(minX / ER.CHUNK_WIDTH);
    const last = Math.floor(maxX / ER.CHUNK_WIDTH);
    const objects = [];
    const puddles = [];
    const ambientEvents = [];
    for (let i = first; i <= last; i++) {
      const c = this.getChunk(i);
      const base = i * ER.CHUNK_WIDTH;
      for (const o of c.objects) objects.push({ ...o, worldX: base + o.localX });
      for (const p of c.puddles) puddles.push({ ...p, worldX: base + p.localX, _src: p });
      if (c.ambient) ambientEvents.push({ ...c.ambient, worldX: base + c.ambient.localX, chunkIndex: i });
    }
    return { objects, puddles, ambientEvents };
  }
};
