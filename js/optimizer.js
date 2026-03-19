/**
 * Optimizer criteria definitions with labels, icons, descriptions, and sub-options.
 * @type {Array<{id: string, label: string, icon: string, desc: string, options?: Array<{val: string, text: string}>}>}
 */
const OPTIMIZER_CRITERIA = [
  {
    id: "freeDays",
    label: "Meiste freie Tage",
    icon: "📅",
    desc: "Tage ohne VL (HÜ/GÜ zählen als frei)",
  },
  {
    id: "leastGaps",
    label: "Wenigste Leerzeit",
    icon: "⏱️",
    desc: "Lücken zwischen Veranstaltungen minimieren",
  },
  {
    id: "startOfDay",
    label: "Tagesbeginn",
    icon: "🌅",
    desc: "Wann der Tag beginnen soll",
    options: [
      { val: "late", text: "Spät (Ausschlafen)" },
      { val: "early", text: "Früh" },
    ],
  },
  {
    id: "endOfDay",
    label: "Tagesende",
    icon: "🌙",
    desc: "Wann der Tag enden soll",
    options: [
      { val: "early", text: "Früh (Feierabend)" },
      { val: "late", text: "Spät" },
    ],
  },
];

/** @type {Array<{id: string, enabled: boolean, option?: string|null}>} */
let optimizerPriorities = OPTIMIZER_CRITERIA.map((c) => ({
  id: c.id,
  enabled: true,
  option: c.options ? c.options[0].val : null,
}));

/** @type {Object|null} Most recent optimizer result */
let optimizerResult = null;

/**
 * Loads optimizer priority order and options from localStorage.
 * Handles migration from older data formats.
 */
function loadOptimizerPriorities() {
  try {
    const raw = localStorage.getItem("stundenplaner_optprio");
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length === 4) {
        if (typeof arr[0] === "string") {
          optimizerPriorities = arr.map((id) => ({ id, enabled: true }));
        } else {
          optimizerPriorities = arr;
        }

        optimizerPriorities = optimizerPriorities.map((p) => {
          if (p.id === "latestStart") {
            p.id = "startOfDay";
            p.option = "late";
          }
          if (p.id === "earliestEnd") {
            p.id = "endOfDay";
            p.option = "early";
          }
          if (p.id === "startOfDay" && !p.option) p.option = "late";
          if (p.id === "endOfDay" && !p.option) p.option = "early";
          return p;
        });
      }
    }
  } catch (e) {}
}

/**
 * Persists the optimizer priority order and options to localStorage.
 */
function saveOptimizerPriorities() {
  localStorage.setItem(
    "stundenplaner_optprio",
    JSON.stringify(optimizerPriorities),
  );
}

/**
 * Toggles the enabled state of an optimizer criterion.
 * @param {string} id - Criterion ID
 */
function togglePriority(id) {
  const p = optimizerPriorities.find((p) => p.id === id);
  if (p) {
    p.enabled = !p.enabled;
    saveOptimizerPriorities();
    renderPriorityList();
  }
}

/**
 * Changes the sub-option for an optimizer criterion (e.g. early/late).
 * @param {string} id - Criterion ID
 * @param {string} val - New option value
 */
function changePriorityOption(id, val) {
  const p = optimizerPriorities.find((p) => p.id === id);
  if (p) {
    p.option = val;
    saveOptimizerPriorities();
  }
}

/**
 * Collects all parallel LVs that need a group choice for the optimizer.
 * Filters out groups blocked by static LVs.
 * @returns {Array<{modId: string, modName: string, lvId: string, lvName: string, groups: Object[]}>}
 */
function getParallelChoices() {
  const choices = [];
  for (const mod of modules) {
    for (const lv of mod.lvs) {
      if (lv.type !== "parallel" || lv.groups.length === 0) continue;
      const validGroups = lv.groups
        .filter((g) => !isBlockedByStatic(g))
        .map((g) => ({ ...g, modName: mod.name }));
      if (validGroups.length === 0) continue;
      choices.push({
        modId: mod.id,
        modName: mod.name,
        lvId: lv.id,
        lvName: lv.name,
        groups: validGroups,
      });
    }
  }
  return choices;
}

/**
 * Generates all conflict-free group combinations via recursive backtracking.
 * Prunes branches early when a conflict is detected.
 * @param {Object[]} choices - Parallel choice sets from getParallelChoices()
 * @returns {Array<Object[]>} Array of valid group combinations
 */
