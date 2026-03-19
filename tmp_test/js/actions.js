/**
 * Toggles the selection state of a parallel group and re-renders the UI.
 * @param {string} modId - Module ID
 * @param {string} vlId - VL ID
 * @param {string} pgId - Parallel group ID
 */
function togglePg(modId, vlId, pgId) {
  const mod = modules.find((m) => m.id === modId);
  if (!mod) return;
  const vl = mod.vls.find((l) => l.id === vlId);
  if (!vl || vl.type !== "parallel") return;
  const pg = vl.groups.find((g) => g.id === pgId);
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
 * Removes an VL from a module and re-renders the UI.
 * @param {string} modId - Parent module ID
 * @param {string} vlId - VL ID to remove
 */
function removeVl(modId, vlId) {
  const mod = modules.find((m) => m.id === modId);
  if (!mod) return;
  mod.vls = mod.vls.filter((l) => l.id !== vlId);
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
