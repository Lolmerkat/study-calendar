/**
 * Renders the sidebar module list with all VLs and parallel groups.
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

    let vlHtml = "";
    mod.vls.forEach((vl) => {
      if (vl.type === "static") {
        vlHtml += `
          <div class="vl-item static-vl">
            <div class="vl-label">Fest · ${vl.name}</div>
            <div class="pg-time" style="margin-top:3px">
              <span class="pg-day-badge">${vl.day}</span>
              <span>${vl.startTime}–${vl.endTime}</span>
              ${vl.room ? `<span style="color:var(--text3)">· ${vl.room}</span>` : ""}
            </div>
            <button class="btn danger" style="padding:2px 6px;font-size:10px;margin-top:4px" onclick="removeVl('${mod.id}','${vl.id}')">Entfernen</button>
          </div>`;
      } else {
        let pgHtml = vl.groups
          .map((pg) => {
            const conflict = checkConflict(pg, mod.id, vl.id, pg.id);
            const blocked = isBlockedByStatic(pg);
            return `
            <div class="pg-item ${pg.selected ? "selected" : ""} ${conflict.has ? "conflict-bg" : ""} ${blocked ? "blocked-static" : ""}"
                 onclick="togglePg('${mod.id}','${vl.id}','${pg.id}')">
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
                ${blocked ? `<div class="pg-blocked-label">⛔ Feste VL überschneidet sich</div>` : conflict.has ? `<div class="pg-conflict">⚠ Konflikt mit ${conflict.with}</div>` : ""}
              </div>
            </div>`;
          })
          .join("");

        vlHtml += `
          <div class="vl-item" style="padding:0">
            <div style="padding:6px 10px;display:flex;align-items:center;justify-content:space-between">
              <div>
                <div class="vl-label">${vl.name}</div>
                <div class="vl-type" style="font-size:11px;color:var(--text3)">${vl.groups.length} Parallelgruppen</div>
              </div>
              <button class="btn danger" style="padding:2px 6px;font-size:10px" onclick="removeVl('${mod.id}','${vl.id}')">✕</button>
            </div>
            <div style="border-top:1px solid var(--border);padding:6px;display:flex;flex-direction:column;gap:3px">
              ${pgHtml}
            </div>
          </div>`;
      }
    });

    vlHtml += `
      <button class="btn" style="width:100%;justify-content:center;font-size:11px;margin-top:4px"
        onclick="openAddVlToModule('${mod.id}')">+ VL hinzufügen</button>`;

    card.innerHTML =
      headerHtml +
      `<div class="module-body open" id="body-${mod.id}">${vlHtml}</div>`;
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

/**
 * Toggles the sidebar collapse state.
 */
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const resizer = document.getElementById("sidebarResizer");
  sidebar.classList.toggle("collapsed");
  resizer.classList.toggle("collapsed");
}

/**
 * Initializes the sidebar resizing logic.
 */
function initSidebarResizer() {
  const resizer = document.getElementById("sidebarResizer");
  const sidebar = document.getElementById("sidebar");
  if (!resizer || !sidebar) return;
  
  let isResizing = false;

  resizer.addEventListener("mousedown", (e) => {
    isResizing = true;
    sidebar.classList.add("is-resizing");
    resizer.classList.add("is-resizing");
    document.body.style.cursor = "col-resize";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;
    const newWidth = e.clientX;
    // We update the width directly; bounds are enforced by min-width/max-width in CSS
    sidebar.style.width = `${newWidth}px`;
  });

  document.addEventListener("mouseup", () => {
    if (isResizing) {
      isResizing = false;
      sidebar.classList.remove("is-resizing");
      resizer.classList.remove("is-resizing");
      document.body.style.cursor = "";
    }
  });
}

document.addEventListener("DOMContentLoaded", initSidebarResizer);