function generateCombinations(choices) {
  if (choices.length === 0) return [[]];
  const results = [];
  const maxCombos = 50000;

  function recurse(idx, current) {
    if (results.length >= maxCombos) return;
    if (idx === choices.length) {
      results.push([...current]);
      return;
    }
    for (const group of choices[idx].groups) {
      let hasConflict = false;
      for (const chosen of current) {
        if (chosen.day !== group.day) continue;
        const s1 = timeToMins(chosen.startTime),
          e1 = timeToMins(chosen.endTime);
        const s2 = timeToMins(group.startTime),
          e2 = timeToMins(group.endTime);
        if (s1 < e2 && s2 < e1) {
          hasConflict = true;
          break;
        }
      }
      if (hasConflict) continue;
      current.push(group);
      recurse(idx + 1, current);
      current.pop();
    }
  }
  recurse(0, []);
  return results;
}

/**
 * Collects all static (fixed-time) LV events across all modules.
 * @returns {Array<{day: string, startTime: string, endTime: string, name: string, modName: string}>}
 */
function getStaticEvents() {
  const events = [];
  for (const mod of modules) {
    for (const lv of mod.lvs) {
      if (lv.type !== "static") continue;
      events.push({
        day: lv.day,
        startTime: lv.startTime,
        endTime: lv.endTime,
        name: lv.name,
        modName: mod.name,
      });
    }
  }
  return events;
}

/**
 * Scores a single group combination against all optimizer criteria.
 * @param {Object[]} combo - Array of selected parallel groups
 * @returns {{freeDays: number, totalGaps: number, avgStart: number, avgEnd: number, daySchedule: Object}}
 */
function scoreCombination(combo) {
  const staticEvents = getStaticEvents();
  const daySchedule = {};
  DAYS.forEach((d) => (daySchedule[d] = []));

  for (const ev of staticEvents) {
    daySchedule[ev.day].push({
      start: timeToMins(ev.startTime),
      end: timeToMins(ev.endTime),
      name: ev.name,
      modName: ev.modName,
    });
  }
  for (const g of combo) {
    daySchedule[g.day].push({
      start: timeToMins(g.startTime),
      end: timeToMins(g.endTime),
      name: g.name,
      modName: g.modName || "",
    });
  }

  for (const d of DAYS) {
    daySchedule[d].sort((a, b) => a.start - b.start);
  }

  const moduleDays = {};
  for (const d of DAYS) {
    const modsOnDay = new Set(
      daySchedule[d].filter((ev) => ev.modName).map((ev) => ev.modName),
    );
    for (const m of modsOnDay) {
      moduleDays[m] = (moduleDays[m] || 0) + 1;
    }
  }

  let freeDays = 0;
  for (const d of DAYS) {
    const vls = daySchedule[d].filter((ev) => !isOptionalLv(ev.name));
    if (vls.length === 0) {
      freeDays++;
    } else if (vls.length === 1) {
      const vl = vls[0];
      const duration = vl.end - vl.start;
      const occursMultipleTimes = vl.modName && moduleDays[vl.modName] > 1;
      if (duration <= 45 && occursMultipleTimes) {
        freeDays++;
      }
    }
  }

  let totalGaps = 0;
  for (const d of DAYS) {
    const evts = daySchedule[d];
    if (evts.length < 2) continue;
    for (let i = 1; i < evts.length; i++) {
      const gap = evts[i].start - evts[i - 1].end;
      if (gap > 0) totalGaps += gap;
    }
  }

  let startSum = 0;
  let activeDays = 0;
  for (const d of DAYS) {
    if (daySchedule[d].length === 0) continue;
    startSum += daySchedule[d][0].start;
    activeDays++;
  }
  const avgStart = activeDays > 0 ? startSum / activeDays : 24 * 60;

  let endSum = 0;
  let endDays = 0;
  for (const d of DAYS) {
    if (daySchedule[d].length === 0) continue;
    endSum += daySchedule[d][daySchedule[d].length - 1].end;
    endDays++;
  }
  const avgEnd = endDays > 0 ? endSum / endDays : 0;

  return { freeDays, totalGaps, avgStart, avgEnd, daySchedule };
}

/**
 * Runs the full schedule optimisation: generates combinations, scores them,
 * ranks by weighted criteria, and returns top results with a swapped-priority variant.
 * @returns {{best?: Object, topResults?: Object[], totalCombinations?: number, validCombinations?: number, choices?: Object[], error?: string}}
 */
