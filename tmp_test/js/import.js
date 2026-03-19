/**
 * Parses an XHTML document exported from HISinOne and extracts parallel group
 * schedule entries from parallelGroupSchedule sections.
 * @param {string} content - Raw XHTML string
 * @returns {Object[]} Array of parallel group objects
 */
function parseXhtml(content) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/html");
  const groups = [];

  const sections = doc.querySelectorAll('[id*="parallelGroupSchedule_"]');
  const seenIds = new Set();

  sections.forEach((section) => {
    const idAttr = section.id;
    if (!idAttr || seenIds.has(idAttr)) return;
    if (!idAttr.match(/parallelGroupSchedule_\d+$/)) return;
    seenIds.add(idAttr);

    const h3 = section.querySelector("h3");
    if (!h3) return;
    const groupName = h3.textContent.trim();

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

/**
 * Handles file selection from the hidden file input.
 * @param {Event} event - Input change event
 */
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = "";
  readFile(file);
}

/**
 * Handles dragover on the drop zone.
 * @param {DragEvent} e - Drag event
 */
function onDragOver(e) {
  e.preventDefault();
  const dz = document.getElementById("dropzone");
  dz.classList.add("drag-over");
  const items = e.dataTransfer?.items;
  if (items && items.length > 0) {
    const name = items[0].type || "";
    dz.classList.toggle("drag-json", name.includes("json"));
    dz.classList.toggle("drag-xhtml", !name.includes("json"));
  }
}

/**
 * Handles dragleave on the drop zone.
 * @param {DragEvent} e - Drag event
 */
function onDragLeave(e) {
  const dz = document.getElementById("dropzone");
  dz.classList.remove("drag-over", "drag-json", "drag-xhtml");
}

/**
 * Handles file drop on the drop zone.
 * @param {DragEvent} e - Drop event
 */
function onDrop(e) {
  e.preventDefault();
  document
    .getElementById("dropzone")
    .classList.remove("drag-over", "drag-json", "drag-xhtml");
  const file = e.dataTransfer.files[0];
  if (file) readFile(file);
}

/**
 * Reads a file (XHTML or JSON) and either imports it directly or opens a modal.
 * @param {File} file - File object to read
 */
function readFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    const name = file.name.toLowerCase();
    if (name.endsWith(".json")) {
      try {
        const data = JSON.parse(content);
        if (!Array.isArray(data.modules))
          throw new Error('Kein "modules"-Array gefunden');
        _applyImportedData(data);
      } catch (err) {
        showToast("Fehler beim JSON-Import: " + err.message, "error");
      }
    } else {
      openImportModal(content, file.name);
    }
  };
  reader.readAsText(file, "UTF-8");
}

/**
 * Opens the XHTML import modal with a preview of parsed groups.
 * @param {string} content - Raw XHTML content
 * @param {string} filename - Original filename for fallback naming
 */
function openImportModal(content, filename) {
  const groups = parseXhtml(content);
  if (groups.length === 0) {
    showToast("Keine Parallelgruppen gefunden in der Datei", "error");
    return;
  }
  pendingImport = { groups };

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
  document.getElementById("importNewModuleGroup").style.display =
    sel.value === "__new__" ? "" : "none";

  const preview = document.getElementById("importPreview");
  preview.innerHTML = "";
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

  const firstGroupName = names[0] || "";
  const guessedLvName =
    firstGroupName.split(" - ")[0] || filename.replace(/\.xhtml$/, "");
  document.getElementById("importVlName").value = guessedLvName;
  document.getElementById("importNewModuleName").value = guessedLvName;

  openModal("modalImport");
}

/**
 * Confirms the XHTML import, creating or attaching a parallel VL to a module.
 */
function confirmImport() {
  if (!pendingImport) return;
  const sel = document.getElementById("importModuleSelect");
  const vlName = document.getElementById("importVlName").value.trim();
  if (!vlName) {
    showToast("Bitte VL-Namen eingeben", "error");
    return;
  }

  let mod;
  if (sel.value === "__new__") {
    const mName = document.getElementById("importNewModuleName").value.trim();
    if (!mName) {
      showToast("Bitte Modulnamen eingeben", "error");
      return;
    }
    mod = { id: nextId(), name: mName, color: nextColor(), vls: [] };
    modules.push(mod);
  } else {
    mod = modules.find((m) => m.id === sel.value);
    if (!mod) return;
  }

  const vl = {
    id: nextId(),
    name: vlName,
    type: "parallel",
    groups: pendingImport.groups,
  };
  mod.vls.push(vl);

  pendingImport = null;
  save();
  render();
  closeModal("modalImport");
  showToast(`${vl.groups.length} Parallelgruppen importiert ✓`, "success");
}

/**
 * Handles JSON file import from the share modal's file input.
 * @param {Event} event - Input change event
 */
function importDataFile(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.modules)) throw new Error("Ungültiges Format");
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

/**
 * Merges or replaces the current data with imported module data.
 * Prompts the user when existing data is present.
 * @param {Object} data - Imported data with a `modules` array
 */
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
