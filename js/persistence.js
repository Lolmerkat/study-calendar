/**
 * Persists the current application state to localStorage.
 * Silently swallows errors (e.g. quota exceeded, private browsing).
 */
function save() {
  try {
    localStorage.setItem(
      "stundenplaner_v2",
      JSON.stringify({ modules, colorIdx, filter, colorMode }),
    );
  } catch (e) {}
}

/**
 * Restores application state from localStorage.
 * Silently falls back to defaults on error.
 */
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
