// ═══════════════════════════════
//   DATA MODEL
// ═══════════════════════════════
// Module[] = {id, name, color, lvs: LV[]}
// LV = {id, name, type:'static'|'parallel',
//   // static: day, startTime, endTime, room
//   // parallel: groups: PG[] }
// PG = {id, name, day, startTime, endTime, room, selected}

const COLORS = [
  "#7c6af7",
  "#c084fc",
  "#34d399",
  "#fbbf24",
  "#60a5fa",
  "#fb923c",
  "#e879f9",
  "#4ade80",
  "#f472b6",
];
const DAYS = ["Mo", "Di", "Mi", "Do", "Fr"];
const DAYS_FULL = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];
const DAY_MAP = {
  mo: "Mo",
  di: "Di",
  mi: "Mi",
  do: "Do",
  fr: "Fr",
  montag: "Mo",
  dienstag: "Di",
  mittwoch: "Mi",
  donnerstag: "Do",
  freitag: "Fr",
  monday: "Mo",
  tuesday: "Di",
  wednesday: "Mi",
  thursday: "Do",
  friday: "Fr",
};

let modules = [];
let filter = "all"; // 'all' | 'available' | 'selected'
let colorMode = "module"; // 'module' | 'type'
let colorIdx = 0;
let pendingImport = null; // {groups: PG[]}
let addingLvToModuleId = null;
let tempLvForms = [];

// Type-based color palette
const TYPE_COLORS = {
  vl:   '#60a5fa', // Vorlesung — blue
  hü:   '#fbbf24', // Hörsaalübung — amber
  gü:   '#34d399', // Gruppenübung — green
  pr:   '#c084fc', // Praktikum — purple
  se:   '#fb923c', // Seminar — orange
  tu:   '#f472b6', // Tutorium — pink
  other:'#9090a8', // Sonstiges — gray
};

function detectLvType(name) {
  if (!name) return 'other';
  const n = name.toLowerCase();
  if (/\bvl\b|vorlesung/.test(n)) return 'vl';
  if (/\bhü\b|hörsaalübung|hoersaaluebung/.test(n)) return 'hü';
  if (/\bgü\b|\[gü\]|gruppenübung|gruppenuebung/.test(n)) return 'gü';
  if (/\bpr\b|\[pr\]|praktikum|labor/.test(n)) return 'pr';
  if (/\bse\b|seminar/.test(n)) return 'se';
  if (/\btu\b|tutorium/.test(n)) return 'tu';
  return 'other';
}

function getEventColor(mod, lvName, pgName) {
  if (colorMode === 'module') return mod.color;
  // type mode: detect from LV name first, fall back to group name
  let t = detectLvType(lvName);
  if (t === 'other' && pgName) t = detectLvType(pgName);
  return TYPE_COLORS[t] || TYPE_COLORS.other;
}

function setColorMode(mode) {
  colorMode = mode;
  document.getElementById('colorModeModule').classList.toggle('active', mode === 'module');
  document.getElementById('colorModeType').classList.toggle('active', mode === 'type');
  save();
  renderCalendar();
}

function nextId() {
  return "_" + Math.random().toString(36).slice(2, 9);
}
function nextColor() {
  return COLORS[colorIdx++ % COLORS.length];
}

// Returns true if pg overlaps with ANY static LV across all modules
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

function nextId() {
  return "_" + Math.random().toString(36).slice(2, 9);
}
function nextColor() {
  return COLORS[colorIdx++ % COLORS.length];
}

// ═══════════════════════════════
//   PERSISTENCE
// ═══════════════════════════════
function save() {
  try {
    localStorage.setItem(
      "stundenplaner_v2",
      JSON.stringify({ modules, colorIdx, filter, colorMode }),
    );
  } catch (e) {}
}
function load() {
  try {
    const raw = localStorage.getItem("stundenplaner_v2");
    if (raw) {
      const d = JSON.parse(raw);
      modules = d.modules || [];
      colorIdx = d.colorIdx || 0;
      if (d.filter) filter = d.filter;
      if (d.colorMode) colorMode = d.colorMode;
    }
  } catch (e) {}
}