function optimizePlan() {
  const choices = getParallelChoices();
  if (choices.length === 0) {
    return { error: "Keine Parallelgruppen zum Optimieren vorhanden." };
  }

  const totalPossible = choices.reduce((acc, c) => acc * c.groups.length, 1);
  const combos = generateCombinations(choices);

  if (combos.length === 0) {
    return { error: "Keine konfliktfreien Kombinationen gefunden." };
  }

  const scored = combos.map((combo) => ({
    combo,
    score: scoreCombination(combo),
  }));

  let maxFreeDays = 0;
  let maxGaps = 0;
  let minStart = Infinity,
    maxStart = 0;
  let minEnd = Infinity,
    maxEnd = 0;

  for (const s of scored) {
    if (s.score.freeDays > maxFreeDays) maxFreeDays = s.score.freeDays;
    if (s.score.totalGaps > maxGaps) maxGaps = s.score.totalGaps;
    if (s.score.avgStart < minStart) minStart = s.score.avgStart;
    if (s.score.avgStart > maxStart) maxStart = s.score.avgStart;
    if (s.score.avgEnd < minEnd) minEnd = s.score.avgEnd;
    if (s.score.avgEnd > maxEnd) maxEnd = s.score.avgEnd;
  }

  const enabledPrios = optimizerPriorities.filter((p) => p.enabled);
  const canSwap = enabledPrios.length >= 2;

  scored.forEach((s) => {
    let totalScore = 0;
    let swappedScore = 0;

    optimizerPriorities.forEach((critObj, idx) => {
      if (!critObj.enabled) return;
      const weight = Math.pow(2, optimizerPriorities.length - idx);

      let swappedWeight = weight;
      if (canSwap) {
        if (critObj.id === enabledPrios[0].id) {
          const secondIdx = optimizerPriorities.indexOf(enabledPrios[1]);
          swappedWeight = Math.pow(
            2,
            optimizerPriorities.length - secondIdx,
          );
        } else if (critObj.id === enabledPrios[1].id) {
          const firstIdx = optimizerPriorities.indexOf(enabledPrios[0]);
          swappedWeight = Math.pow(
            2,
            optimizerPriorities.length - firstIdx,
          );
        }
      }

      let norm = 0;
      switch (critObj.id) {
        case "freeDays":
          norm = maxFreeDays > 0 ? s.score.freeDays / maxFreeDays : 0;
          break;
        case "leastGaps":
          norm = maxGaps > 0 ? 1 - s.score.totalGaps / maxGaps : 1;
          break;
        case "startOfDay":
          if (critObj.option === "late") {
            norm =
              maxStart > minStart
                ? (s.score.avgStart - minStart) / (maxStart - minStart)
                : 1;
          } else {
            norm =
              maxStart > minStart
                ? 1 -
                  (s.score.avgStart - minStart) / (maxStart - minStart)
                : 1;
          }
          break;
        case "endOfDay":
          if (critObj.option === "early") {
            norm =
              maxEnd > minEnd
                ? 1 - (s.score.avgEnd - minEnd) / (maxEnd - minEnd)
                : 1;
          } else {
            norm =
              maxEnd > minEnd
                ? (s.score.avgEnd - minEnd) / (maxEnd - minEnd)
                : 1;
          }
          break;
      }
      totalScore += norm * weight;
      swappedScore += norm * swappedWeight;
    });
    s.totalWeightedScore = totalScore;
    s.swappedScore = swappedScore;
  });

  scored.sort((a, b) => b.totalWeightedScore - a.totalWeightedScore);

  const topResults = scored.slice(0, 3);

  if (canSwap) {
    const bestNormal = scored[0];
    const sortedBySwapped = [...scored].sort(
      (a, b) => b.swappedScore - a.swappedScore,
    );
    const bestSwapped = sortedBySwapped.find(
      (s) => s.combo !== bestNormal.combo,
    );

    if (bestSwapped) {
      const getLabel = (critObj) => {
        const c = OPTIMIZER_CRITERIA.find((c) => c.id === critObj.id);
        if (!c || !c.options) return c?.label;
        const opt = c.options.find((o) => o.val === critObj.option);
        return `${c.label} (${opt ? opt.text : ""})`;
      };
      const label1 = getLabel(enabledPrios[0]);
      const label2 = getLabel(enabledPrios[1]);
      const variantEntry = {
        ...bestSwapped,
        isSwappedVariant: true,
        swappedLabels: [label2, label1],
      };

      topResults.splice(1, 0, variantEntry);
      if (topResults.length > 4) topResults.length = 4;
    }
  }

  return {
    best: scored[0],
    topResults,
    totalCombinations: totalPossible,
    validCombinations: combos.length,
    choices,
  };
}

