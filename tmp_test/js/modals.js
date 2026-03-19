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
  tempVlForms = [];
  document.getElementById("newModuleName").value = "";
  document.getElementById("newLvList").innerHTML = "";
  openModal("modalAddModule");
}

/**
 * Appends a new VL sub-form to the add-module modal.
 */
function addVlToForm() {
  const id = nextId();
  tempVlForms.push(id);
  const container = document.getElementById("newLvList");
  const div = document.createElement("div");
  div.id = "lvform-" + id;
  div.style.cssText =
    "background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:4px";
  div.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-size:12px;font-weight:600;color:var(--text2)">Vorlesung</div>
      <button class="btn danger" style="padding:2px 6px;font-size:10px" onclick="removeVlForm('${id}')">✕</button>
    </div>
    <div class="form-group">
      <label>Name</label>
      <input type="text" id="vl-name-${id}" placeholder="z.B. Vorlesung, Tutorium, Labor..." />
    </div>
    <div class="form-group">
      <label>Typ</label>
      <select id="vl-type-${id}" onchange="toggleVlType('${id}')">
        <option value="static">Feste Zeit</option>
        <option value="parallel">Parallelgruppen (aus XHTML)</option>
      </select>
    </div>
    <div id="vl-static-${id}">
      <div class="form-row">
        <div class="form-group">
          <label>Tag</label>
          <select id="vl-day-${id}">
            ${DAYS.map((d) => `<option>${d}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label>Von</label>
          <input type="time" id="vl-start-${id}" value="08:00" />
        </div>
        <div class="form-group">
          <label>Bis</label>
          <input type="time" id="vl-end-${id}" value="09:30" />
        </div>
      </div>
      <div class="form-group">
        <label>Raum (optional)</label>
        <input type="text" id="vl-room-${id}" placeholder="z.B. A - 1.21" />
      </div>
    </div>
    <div id="vl-parallel-${id}" style="display:none;font-size:12px;color:var(--text2)">
      Parallelgruppen können über den XHTML-Import unten hinzugefügt werden.
    </div>
  `;
  container.appendChild(div);
}

/**
 * Removes a temporary VL sub-form from the add-module modal.
 * @param {string} id - VL form ID to remove
 */
function removeVlForm(id) {
  tempVlForms = tempVlForms.filter((x) => x !== id);
  const el = document.getElementById("lvform-" + id);
  if (el) el.remove();
}

/**
 * Toggles the static/parallel fields in a VL sub-form.
 * @param {string} id - VL form ID
 */
function toggleVlType(id) {
  const type = document.getElementById("vl-type-" + id).value;
  document.getElementById("vl-static-" + id).style.display =
    type === "static" ? "" : "none";
  document.getElementById("vl-parallel-" + id).style.display =
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

  const vls = [];
  for (const id of tempVlForms) {
    const vlName = document.getElementById("vl-name-" + id)?.value.trim();
    if (!vlName) continue;
    const type = document.getElementById("vl-type-" + id).value;
    if (type === "static") {
      vls.push({
        id: nextId(),
        name: vlName,
        type: "static",
        day: document.getElementById("vl-day-" + id).value,
        startTime: document.getElementById("vl-start-" + id).value,
        endTime: document.getElementById("vl-end-" + id).value,
        room: document.getElementById("vl-room-" + id).value.trim(),
      });
    }
  }

  const mod = { id: nextId(), name, color: nextColor(), vls };
  modules.push(mod);
  save();
  render();
  closeModal("modalAddModule");
  showToast('Modul "' + name + '" hinzugefügt ✓', "success");
}

/**
 * Opens the modal to add a static VL to an existing module.
 * @param {string} modId - Module ID to receive the new VL
 */
function openAddVlToModule(modId) {
  addingVlToModuleId = modId;
  const mod = modules.find((m) => m.id === modId);
  document.getElementById("modalAddVlTitle").textContent =
    "VL hinzufügen – " + mod.name;
  document.getElementById("modalAddVlBody").innerHTML = `
    <div class="form-group">
      <label>Name</label>
      <input type="text" id="addvl-name" placeholder="z.B. Vorlesung, Tutorium, Labor..." />
    </div>
    <div class="form-group">
      <label>Tag</label>
      <select id="addvl-day">${DAYS.map((d) => `<option>${d}</option>`).join("")}</select>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Von</label><input type="time" id="addvl-start" value="08:00"/></div>
      <div class="form-group"><label>Bis</label><input type="time" id="addvl-end" value="09:30"/></div>
    </div>
    <div class="form-group">
      <label>Raum (optional)</label>
      <input type="text" id="addvl-room" placeholder="z.B. A - 1.21" />
    </div>
  `;
  openModal("modalAddVl");
}

/**
 * Validates and adds a new static VL to the module selected via the add-VL modal.
 */
function confirmAddVl() {
  const name = document.getElementById("addvl-name")?.value.trim();
  if (!name) {
    showToast("Bitte VL-Name eingeben", "error");
    return;
  }
  const mod = modules.find((m) => m.id === addingVlToModuleId);
  if (!mod) return;
  mod.vls.push({
    id: nextId(),
    name,
    type: "static",
    day: document.getElementById("addvl-day").value,
    startTime: document.getElementById("addvl-start").value,
    endTime: document.getElementById("addvl-end").value,
    room: document.getElementById("addvl-room").value.trim(),
  });
  save();
  render();
  closeModal("modalAddVl");
  showToast("VL hinzugefügt ✓", "success");
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