// ═══════════════════════════════
//   RENDER SIDEBAR
// ═══════════════════════════════
function renderSidebar() {
  const body = document.getElementById("sidebarBody");
  // Re-query after potential DOM rebuilds; fall back to creating a fresh placeholder
  let empty = document.getElementById("sidebarEmpty");
  if (!empty) {
    empty = document.createElement("div");
    empty.id = "sidebarEmpty";
    empty.style.cssText =
      "padding:24px;flex-direction:column;align-items:center;gap:8px;display:flex";
    empty.innerHTML =
      '<div style="font-size:28px">📚</div><div style="font-size:12px;color:var(--text3);text-align:center">Füge Module hinzu oder importiere eine XHTML-Datei</div>';
  }
  if (modules.length === 0) {
    body.innerHTML = "";
    empty.style.display = "flex";
    body.appendChild(empty);
    return;
  }
  // Remove empty placeholder if it's still in the DOM
  if (empty.parentNode) empty.parentNode.removeChild(empty);
  body.innerHTML = "";
  modules.forEach((mod) => {
    const card = document.createElement("div");
    card.className = "module-card";
    card.id = "module-card-" + mod.id;

    const hasSelected = mod.lvs.some(
      (lv) => lv.type === "parallel" && lv.groups.some((g) => g.selected),
    );
    const headerHtml = `
      <div class="module-header" onclick="toggleModule('${mod.id}')">
        <div class="module-color" style="background:${mod.color}"></div>
        <div class="module-name">${mod.name}</div>
        <div class="module-toggle open" id="toggle-${mod.id}">▶</div>
        <button class="btn danger" style="padding:3px 7px;font-size:11px;margin-left:4px" onclick="event.stopPropagation();removeModule('${mod.id}')">✕</button>
      </div>
    `;

    let lvHtml = "";
    mod.lvs.forEach((lv) => {
      if (lv.type === "static") {
        lvHtml += `
          <div class="lv-item static-lv">
            <div class="lv-label">Fest · ${lv.name}</div>
            <div class="pg-time" style="margin-top:3px">
              <span class="pg-day-badge">${lv.day}</span>
              <span>${lv.startTime}–${lv.endTime}</span>
              ${lv.room ? `<span style="color:var(--text3)">· ${lv.room}</span>` : ""}
            </div>
            <button class="btn danger" style="padding:2px 6px;font-size:10px;margin-top:4px" onclick="removeLv('${mod.id}','${lv.id}')">Entfernen</button>
          </div>`;
      } else {
        // parallel
        let pgHtml = lv.groups
          .map((pg) => {
            const conflict = checkConflict(pg, mod.id, lv.id, pg.id);
            const blocked = isBlockedByStatic(pg);
            return `
            <div class="pg-item ${pg.selected ? "selected" : ""} ${conflict.has ? "conflict-bg" : ""} ${blocked ? "blocked-static" : ""}"
                 onclick="togglePg('${mod.id}','${lv.id}','${pg.id}')">
              <div class="pg-check">
                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                  <path d="M1 3.5L3.5 6L8 1" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div class="pg-info">
                <div class="pg-name">${pg.name}</div>
                <div class="pg-time">
                  <span class="pg-day-badge">${pg.day}</span>
                  <span>${pg.startTime}–${pg.endTime}</span>
                  ${pg.room ? `<span style="color:var(--text3)">· ${pg.room}</span>` : ""}
                </div>
                ${blocked ? `<div class="pg-blocked-label">⛔ Feste LV überschneidet sich</div>` : conflict.has ? `<div class="pg-conflict">⚠ Konflikt mit ${conflict.with}</div>` : ""}
              </div>
            </div>`;
          })
          .join("");

        lvHtml += `
          <div class="lv-item" style="padding:0">
            <div style="padding:6px 10px;display:flex;align-items:center;justify-content:space-between">
              <div>
                <div class="lv-label">${lv.name}</div>
                <div class="lv-type" style="font-size:11px;color:var(--text3)">${lv.groups.length} Parallelgruppen</div>
              </div>
              <button class="btn danger" style="padding:2px 6px;font-size:10px" onclick="removeLv('${mod.id}','${lv.id}')">✕</button>
            </div>
            <div style="border-top:1px solid var(--border);padding:6px;display:flex;flex-direction:column;gap:3px">
              ${pgHtml}
            </div>
          </div>`;
      }
    });

    lvHtml += `
      <button class="btn" style="width:100%;justify-content:center;font-size:11px;margin-top:4px"
        onclick="openAddLvToModule('${mod.id}')">+ LV hinzufügen</button>`;

    card.innerHTML =
      headerHtml +
      `<div class="module-body open" id="body-${mod.id}">${lvHtml}</div>`;
    body.appendChild(card);
  });
}

function toggleModule(id) {
  const body = document.getElementById("body-" + id);
  const toggle = document.getElementById("toggle-" + id);
  const open = body.classList.toggle("open");
  toggle.classList.toggle("open", open);
}

function expandAllModules() {
  modules.forEach(mod => {
    const body = document.getElementById('body-' + mod.id);
    const toggle = document.getElementById('toggle-' + mod.id);
    if (body) body.classList.add('open');
    if (toggle) toggle.classList.add('open');
  });
}

function collapseAllModules() {
  modules.forEach(mod => {
    const body = document.getElementById('body-' + mod.id);
    const toggle = document.getElementById('toggle-' + mod.id);
    if (body) body.classList.remove('open');
    if (toggle) toggle.classList.remove('open');
  });
}

