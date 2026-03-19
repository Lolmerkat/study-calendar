/**
 * Checks whether a parallel group overlaps with any static LV across all modules.
 * @param {Object} pg - Parallel group with `day`, `startTime`, `endTime`
 * @returns {boolean} True if blocked by at least one static LV
 */
function isBlockedByStatic(pg) {
  const pgStart = timeToMins(pg.startTime);
  const pgEnd = timeToMins(pg.endTime);
  for (const mod of modules) {
    for (const lv of mod.lvs) {
      if (lv.type !== "static") continue;
      if (lv.day !== pg.day) continue;
      const s = timeToMins(lv.startTime),
        e = timeToMins(lv.endTime);
      if (pgStart < e && pgEnd > s) return true;
    }
  }
  return false;
}

/**
 * Checks whether a parallel group conflicts with any other selected group
 * or static LV, excluding itself.
 * @param {Object} pg - Parallel group to test
 * @param {string} skipModId - Module ID to skip (own module)
 * @param {string} skipLvId - LV ID to skip (own LV)
 * @param {string} skipPgId - Group ID to skip (self)
 * @returns {{has: boolean, with?: string}} Conflict result with a label when found
 */
function checkConflict(pg, skipModId, skipLvId, skipPgId) {
  const pgStart = timeToMins(pg.startTime);
  const pgEnd = timeToMins(pg.endTime);
  for (const mod of modules) {
    for (const lv of mod.lvs) {
      if (lv.type === "static") {
        if (lv.day !== pg.day) continue;
        const s = timeToMins(lv.startTime),
          e = timeToMins(lv.endTime);
        if (pgStart < e && pgEnd > s)
          return { has: true, with: mod.name + " (" + lv.name + ")" };
      } else {
        for (const g of lv.groups) {
          if (mod.id === skipModId && lv.id === skipLvId && g.id === skipPgId)
            continue;
          if (!g.selected) continue;
          if (g.day !== pg.day) continue;
          const s = timeToMins(g.startTime),
            e = timeToMins(g.endTime);
          if (pgStart < e && pgEnd > s)
            return { has: true, with: mod.name + " (" + g.name + ")" };
        }
      }
    }
  }
  return { has: false };
}

/**
 * Assigns column indices to overlapping events for side-by-side rendering.
 * Uses a greedy column-packing algorithm.
 * @param {Object[]} evts - Array of calendar event objects with `start`/`end` times
 * @returns {Array<{evt: Object, col: number, cols: number}>} Events with layout info
 */
function resolveOverlaps(evts) {
  const sorted = [...evts].sort(
    (a, b) => timeToMins(a.start) - timeToMins(b.start),
  );
  const placed = [];
  const colEnds = [];
  sorted.forEach((evt) => {
    const start = timeToMins(evt.start);
    const end = timeToMins(evt.end);
    let assignedCol = colEnds.findIndex((e) => e <= start);
    if (assignedCol === -1) {
      assignedCol = colEnds.length;
      colEnds.push(end);
    } else colEnds[assignedCol] = end;
    placed.push({ evt, col: assignedCol, cols: 0 });
  });
  placed.forEach((p, i) => {
    const start = timeToMins(p.evt.start);
    const end = timeToMins(p.evt.end);
    let maxCol = p.col;
    placed.forEach((q, j) => {
      if (i === j) return;
      const qs = timeToMins(q.evt.start),
        qe = timeToMins(q.evt.end);
      if (start < qe && end > qs) maxCol = Math.max(maxCol, q.col);
    });
    p.cols = maxCol + 1;
  });
  return placed;
}
