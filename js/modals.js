/**
 * Opens a modal overlay by adding the "open" class.
 * @param {string} id - DOM ID of the modal overlay element
 */
function openModal(id) {
  document.getElementById(id).classList.add("open");
}

/**
 * Closes a modal overlay by removing the "open" class.
 * @param {string} id - DOM ID of the modal overlay element
 */
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

/**
 * Closes all currently open modal overlays.
 */
function closeAllModals() {
  document
    .querySelectorAll(".modal-overlay.open")
    .forEach((m) => m.classList.remove("open"));
}

/**
 * Opens the "Add Module" modal and resets its form state.
 */
function openAddModuleModal() {
  tempLvForms = [];
  document.getElementById("newModuleName").value = "";
  document.getElementById("newLvList").innerHTML = "";
  openModal("modalAddModule");
}

/**
 * Appends a new LV sub-form to the add-module modal.
 */
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

/**
 * Removes a temporary LV sub-form from the add-module modal.
 * @param {string} id - LV form ID to remove
 */
function removeLvForm(id) {
  tempLvForms = tempLvForms.filter((x) => x !== id);
  const el = document.getElementById("lvform-" + id);
  if (el) el.remove();
}

/**
 * Toggles the static/parallel fields in a LV sub-form.
 * @param {string} id - LV form ID
 */
function toggleLvType(id) {
  const type = document.getElementById("lv-type-" + id).value;
  document.getElementById("lv-static-" + id).style.display =
    type === "static" ? "" : "none";
  document.getElementById("lv-parallel-" + id).style.display =
    type === "parallel" ? "" : "none";
}

/**
 * Validates and creates a new module from the add-module modal form data.
 */
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
  }

  const mod = { id: nextId(), name, color: nextColor(), lvs };
  modules.push(mod);
  save();
  render();
  closeModal("modalAddModule");
  showToast('Modul "' + name + '" hinzugefügt ✓', "success");
}

/**
 * Opens the modal to add a static LV to an existing module.
 * @param {string} modId - Module ID to receive the new LV
 */
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

/**
 * Validates and adds a new static LV to the module selected via the add-LV modal.
 */
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

/**
 * Displays a temporary toast notification.
 * @param {string} msg - Message to display
 * @param {'success'|'error'} [type='success'] - Toast style
 */
function showToast(msg, type = "success") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = "toast " + type;
  toast.innerHTML = (type === "success" ? "✓ " : "⚠ ") + msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Close modal when clicking the overlay backdrop
document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.remove("open");
  });
});

// Global keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeAllModals();
    return;
  }
  if (
    e.target.tagName === "INPUT" ||
    e.target.tagName === "TEXTAREA" ||
    e.target.tagName === "SELECT"
  )
    return;
  if ((e.ctrlKey || e.metaKey) && e.key === "o") {
    e.preventDefault();
    openOptimizerModal();
  }
});