// ═══════════════════════════════
//   CONFLICT DETECTION
// ═══════════════════════════════
function timeToMins(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
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

// ═══════════════════════════════
//   RENDER CALENDAR
// ═══════════════════════════════
const HOUR_START = 8,
  HOUR_END = 19;
const TOTAL_HOURS = HOUR_END - HOUR_START;

function timeToTopPct(t) {
  const mins = timeToMins(t) - HOUR_START * 60;
  return (mins / (TOTAL_HOURS * 60)) * 100;
}
function durationPct(start, end) {
  const mins = timeToMins(end) - timeToMins(start);
  return (mins / (TOTAL_HOURS * 60)) * 100;
}

function renderCalendar() {
  const grid = document.getElementById("weekGrid");
  grid.innerHTML = "";
  const totalPx = TOTAL_HOURS * 64; // slot height

  // Day header row
  const cornerEl = document.createElement("div");
  cornerEl.className = "day-header";
  grid.appendChild(cornerEl);
  DAYS.forEach((d, i) => {
    const el = document.createElement("div");
    el.className = "day-header";
    el.textContent = DAYS_FULL[i];
    grid.appendChild(el);
  });

  // Time gutter
  const gutterEl = document.createElement("div");
  gutterEl.className = "time-gutter";
  gutterEl.style.cssText = `height:${totalPx}px`;
  for (let h = HOUR_START; h < HOUR_END; h++) {
    const lbl = document.createElement("div");
    lbl.className = "time-label";
    lbl.textContent = h + ":00";
    gutterEl.appendChild(lbl);
  }
  grid.appendChild(gutterEl);

  // Collect all events per day
  const eventsByDay = { Mo: [], Di: [], Mi: [], Do: [], Fr: [] };

  modules.forEach((mod) => {
    mod.lvs.forEach((lv) => {
      if (lv.type === "static") {
        if (!eventsByDay[lv.day]) return;
        eventsByDay[lv.day].push({
          kind: "static",
          label: mod.name,
          sub: lv.name,
          start: lv.startTime,
          end: lv.endTime,
          room: lv.room,
          color: getEventColor(mod, lv.name, null),
          modId: mod.id,
          lvId: lv.id,
        });
      } else {
        lv.groups.forEach((pg) => {
          if (!eventsByDay[pg.day]) return;
          const blocked = isBlockedByStatic(pg);
          // Visibility by filter mode
          if (filter === "available" && blocked) return;
          if (filter === "selected" && !pg.selected) return;
          const conflict = checkConflict(pg, mod.id, lv.id, pg.id);
          eventsByDay[pg.day].push({
            kind: "parallel",
            label: mod.name,
            sub: pg.name,
            start: pg.startTime,
            end: pg.endTime,
            room: pg.room,
            color: getEventColor(mod, lv.name, pg.name),
            selected: pg.selected,
            blocked,
            conflict: conflict.has,
            conflictWith: conflict.with,
            modId: mod.id,
            lvId: lv.id,
            pgId: pg.id,
          });
        });
      }
    });
  });

  // Check global conflicts for banner
  const conflicts = [];
  modules.forEach((mod) => {
    mod.lvs.forEach((lv) => {
      if (lv.type === "parallel") {
        lv.groups.forEach((pg) => {
          if (!pg.selected) return;
          const c = checkConflict(pg, mod.id, lv.id, pg.id);
          if (c.has) conflicts.push(pg.name + " ↔ " + c.with);
        });
      }
    });
  });
  const banner = document.getElementById("conflictBanner");
  if (conflicts.length > 0) {
    banner.style.display = "flex";
    document.getElementById("conflictText").textContent =
      "Zeitkonflikte: " + [...new Set(conflicts)].join(", ");
  } else {
    banner.style.display = "none";
  }

  // Render day columns
  DAYS.forEach((day) => {
    const col = document.createElement("div");
    col.className = "day-col";
    col.style.cssText = `position:relative;height:${totalPx}px`;

    // Hour lines
    for (let h = 0; h < TOTAL_HOURS; h++) {
      const line = document.createElement("div");
      line.className = "hour-line";
      col.appendChild(line);
      // half line
      const half = document.createElement("div");
      half.className = "half-line";
      half.style.top = (h + 0.5) * 64 + "px";
      col.appendChild(half);
    }

    // Resolve overlapping events with column layout
    const evts = eventsByDay[day];
    const placed = resolveOverlaps(evts);

    placed.forEach(({ evt, col: evtCol, cols: evtCols }) => {
      const topPct = timeToTopPct(evt.start);
      const hPct = durationPct(evt.start, evt.end);
      const topPx = (topPct / 100) * totalPx;
      const hPx = Math.max((hPct / 100) * totalPx, 22);
      const width = `calc((100% - 6px) / ${evtCols})`;
      const left = `calc(3px + (100% - 6px) / ${evtCols} * ${evtCol})`;

      const el = document.createElement("div");
      el.className =
        "cal-event " +
        (evt.kind === "static" ? "static-event" : "") +
        (evt.conflict ? " conflict-bg" : "") +
        (filter === "all" && evt.kind === "parallel" && !evt.selected
          ? " dimmed"
          : "") +
        (evt.blocked ? " blocked-cal" : "");

      // Color scheme
      const alpha =
        evt.kind === "static" ? "0.9" : evt.selected ? "0.75" : "0.25";
      const borderCol = evt.conflict
        ? "var(--accent4)"
        : evt.kind === "static"
          ? evt.color
          : evt.selected
            ? evt.color
            : "var(--border)";
      el.style.cssText = `
        top:${topPx}px;
        height:${hPx}px;
        width:${width};
        left:${left};
        background:${evt.color}${evt.kind === "static" ? "22" : evt.selected ? "1a" : "0a"};
        border-color:${borderCol};
        border: ${borderCol} ${evt.kind === "static" ? "solid" : "dashed"} 2px;
        border-top: ${evt.kind === "static" ? "4px solid" : "2px dashed"} ${evt.conflict ? "var(--accent4)" : evt.color};
        color:${evt.kind === "static" ? evt.color : evt.selected ? evt.color : "var(--text3)"};
      `;

      const duration = timeToMins(evt.end) - timeToMins(evt.start);
      el.innerHTML = `
        <div class="event-title">${evt.label}</div>
        ${hPx > 32 ? `<div class="event-sub">${evt.sub}</div>` : ""}
        ${hPx > 46 ? `<div class="event-time-tag">${evt.start}–${evt.end}${evt.room ? " · " + evt.room : ""}</div>` : ""}
      `;

      if (evt.kind === "parallel") {
        el.title = `${evt.label} — ${evt.sub}\n${evt.start}–${evt.end}${evt.room ? "\n" + evt.room : ""}`;
        el.onclick = () => togglePg(evt.modId, evt.lvId, evt.pgId);
      }

      col.appendChild(el);
    });

    grid.appendChild(col);
  });
}

function resolveOverlaps(evts) {
  // Simple column packing
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
  // Determine max cols for each event based on overlaps
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

// ═══════════════════════════════
//   ACTIONS
// ═══════════════════════════════
function togglePg(modId, lvId, pgId) {
  const mod = modules.find((m) => m.id === modId);
  if (!mod) return;
  const lv = mod.lvs.find((l) => l.id === lvId);
  if (!lv || lv.type !== "parallel") return;
  const pg = lv.groups.find((g) => g.id === pgId);
  if (!pg) return;
  pg.selected = !pg.selected;
  save();
  render();
}

function removeModule(id) {
  modules = modules.filter((m) => m.id !== id);
  save();
  render();
}

function removeLv(modId, lvId) {
  const mod = modules.find((m) => m.id === modId);
  if (!mod) return;
  mod.lvs = mod.lvs.filter((l) => l.id !== lvId);
  save();
  render();
}

function setFilter(f) {
  filter = f;
  document.getElementById("filterAll").classList.toggle("active", f === "all");
  document
    .getElementById("filterAvailable")
    .classList.toggle("active", f === "available");
  document
    .getElementById("filterSelected")
    .classList.toggle("active", f === "selected");
  save();
  renderCalendar();
}

function clearAll() {
  if (modules.length === 0) return;
  if (!confirm("Alle Daten löschen?")) return;
  modules = [];
  colorIdx = 0;
  save();
  render();
}

// ═══════════════════════════════
//   SHARE / LOAD JSON MODAL
// ═══════════════════════════════
function openShareModal(tab) {
  switchShareTab(tab || "export");
  if (tab === "export") {
    if (modules.length === 0) {
      showToast("Keine Daten zum Exportieren", "error");
      return;
    }
    document.getElementById("shareJsonOutput").value = JSON.stringify(
      { modules, colorIdx },
      null,
      2,
    );
    document.getElementById("shareCopyBtn").textContent = "Kopieren";
  }
  openModal("modalShare");
}

function switchShareTab(tab) {
  const isExport = tab === "export";
  document
    .getElementById("shareTabExport")
    .classList.toggle("active", isExport);
  document
    .getElementById("shareTabImport")
    .classList.toggle("active", !isExport);
  document.getElementById("sharePanelExport").style.display = isExport
    ? ""
    : "none";
  document.getElementById("sharePanelImport").style.display = isExport
    ? "none"
    : "";
  if (!isExport) {
    document.getElementById("shareJsonInput").value = "";
    document.getElementById("shareJsonError").style.display = "none";
    document.getElementById("shareImportBtn").disabled = true;
  }
}

function copyShareJson() {
  const ta = document.getElementById("shareJsonOutput");
  ta.select();
  try {
    navigator.clipboard
      .writeText(ta.value)
      .catch(() => document.execCommand("copy"));
  } catch (e) {
    document.execCommand("copy");
  }
  const btn = document.getElementById("shareCopyBtn");
  btn.textContent = "Kopiert ✓";
  setTimeout(() => (btn.textContent = "Kopieren"), 2000);
}

function downloadShareJson() {
  const blob = new Blob([document.getElementById("shareJsonOutput").value], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "stundenplan.json";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Stundenplan exportiert ✓", "success");
}

function validateShareJson() {
  const raw = document.getElementById("shareJsonInput").value.trim();
  const errEl = document.getElementById("shareJsonError");
  const btn = document.getElementById("shareImportBtn");
  if (!raw) {
    errEl.style.display = "none";
    btn.disabled = true;
    return;
  }
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data.modules))
      throw new Error('Kein "modules"-Array gefunden');
    errEl.style.display = "none";
    btn.disabled = false;
  } catch (e) {
    errEl.textContent = "⚠ Ungültiges JSON: " + e.message;
    errEl.style.display = "block";
    btn.disabled = true;
  }
}