/**
 * Applies a winning combination by selecting those groups and deselecting all others.
 * @param {Object[]} combo - Array of group objects to select
 */
function applyOptimalPlan(combo) {
  for (const mod of modules) {
    for (const lv of mod.lvs) {
      if (lv.type !== "parallel") continue;
      for (const g of lv.groups) g.selected = false;
    }
  }
  for (const g of combo) {
    for (const mod of modules) {
      for (const lv of mod.lvs) {
        if (lv.type !== "parallel") continue;
        const match = lv.groups.find((pg) => pg.id === g.id);
        if (match) match.selected = true;
      }
    }
  }
  save();
  render();
}

/**
 * Opens the optimizer modal, resets state, and renders the priority list.
 */
function openOptimizerModal() {
  loadOptimizerPriorities();
  optimizerResult = null;
  renderPriorityList();
  document.getElementById("optimizerResults").innerHTML = "";
  document.getElementById("optimizerResults").style.display = "none";
  document.getElementById("btnApplyOptimal").style.display = "none";
  openModal("modalOptimize");
}

/**
 * Renders the drag-and-drop priority list inside the optimizer modal.
 */
function renderPriorityList() {
  const list = document.getElementById("priorityList");
  list.innerHTML = "";
  optimizerPriorities.forEach((critObj, idx) => {
    const critId = critObj.id;
    const crit = OPTIMIZER_CRITERIA.find((c) => c.id === critId);
    if (!crit) return;
    const item = document.createElement("div");
    item.className = "priority-item" + (critObj.enabled ? "" : " disabled");
    item.draggable = true;
    item.dataset.critId = critId;
    item.innerHTML = `
      <div class="priority-handle">⠿</div>
      <div class="priority-rank">${idx + 1}</div>
      <div class="priority-icon">${crit.icon}</div>
      <div class="priority-info">
        <div class="priority-label">${crit.label}</div>
        <div class="priority-desc">${crit.desc}</div>
        ${
          crit.options
            ? `
          <select class="priority-select" onchange="changePriorityOption('${critId}', this.value)" onclick="event.stopPropagation()">
            ${crit.options.map((o) => `<option value="${o.val}" ${critObj.option === o.val ? "selected" : ""}>${o.text}</option>`).join("")}
          </select>
        `
            : ""
        }
      </div>
      <div class="priority-toggle">
        <label class="toggle-switch">
          <input type="checkbox" ${critObj.enabled ? "checked" : ""} onchange="togglePriority('${critId}')">
          <span class="slider"></span>
        </label>
      </div>
    `;

    item.addEventListener("dragstart", (e) => {
      item.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", critId);
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      document
        .querySelectorAll(
          ".priority-item.drag-over-above, .priority-item.drag-over-below",
        )
        .forEach((el) =>
          el.classList.remove("drag-over-above", "drag-over-below"),
        );
    });
    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      item.classList.toggle("drag-over-above", e.clientY < midY);
      item.classList.toggle("drag-over-below", e.clientY >= midY);
    });
    item.addEventListener("dragleave", () => {
      item.classList.remove("drag-over-above", "drag-over-below");
    });
    item.addEventListener("drop", (e) => {
      e.preventDefault();
      item.classList.remove("drag-over-above", "drag-over-below");
      const draggedId = e.dataTransfer.getData("text/plain");
      if (draggedId === critId) return;
      const fromIdx = optimizerPriorities.findIndex(
        (p) => p.id === draggedId,
      );
      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      let toIdx = optimizerPriorities.findIndex((p) => p.id === critId);
      if (e.clientY >= midY) toIdx++;
      const draggedObj = optimizerPriorities.splice(fromIdx, 1)[0];
      if (fromIdx < toIdx) toIdx--;
      optimizerPriorities.splice(toIdx, 0, draggedObj);
      saveOptimizerPriorities();
      renderPriorityList();
    });

    list.appendChild(item);
  });
}

/**
 * Triggers the optimisation computation and renders the result card.
 */
