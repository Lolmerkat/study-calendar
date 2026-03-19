/**
 * Renders the sidebar module list with all LVs and parallel groups.
 * Shows an empty-state placeholder when no modules exist.
 */
function renderSidebar() {
  const body = document.getElementById("sidebarBody");
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
  if (empty.parentNode) empty.parentNode.removeChild(empty);
  body.innerHTML = "";
  modules.forEach((mod) => {
    const card = document.createElement("div");
    card.className = "module-card";
    card.id = "module-card-" + mod.id;

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

/**
 * Toggles the collapse state of a module card in the sidebar.
 * @param {string} id - Module ID
 */
function toggleModule(id) {
  const body = document.getElementById("body-" + id);
  const toggle = document.getElementById("toggle-" + id);
  const open = body.classList.toggle("open");
  toggle.classList.toggle("open", open);
}

/**
 * Expands all module cards in the sidebar.
 */
function expandAllModules() {
  modules.forEach((mod) => {
    const body = document.getElementById("body-" + mod.id);
    const toggle = document.getElementById("toggle-" + mod.id);
    if (body) body.classList.add("open");
    if (toggle) toggle.classList.add("open");
  });
}

/**
 * Collapses all module cards in the sidebar.
 */
function collapseAllModules() {
  modules.forEach((mod) => {
    const body = document.getElementById("body-" + mod.id);
    const toggle = document.getElementById("toggle-" + mod.id);
    if (body) body.classList.remove("open");
    if (toggle) toggle.classList.remove("open");
  });
}