function applyShareJson() {
  const raw = document.getElementById("shareJsonInput").value.trim();
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data.modules)) throw new Error("Ungültiges Format");
    _applyImportedData(data);
  } catch (e) {
    showToast("Fehler: " + e.message, "error");
  }
}

function importDataFile(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.modules)) throw new Error("Ungültiges Format");
      // If modal is open on import tab, paste into textarea instead of applying directly
      const modal = document.getElementById("modalShare");
      if (modal.classList.contains("open")) {
        document.getElementById("shareJsonInput").value = JSON.stringify(
          data,
          null,
          2,
        );
        validateShareJson();
        showToast("Datei geladen – bitte Laden bestätigen", "success");
      } else {
        _applyImportedData(data);
      }
    } catch (e) {
      showToast("Fehler beim Lesen der Datei: " + e.message, "error");
    }
  };
  reader.readAsText(file, "UTF-8");
}

function _applyImportedData(data) {
  const overwrite =
    modules.length === 0 ||
    confirm(
      "Vorhandene Daten überschreiben?\n\nAbbrechen = Daten zusammenführen (neue Module hinzufügen).",
    );
  if (overwrite) {
    modules = data.modules;
    colorIdx = data.colorIdx ?? data.modules.length;
  } else {
    const existingIds = new Set(modules.map((m) => m.id));
    data.modules.forEach((m) => {
      if (!existingIds.has(m.id)) modules.push(m);
    });
    colorIdx = Math.max(colorIdx, data.colorIdx ?? 0);
  }
  save();
  render();
  closeModal("modalShare");
  showToast(`${data.modules.length} Module geladen ✓`, "success");
}

function render() {
  renderSidebar();
  renderCalendar();
}

// ═══════════════════════════════
//   ADD MODULE MODAL
// ═══════════════════════════════
function openAddModuleModal() {
  tempLvForms = [];
  document.getElementById("newModuleName").value = "";
  document.getElementById("newLvList").innerHTML = "";
  openModal("modalAddModule");
}

