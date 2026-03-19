/**
 * Renders the weekly calendar grid with all events positioned by time.
 * Builds day columns, time gutter, hour/half-hour lines, and event cards.
 * Also updates the global conflict banner.
 */
function renderCalendar() {
  const grid = document.getElementById("weekGrid");
  grid.innerHTML = "";
  const totalPx = TOTAL_HOURS * 64;

  const cornerEl = document.createElement("div");
  cornerEl.className = "day-header";
  grid.appendChild(cornerEl);
  DAYS.forEach((d, i) => {
    const el = document.createElement("div");
    el.className = "day-header";
    el.textContent = DAYS_FULL[i];
    grid.appendChild(el);
  });

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

  const eventsByDay = { Mo: [], Di: [], Mi: [], Do: [], Fr: [] };

  modules.forEach((mod) => {
    mod.vls.forEach((vl) => {
      if (vl.type === "static") {
        if (!eventsByDay[vl.day]) return;
        eventsByDay[vl.day].push({
          kind: "static",
          label: mod.name,
          sub: vl.name,
          start: vl.startTime,
          end: vl.endTime,
          room: vl.room,
          color: getEventColor(mod, vl.name, null),
          modId: mod.id,
          vlId: vl.id,
        });
      } else {
        vl.groups.forEach((pg) => {
          if (!eventsByDay[pg.day]) return;
          const blocked = isBlockedByStatic(pg);
          if (filter === "available" && blocked) return;
          if (filter === "selected" && !pg.selected) return;
          const conflict = checkConflict(pg, mod.id, vl.id, pg.id);
          eventsByDay[pg.day].push({
            kind: "parallel",
            label: mod.name,
            sub: pg.name,
            start: pg.startTime,
            end: pg.endTime,
            room: pg.room,
            color: getEventColor(mod, vl.name, pg.name),
            selected: pg.selected,
            blocked,
            conflict: conflict.has,
            conflictWith: conflict.with,
            modId: mod.id,
            vlId: vl.id,
            pgId: pg.id,
          });
        });
      }
    });
  });

  const conflicts = [];
  modules.forEach((mod) => {
    mod.vls.forEach((vl) => {
      if (vl.type === "parallel") {
        vl.groups.forEach((pg) => {
          if (!pg.selected) return;
          const c = checkConflict(pg, mod.id, vl.id, pg.id);
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

  DAYS.forEach((day) => {
    const col = document.createElement("div");
    col.className = "day-col";
    col.style.cssText = `position:relative;height:${totalPx}px`;

    for (let h = 0; h < TOTAL_HOURS; h++) {
      const line = document.createElement("div");
      line.className = "hour-line";
      col.appendChild(line);
      const half = document.createElement("div");
      half.className = "half-line";
      half.style.top = (h + 0.5) * 64 + "px";
      col.appendChild(half);
    }

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

      el.innerHTML = `
        <div class="event-title">${evt.label}</div>
        ${hPx > 32 ? `<div class="event-sub">${evt.sub}</div>` : ""}
        ${hPx > 46 ? `<div class="event-time-tag">${evt.start}–${evt.end}${evt.room ? " · " + evt.room : ""}</div>` : ""}
      `;

      if (evt.kind === "parallel") {
        el.title = `${evt.label} — ${evt.sub}\n${evt.start}–${evt.end}${evt.room ? "\n" + evt.room : ""}`;
        el.onclick = () => togglePg(evt.modId, evt.vlId, evt.pgId);
      }

      col.appendChild(el);
    });

    grid.appendChild(col);
  });
}

/**
 * Sets the calendar filter mode and re-renders.
 * @param {'all'|'available'|'selected'} f - The filter mode to activate
 */
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

/**
 * Switches the event colour mode between module-based and type-based colouring.
 * @param {'module'|'type'} mode - The colour mode to set
 */
function setColorMode(mode) {
  colorMode = mode;
  document
    .getElementById("colorModeModule")
    .classList.toggle("active", mode === "module");
  document
    .getElementById("colorModeType")
    .classList.toggle("active", mode === "type");
  save();
  renderCalendar();
}