function runOptimizer() {
  const btn = document.getElementById("btnRunOptimizer");
  btn.disabled = true;
  btn.textContent = "Berechne...";

  setTimeout(() => {
    const result = optimizePlan();
    btn.disabled = false;
    btn.textContent = "Berechnen";

    const resultsEl = document.getElementById("optimizerResults");
    resultsEl.style.display = "";

    if (result.error) {
      resultsEl.innerHTML = `<div class="opt-error">${result.error}</div>`;
      document.getElementById("btnApplyOptimal").style.display = "none";
      return;
    }

    optimizerResult = result;
    optimizerResult.currentIdx = 0;
    renderOptimizerResultCard(0);
    document.getElementById("btnApplyOptimal").style.display = "";
  }, 50);
}

/**
 * Renders a single optimizer result card at the given index.
 * @param {number} idx - Index into optimizerResult.topResults
 */
function renderOptimizerResultCard(idx) {
  const result = optimizerResult;
  if (!result || !result.topResults) return;
  const topCount = result.topResults.length;
  const entry = result.topResults[idx];
  const s = entry.score;

  /**
   * Converts total minutes to a "H:MM" display string.
   * @param {number} m - Minutes since midnight
   * @returns {string} Formatted time
   */
  const minsToTime = (m) => {
    const h = Math.floor(m / 60);
    const min = Math.round(m % 60);
    return h + ":" + String(min).padStart(2, "0");
  };

  const resultsEl = document.getElementById("optimizerResults");
  resultsEl.innerHTML = `
    <div class="opt-stats-header">
      <span class="opt-stats-badge">${result.validCombinations} von ${result.totalCombinations}</span>
      konfliktfreie Kombinationen geprüft
    </div>
    ${
      topCount > 1
        ? `
    <div class="opt-nav">
      <button class="btn opt-nav-btn" onclick="navigateOptResult(-1)" ${idx === 0 ? "disabled" : ""}>
        ◀
      </button>
      <span class="opt-nav-label">Ergebnis ${idx + 1} von ${topCount}</span>
      <button class="btn opt-nav-btn" onclick="navigateOptResult(1)" ${idx === topCount - 1 ? "disabled" : ""}>
        ▶
      </button>
    </div>`
        : ""
    }
    ${
      entry.isSwappedVariant
        ? `
    <div class="opt-variant-banner">
      ✨ <strong>Alternative Form:</strong> Priorisiert <em>${entry.swappedLabels[0]}</em> gegenüber <em>${entry.swappedLabels[1]}</em>
    </div>`
        : ""
    }
    <div class="opt-stats-grid">
      <div class="opt-stat">
        <div class="opt-stat-icon">📅</div>
        <div class="opt-stat-value">${s.freeDays}</div>
        <div class="opt-stat-label">Freie Tage</div>
      </div>
      <div class="opt-stat">
        <div class="opt-stat-icon">⏱️</div>
        <div class="opt-stat-value">${s.totalGaps} min</div>
        <div class="opt-stat-label">Leerzeit</div>
      </div>
      <div class="opt-stat">
        <div class="opt-stat-icon">🌅</div>
        <div class="opt-stat-value">${minsToTime(s.avgStart)}</div>
        <div class="opt-stat-label">⌀ Beginn</div>
      </div>
      <div class="opt-stat">
        <div class="opt-stat-icon">🌙</div>
        <div class="opt-stat-value">${minsToTime(s.avgEnd)}</div>
        <div class="opt-stat-label">⌀ Ende</div>
      </div>
    </div>
    <div class="opt-selection-title">Ausgewählte Gruppen:</div>
    <div class="opt-selection-list">
      ${entry.combo
        .map(
          (g) => `
        <div class="opt-selection-item">
          <span class="pg-day-badge">${g.day}</span>
          <span>${g.name}</span>
          <span class="opt-selection-time">${g.startTime}–${g.endTime}</span>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}

/**
 * Navigates to a different optimizer result card.
 * @param {number} delta - Direction to navigate (-1 = previous, 1 = next)
 */
function navigateOptResult(delta) {
  if (!optimizerResult || !optimizerResult.topResults) return;
  const newIdx = optimizerResult.currentIdx + delta;
  if (newIdx < 0 || newIdx >= optimizerResult.topResults.length) return;
  optimizerResult.currentIdx = newIdx;
  renderOptimizerResultCard(newIdx);
}

/**
 * Applies the currently viewed optimizer result and closes the modal.
 */
function applyOptimizerResult() {
  if (!optimizerResult || !optimizerResult.topResults) return;
  const entry = optimizerResult.topResults[optimizerResult.currentIdx];
  applyOptimalPlan(entry.combo);
  closeModal("modalOptimize");
  showToast("Optimaler Stundenplan angewendet ✓", "success");
}