function addLvToForm() {
  const id = nextId();
  tempLvForms.push(id);
  const container = document.getElementById("newLvList");
  const div = document.createElement("div");
  div.id = "lvform-" + id;
  div.style.cssText =
    "background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:4px";
  div.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-size:12px;font-weight:600;color:var(--text2)">Lehrveranstaltung</div>
      <button class="btn danger" style="padding:2px 6px;font-size:10px" onclick="removeLvForm('${id}')">✕</button>
    </div>
    <div class="form-group">
      <label>Name</label>
      <input type="text" id="lv-name-${id}" placeholder="z.B. Vorlesung, Tutorium, Labor..." />
    </div>
    <div class="form-group">
      <label>Typ</label>
      <select id="lv-type-${id}" onchange="toggleLvType('${id}')">
        <option value="static">Feste Zeit</option>
        <option value="parallel">Parallelgruppen (aus XHTML)</option>
      </select>
    </div>
    <div id="lv-static-${id}">
      <div class="form-row">
        <div class="form-group">
          <label>Tag</label>
          <select id="lv-day-${id}">
            ${DAYS.map((d) => `<option>${d}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label>Von</label>
          <input type="time" id="lv-start-${id}" value="08:00" />
        </div>
        <div class="form-group">
          <label>Bis</label>
          <input type="time" id="lv-end-${id}" value="09:30" />
        </div>
      </div>
      <div class="form-group">
        <label>Raum (optional)</label>
        <input type="text" id="lv-room-${id}" placeholder="z.B. A - 1.21" />
      </div>
    </div>
    <div id="lv-parallel-${id}" style="display:none;font-size:12px;color:var(--text2)">
      Parallelgruppen können über den XHTML-Import unten hinzugefügt werden.
    </div>
  `;
  container.appendChild(div);
}

function removeLvForm(id) {
  tempLvForms = tempLvForms.filter((x) => x !== id);
  const el = document.getElementById("lvform-" + id);
  if (el) el.remove();
}

function toggleLvType(id) {
  const type = document.getElementById("lv-type-" + id).value;
  document.getElementById("lv-static-" + id).style.display =
    type === "static" ? "" : "none";
  document.getElementById("lv-parallel-" + id).style.display =
    type === "parallel" ? "" : "none";
}

function confirmAddModule() {
  const name = document.getElementById("newModuleName").value.trim();
  if (!name) {
    showToast("Bitte Modulname eingeben", "error");
    return;
  }

  const lvs = [];
  for (const id of tempLvForms) {
    const lvName = document.getElementById("lv-name-" + id)?.value.trim();
    if (!lvName) continue;
    const type = document.getElementById("lv-type-" + id).value;
    if (type === "static") {
      lvs.push({
        id: nextId(),
        name: lvName,
        type: "static",
        day: document.getElementById("lv-day-" + id).value,
        startTime: document.getElementById("lv-start-" + id).value,
        endTime: document.getElementById("lv-end-" + id).value,
        room: document.getElementById("lv-room-" + id).value.trim(),
      });
    }
    // parallel added later via import
  }

  const mod = { id: nextId(), name, color: nextColor(), lvs };
  modules.push(mod);
  save();
  render();
  closeModal("modalAddModule");
  showToast('Modul "' + name + '" hinzugefügt ✓', "success");
}

// ═══════════════════════════════
//   ADD LV TO EXISTING MODULE
// ═══════════════════════════════
function openAddLvToModule(modId) {
  addingLvToModuleId = modId;
  const mod = modules.find((m) => m.id === modId);
  document.getElementById("modalAddLvTitle").textContent =
    "LV hinzufügen – " + mod.name;
  document.getElementById("modalAddLvBody").innerHTML = `
    <div class="form-group">
      <label>Name</label>
      <input type="text" id="addlv-name" placeholder="z.B. Vorlesung, Tutorium, Labor..." />
    </div>
    <div class="form-group">
      <label>Tag</label>
      <select id="addlv-day">${DAYS.map((d) => `<option>${d}</option>`).join("")}</select>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Von</label><input type="time" id="addlv-start" value="08:00"/></div>
      <div class="form-group"><label>Bis</label><input type="time" id="addlv-end" value="09:30"/></div>
    </div>
    <div class="form-group">
      <label>Raum (optional)</label>
      <input type="text" id="addlv-room" placeholder="z.B. A - 1.21" />
    </div>
  `;
  openModal("modalAddLv");
}

function confirmAddLv() {
  const name = document.getElementById("addlv-name")?.value.trim();
  if (!name) {
    showToast("Bitte LV-Name eingeben", "error");
    return;
  }
  const mod = modules.find((m) => m.id === addingLvToModuleId);
  if (!mod) return;
  mod.lvs.push({
    id: nextId(),
    name,
    type: "static",
    day: document.getElementById("addlv-day").value,
    startTime: document.getElementById("addlv-start").value,
    endTime: document.getElementById("addlv-end").value,
    room: document.getElementById("addlv-room").value.trim(),
  });
  save();
  render();
  closeModal("modalAddLv");
  showToast("LV hinzugefügt ✓", "success");
}

// ═══════════════════════════════
//   XHTML PARSER
// ═══════════════════════════════
function parseXhtml(content) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/html");
  const groups = [];

  // Find all parallelGroupSchedule sections by their h3
  const sections = doc.querySelectorAll('[id*="parallelGroupSchedule_"]');
  const seenIds = new Set();

  sections.forEach((section) => {
    const idAttr = section.id;
    if (!idAttr || seenIds.has(idAttr)) return;
    // Only top-level section divs
    if (!idAttr.match(/parallelGroupSchedule_\d+$/)) return;
    seenIds.add(idAttr);

    // Get group name from h3
    const h3 = section.querySelector("h3");
    if (!h3) return;
    const groupName = h3.textContent.trim();

    // Find appointment table rows
    const tables = section.querySelectorAll(
      "table.tableWithBorder, table.table",
    );
    tables.forEach((table) => {
      const tbody = table.querySelector("tbody");
      if (!tbody) return;
      const rows = tbody.querySelectorAll("tr");
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length < 4) return;
        // col2 = weekday, col3 = time
        let dayCell = "",
          timeCell = "";
        cells.forEach((td) => {
          if (td.classList.contains("column2")) dayCell = td.textContent.trim();
          if (td.classList.contains("column3"))
            timeCell = td.textContent.trim();
        });
        if (!dayCell || !timeCell) return;
        const day = parseDay(dayCell);
        const times = parseTime(timeCell);
        if (!day || !times) return;

        // Get room if available
        let room = "";
        cells.forEach((td) => {
          if (td.classList.contains("column9")) {
            const link = td.querySelector("a.link_text");
            if (link) room = link.textContent.trim();
          }
        });

        groups.push({
          id: nextId(),
          name: groupName,
          day,
          startTime: times.start,
          endTime: times.end,
          room,
          selected: false,
        });
      });
    });
  });

  return groups;
}

function parseDay(raw) {
  const cleaned = raw.trim().toLowerCase();
  return DAY_MAP[cleaned] || null;
}

function parseTime(raw) {
  // e.g. "09:45 - 11:15" or "09:45-11:15"
  const match = raw.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const start = match[1].padStart(2, "0") + ":" + match[2];
  const end = match[3].padStart(2, "0") + ":" + match[4];
  return { start, end };
}

// ═══════════════════════════════
//   FILE UPLOAD / DROP (XHTML + JSON)
// ═══════════════════════════════
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = "";
  readFile(file);
}

function onDragOver(e) {
  e.preventDefault();
  const dz = document.getElementById("dropzone");
  dz.classList.add("drag-over");
  // Try to detect file type from drag data
  const items = e.dataTransfer?.items;
  if (items && items.length > 0) {
    const name = items[0].type || '';
    dz.classList.toggle('drag-json', name.includes('json'));
    dz.classList.toggle('drag-xhtml', !name.includes('json'));
  }
}
function onDragLeave(e) {
  const dz = document.getElementById("dropzone");
  dz.classList.remove("drag-over", "drag-json", "drag-xhtml");
}
function onDrop(e) {
  e.preventDefault();
  document.getElementById("dropzone").classList.remove("drag-over", "drag-json", "drag-xhtml");
  const file = e.dataTransfer.files[0];
  if (file) readFile(file);
}

function readFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    const name = file.name.toLowerCase();
    if (name.endsWith('.json')) {
      // JSON import — load as schedule data
      try {
        const data = JSON.parse(content);
        if (!Array.isArray(data.modules)) throw new Error('Kein "modules"-Array gefunden');
        _applyImportedData(data);
      } catch (err) {
        showToast('Fehler beim JSON-Import: ' + err.message, 'error');
      }
    } else {
      // XHTML import — parse parallel groups
      openImportModal(content, file.name);
    }
  };
  reader.readAsText(file, "UTF-8");
}

function openImportModal(content, filename) {
  const groups = parseXhtml(content);
  if (groups.length === 0) {
    showToast("Keine Parallelgruppen gefunden in der Datei", "error");
    return;
  }
  pendingImport = { groups };

  // Populate module selector
  const sel = document.getElementById("importModuleSelect");
  sel.innerHTML = '<option value="__new__">Neues Modul erstellen...</option>';
  modules.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name;
    sel.appendChild(opt);
  });
  sel.onchange = () => {
    const isNew = sel.value === "__new__";
    document.getElementById("importNewModuleGroup").style.display = isNew
      ? ""
      : "none";
  };
  // Set initial visibility based on current selection
  document.getElementById("importNewModuleGroup").style.display =
    sel.value === "__new__" ? "" : "none";

  // Preview
  const preview = document.getElementById("importPreview");
  preview.innerHTML = "";
  // Group by name for cleaner display
  const unique = {};
  groups.forEach((g) => {
    if (!unique[g.name]) unique[g.name] = [];
    unique[g.name].push(g);
  });
  const names = Object.keys(unique);
  const previewNames = names.slice(0, 5);
  previewNames.forEach((name) => {
    const item = document.createElement("div");
    item.style.cssText =
      "background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:12px";
    const gs = unique[name];
    item.innerHTML =
      `<div style="font-weight:600;margin-bottom:4px;font-size:12px">${name}</div>` +
      gs
        .map(
          (g) =>
            `<div style="color:var(--text2);font-family:var(--mono);font-size:11px">${g.day} · ${g.startTime}–${g.endTime}${g.room ? " · " + g.room : ""}</div>`,
        )
        .join("");
    preview.appendChild(item);
  });
  if (names.length > 5) {
    const more = document.createElement("div");
    more.style.cssText =
      "font-size:11px;color:var(--text3);text-align:center;padding:4px";
    more.textContent = `+ ${names.length - 5} weitere Gruppen...`;
    preview.appendChild(more);
  }

  // Try to guess LV name from first group name
  const firstGroupName = names[0] || "";
  const guessedLvName =
    firstGroupName.split(" - ")[0] || filename.replace(/\.xhtml$/, "");
  document.getElementById("importLvName").value = guessedLvName;
  document.getElementById("importNewModuleName").value = guessedLvName;

  openModal("modalImport");
}

function confirmImport() {
  if (!pendingImport) return;
  const sel = document.getElementById("importModuleSelect");
  const lvName = document.getElementById("importLvName").value.trim();
  if (!lvName) {
    showToast("Bitte LV-Namen eingeben", "error");
    return;
  }

  let mod;
  if (sel.value === "__new__") {
    const mName = document.getElementById("importNewModuleName").value.trim();
    if (!mName) {
      showToast("Bitte Modulnamen eingeben", "error");
      return;
    }
    mod = { id: nextId(), name: mName, color: nextColor(), lvs: [] };
    modules.push(mod);
  } else {
    mod = modules.find((m) => m.id === sel.value);
    if (!mod) return;
  }

  const lv = {
    id: nextId(),
    name: lvName,
    type: "parallel",
    groups: pendingImport.groups,
  };
  mod.lvs.push(lv);

  pendingImport = null;
  save();
  render();
  closeModal("modalImport");
  showToast(`${lv.groups.length} Parallelgruppen importiert ✓`, "success");
}

// ═══════════════════════════════
//   MODAL HELPERS
// ═══════════════════════════════
function openModal(id) {
  document.getElementById(id).classList.add("open");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}
function closeAllModals() {
  document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
}

// Close modal on overlay click
document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.remove("open");
  });
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Esc closes any open modal
  if (e.key === 'Escape') {
    closeAllModals();
    return;
  }
  // Don't trigger shortcuts when typing in inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  // Ctrl+O opens optimizer
  if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
    e.preventDefault();
    openOptimizerModal();
  }
});

// ═══════════════════════════════
//   TOAST
// ═══════════════════════════════
function showToast(msg, type = "success") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = "toast " + type;
  toast.innerHTML = (type === "success" ? "✓ " : "⚠ ") + msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ═══════════════════════════════
//   OPTIMIZER
// ═══════════════════════════════

const OPTIMIZER_CRITERIA = [
  { id: 'freeDays',     label: 'Meiste freie Tage',        icon: '📅', desc: 'Tage ohne VL (HÜ/GÜ zählen als frei)' },
  { id: 'leastGaps',    label: 'Wenigste Leerzeit',         icon: '⏱️', desc: 'Lücken zwischen Veranstaltungen minimieren' },
  { id: 'latestStart',  label: 'Spätester Tagesbeginn',     icon: '🌅', desc: 'Möglichst spät am Tag beginnen' },
  { id: 'earliestEnd',  label: 'Frühestes Tagesende',       icon: '🌙', desc: 'Möglichst früh am Tag fertig sein' },
];

let optimizerPriorities = OPTIMIZER_CRITERIA.map(c => c.id);
let optimizerResult = null;

