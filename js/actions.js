/**
 * Toggles the selection state of a parallel group and re-renders the UI.
 * @param {string} modId - Module ID
 * @param {string} lvId - LV ID
 * @param {string} pgId - Parallel group ID
 */
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

/**
 * Removes a module by ID and re-renders the UI.
 * @param {string} id - Module ID to remove
 */
function removeModule(id) {
  modules = modules.filter((m) => m.id !== id);
  save();
  render();
}

/**
 * Removes an LV from a module and re-renders the UI.
 * @param {string} modId - Parent module ID
 * @param {string} lvId - LV ID to remove
 */
function removeLv(modId, lvId) {
  const mod = modules.find((m) => m.id === modId);
  if (!mod) return;
  mod.lvs = mod.lvs.filter((l) => l.id !== lvId);
  save();
  render();
}

/**
 * Clears all modules after user confirmation and resets state.
 */
function clearAll() {
  if (modules.length === 0) return;
  if (!confirm("Alle Daten löschen?")) return;
  modules = [];
  colorIdx = 0;
  save();
  render();
}

/**
 * Re-renders both the sidebar and the calendar.
 */
function render() {
  renderSidebar();
  renderCalendar();
}