function loadOptimizerPriorities() {
  try {
    const raw = localStorage.getItem('stundenplaner_optprio');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length === 4) optimizerPriorities = arr;
    }
  } catch(e) {}
}
function saveOptimizerPriorities() {
  localStorage.setItem('stundenplaner_optprio', JSON.stringify(optimizerPriorities));
}

// Check if a group name indicates HÜ/GÜ (optional attendance)
function isOptionalLv(name) {
  if (!name) return false;
  const n = name.toLowerCase();
  return n.includes('hü') || n.includes('gü') ||
         n.includes('hörsaalübung') || n.includes('gruppenübung') ||
         n.includes('hoersaaluebung') || n.includes('gruppenuebung') ||
         /\bhu\b/.test(n) || /\bgu\b/.test(n);
}

// Collect all parallel LVs that need a choice
function getParallelChoices() {
  const choices = [];
  for (const mod of modules) {
    for (const lv of mod.lvs) {
      if (lv.type !== 'parallel' || lv.groups.length === 0) continue;
      // Filter out groups blocked by static LVs
      const validGroups = lv.groups.filter(g => !isBlockedByStatic(g));
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

// Cartesian product with early conflict pruning
function generateCombinations(choices) {
  if (choices.length === 0) return [[]];
  const results = [];
  const maxCombos = 50000; // safety limit

  function recurse(idx, current) {
    if (results.length >= maxCombos) return;
    if (idx === choices.length) {
      results.push([...current]);
      return;
    }
    for (const group of choices[idx].groups) {
      // Check if this group conflicts with already-chosen groups
      let hasConflict = false;
      for (const chosen of current) {
        if (chosen.day !== group.day) continue;
        const s1 = timeToMins(chosen.startTime), e1 = timeToMins(chosen.endTime);
        const s2 = timeToMins(group.startTime), e2 = timeToMins(group.endTime);
        if (s1 < e2 && s2 < e1) { hasConflict = true; break; }
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

// Collect all fixed events (static LVs) that always appear
function getStaticEvents() {
  const events = [];
  for (const mod of modules) {
    for (const lv of mod.lvs) {
      if (lv.type !== 'static') continue;
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

function scoreCombination(combo) {
  const staticEvents = getStaticEvents();
  // Build per-day schedule: static + combo
  const daySchedule = {};
  DAYS.forEach(d => daySchedule[d] = []);

  // Add static events
  for (const ev of staticEvents) {
    daySchedule[ev.day].push({
      start: timeToMins(ev.startTime),
      end: timeToMins(ev.endTime),
      name: ev.name,
      modName: ev.modName,
    });
  }
  // Add combo selections
  for (const g of combo) {
    daySchedule[g.day].push({
      start: timeToMins(g.startTime),
      end: timeToMins(g.endTime),
      name: g.name,
      modName: '',
    });
  }

  // Sort each day by start
  for (const d of DAYS) {
    daySchedule[d].sort((a, b) => a.start - b.start);
  }

  // 1) Free days: a day is free if it has 0 mandatory events (HÜ/GÜ don't count)
  let freeDays = 0;
  for (const d of DAYS) {
    const mandatory = daySchedule[d].filter(ev => !isOptionalLv(ev.name));
    if (mandatory.length === 0) freeDays++;
  }

  // 2) Wasted time (total gaps between consecutive events per day)
  let totalGaps = 0;
  for (const d of DAYS) {
    const evts = daySchedule[d];
    if (evts.length < 2) continue;
    for (let i = 1; i < evts.length; i++) {
      const gap = evts[i].start - evts[i-1].end;
      if (gap > 0) totalGaps += gap;
    }
  }

  // 3) Latest start: sum of first-event start times (higher = later = better)
  let startSum = 0;
  let activeDays = 0;
  for (const d of DAYS) {
    if (daySchedule[d].length === 0) continue;
    startSum += daySchedule[d][0].start;
    activeDays++;
  }
  const avgStart = activeDays > 0 ? startSum / activeDays : 24 * 60;

  // 4) Earliest end: sum of last-event end times (lower = earlier = better)
  let endSum = 0;
  let endDays = 0;
  for (const d of DAYS) {
    if (daySchedule[d].length === 0) continue;
    endSum += daySchedule[d][daySchedule[d].length - 1].end;
    endDays++;
  }
  const avgEnd = endDays > 0 ? endSum / endDays : 0;

  return {
    freeDays,
    totalGaps,
    avgStart,
    avgEnd,
    daySchedule,
  };
}

// Compare two scores based on priority order. Returns <0 if a is better.
function compareScores(a, b, priorities) {
  for (const crit of priorities) {
    let diff;
    switch (crit) {
      case 'freeDays':    diff = b.freeDays - a.freeDays; break;        // more is better
      case 'leastGaps':   diff = a.totalGaps - b.totalGaps; break;      // less is better
      case 'latestStart': diff = b.avgStart - a.avgStart; break;        // higher is better
      case 'earliestEnd': diff = a.avgEnd - b.avgEnd; break;            // lower is better
      default: diff = 0;
    }
    if (Math.abs(diff) > 0.01) return diff;
  }
  return 0;
}

function optimizePlan() {
  const choices = getParallelChoices();
  if (choices.length === 0) {
    return { error: 'Keine Parallelgruppen zum Optimieren vorhanden.' };
  }

  const totalPossible = choices.reduce((acc, c) => acc * c.groups.length, 1);
  const combos = generateCombinations(choices);

  if (combos.length === 0) {
    return { error: 'Keine konfliktfreien Kombinationen gefunden.' };
  }

  // Score all combos
  const scored = combos.map(combo => ({
    combo,
    score: scoreCombination(combo),
  }));

  // Sort by priority
  scored.sort((a, b) => compareScores(a.score, b.score, optimizerPriorities));

  // Return top 3 (or fewer if less available)
  const topResults = scored.slice(0, 3);

  return {
    best: scored[0],
    topResults,
    totalCombinations: totalPossible,
    validCombinations: combos.length,
    choices,
  };
}

function applyOptimalPlan(combo) {
  // Clear all parallel selections first
  for (const mod of modules) {
    for (const lv of mod.lvs) {
      if (lv.type !== 'parallel') continue;
      for (const g of lv.groups) g.selected = false;
    }
  }
  // Apply the winning combo
  for (const g of combo) {
    for (const mod of modules) {
      for (const lv of mod.lvs) {
        if (lv.type !== 'parallel') continue;
        const match = lv.groups.find(pg => pg.id === g.id);
        if (match) match.selected = true;
      }
    }
  }
  save();
  render();
}

// ── Optimizer Modal Logic ──
function openOptimizerModal() {
  loadOptimizerPriorities();
  optimizerResult = null;
  renderPriorityList();
  document.getElementById('optimizerResults').innerHTML = '';
  document.getElementById('optimizerResults').style.display = 'none';
  document.getElementById('btnApplyOptimal').style.display = 'none';
  openModal('modalOptimize');
}

function renderPriorityList() {
  const list = document.getElementById('priorityList');
  list.innerHTML = '';
  optimizerPriorities.forEach((critId, idx) => {
    const crit = OPTIMIZER_CRITERIA.find(c => c.id === critId);
    if (!crit) return;
    const item = document.createElement('div');
    item.className = 'priority-item';
    item.draggable = true;
    item.dataset.critId = critId;
    item.innerHTML = `
      <div class="priority-handle">⠿</div>
      <div class="priority-rank">${idx + 1}</div>
      <div class="priority-icon">${crit.icon}</div>
      <div class="priority-info">
        <div class="priority-label">${crit.label}</div>
        <div class="priority-desc">${crit.desc}</div>
      </div>
    `;

    // Drag events
    item.addEventListener('dragstart', (e) => {
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', critId);
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      document.querySelectorAll('.priority-item.drag-over-above, .priority-item.drag-over-below')
        .forEach(el => el.classList.remove('drag-over-above', 'drag-over-below'));
    });
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      item.classList.toggle('drag-over-above', e.clientY < midY);
      item.classList.toggle('drag-over-below', e.clientY >= midY);
    });
    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over-above', 'drag-over-below');
    });
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over-above', 'drag-over-below');
      const draggedId = e.dataTransfer.getData('text/plain');
      if (draggedId === critId) return;
      const fromIdx = optimizerPriorities.indexOf(draggedId);
      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      let toIdx = optimizerPriorities.indexOf(critId);
      if (e.clientY >= midY) toIdx++;
      // Remove from old position
      optimizerPriorities.splice(fromIdx, 1);
      // Adjust target if needed
      if (fromIdx < toIdx) toIdx--;
      optimizerPriorities.splice(toIdx, 0, draggedId);
      saveOptimizerPriorities();
      renderPriorityList();
    });

    list.appendChild(item);
  });
}

function runOptimizer() {
  const btn = document.getElementById('btnRunOptimizer');
  btn.disabled = true;
  btn.textContent = 'Berechne...';

  // Use setTimeout to let UI update
  setTimeout(() => {
    const result = optimizePlan();
    btn.disabled = false;
    btn.textContent = 'Berechnen';

    const resultsEl = document.getElementById('optimizerResults');
    resultsEl.style.display = '';

    if (result.error) {
      resultsEl.innerHTML = `<div class="opt-error">${result.error}</div>`;
      document.getElementById('btnApplyOptimal').style.display = 'none';
      return;
    }

    optimizerResult = result;
    optimizerResult.currentIdx = 0;
    renderOptimizerResultCard(0);
    document.getElementById('btnApplyOptimal').style.display = '';
  }, 50);
}

function renderOptimizerResultCard(idx) {
  const result = optimizerResult;
  if (!result || !result.topResults) return;
  const topCount = result.topResults.length;
  const entry = result.topResults[idx];
  const s = entry.score;
  const minsToTime = (m) => {
    const h = Math.floor(m / 60);
    const min = Math.round(m % 60);
    return h + ':' + String(min).padStart(2, '0');
  };

  const resultsEl = document.getElementById('optimizerResults');
  resultsEl.innerHTML = `
    <div class="opt-stats-header">
      <span class="opt-stats-badge">${result.validCombinations} von ${result.totalCombinations}</span>
      konfliktfreie Kombinationen geprüft
    </div>
    ${topCount > 1 ? `
    <div class="opt-nav">
      <button class="btn opt-nav-btn" onclick="navigateOptResult(-1)" ${idx === 0 ? 'disabled' : ''}>
        ◀
      </button>
      <span class="opt-nav-label">Ergebnis ${idx + 1} von ${topCount}</span>
      <button class="btn opt-nav-btn" onclick="navigateOptResult(1)" ${idx === topCount - 1 ? 'disabled' : ''}>
        ▶
      </button>
    </div>` : ''}
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
      ${entry.combo.map(g => `
        <div class="opt-selection-item">
          <span class="pg-day-badge">${g.day}</span>
          <span>${g.name}</span>
          <span class="opt-selection-time">${g.startTime}–${g.endTime}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function navigateOptResult(delta) {
  if (!optimizerResult || !optimizerResult.topResults) return;
  const newIdx = optimizerResult.currentIdx + delta;
  if (newIdx < 0 || newIdx >= optimizerResult.topResults.length) return;
  optimizerResult.currentIdx = newIdx;
  renderOptimizerResultCard(newIdx);
}

function applyOptimizerResult() {
  if (!optimizerResult || !optimizerResult.topResults) return;
  const entry = optimizerResult.topResults[optimizerResult.currentIdx];
  applyOptimalPlan(entry.combo);
  closeModal('modalOptimize');
  showToast('Optimaler Stundenplan angewendet ✓', 'success');
}

// ═══════════════════════════════
//   INIT
// ═══════════════════════════════
loadOptimizerPriorities();
load();
// Restore persisted UI state
document.getElementById('filterAll').classList.toggle('active', filter === 'all');
document.getElementById('filterAvailable').classList.toggle('active', filter === 'available');
document.getElementById('filterSelected').classList.toggle('active', filter === 'selected');
document.getElementById('colorModeModule').classList.toggle('active', colorMode === 'module');
document.getElementById('colorModeType').classList.toggle('active', colorMode === 'type');
render();
