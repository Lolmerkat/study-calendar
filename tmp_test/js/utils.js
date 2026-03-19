/**
 * Generates a short random ID string prefixed with an underscore.
 * @returns {string} A random identifier (e.g. "_a3f9x2k")
 */
function nextId() {
  return "_" + Math.random().toString(36).slice(2, 9);
}

/**
 * Returns the next colour from the COLORS palette and advances the index.
 * @returns {string} Hex colour string
 */
function nextColor() {
  return COLORS[colorIdx++ % COLORS.length];
}

/**
 * Converts a "HH:MM" time string to total minutes since midnight.
 * @param {string} t - Time string in "HH:MM" format
 * @returns {number} Minutes since midnight
 */
function timeToMins(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * Converts a time string to a top-offset percentage within the calendar grid.
 * @param {string} t - Time string in "HH:MM" format
 * @returns {number} Percentage offset from the top of the grid
 */
function timeToTopPct(t) {
  const mins = timeToMins(t) - HOUR_START * 60;
  return (mins / (TOTAL_HOURS * 60)) * 100;
}

/**
 * Calculates the height percentage an event spans within the calendar grid.
 * @param {string} start - Start time in "HH:MM" format
 * @param {string} end - End time in "HH:MM" format
 * @returns {number} Duration as a percentage of the total grid height
 */
function durationPct(start, end) {
  const mins = timeToMins(end) - timeToMins(start);
  return (mins / (TOTAL_HOURS * 60)) * 100;
}

/**
 * Detects the VL type abbreviation from its name using pattern matching.
 * @param {string} name - Name of the VL or group
 * @returns {'vl'|'hü'|'gü'|'pr'|'se'|'tu'|'other'} Detected type key
 */
function detectVlType(name) {
  if (!name) return "other";
  const n = name.toLowerCase();
  if (/\bvl\b|vorlesung/.test(n)) return "vl";
  if (/\bhü\b|hörsaalübung|hoersaaluebung/.test(n)) return "hü";
  if (/\bgü\b|\[gü\]|gruppenübung|gruppenuebung/.test(n)) return "gü";
  if (/\bpr\b|\[pr\]|praktikum|labor/.test(n)) return "pr";
  if (/\bse\b|seminar/.test(n)) return "se";
  if (/\btu\b|tutorium/.test(n)) return "tu";
  return "other";
}

/**
 * Returns the display colour for a calendar event based on the current colour mode.
 * In "module" mode the module colour is returned; in "type" mode the colour is
 * derived from the VL name (falling back to the group name).
 * @param {Object} mod - Module object containing a `color` property
 * @param {string} vlName - Name of the VL
 * @param {string|null} pgName - Name of the parallel group (optional fallback)
 * @returns {string} Hex colour string
 */
function getEventColor(mod, vlName, pgName) {
  if (colorMode === "module") return mod.color;
  let t = detectVlType(vlName);
  if (t === "other" && pgName) t = detectVlType(pgName);
  return TYPE_COLORS[t] || TYPE_COLORS.other;
}

/**
 * Parses a raw weekday string into its canonical short abbreviation.
 * @param {string} raw - Weekday text (e.g. "Montag", "Mo", "Monday")
 * @returns {string|null} Canonical abbreviation or null if unrecognised
 */
function parseDay(raw) {
  const cleaned = raw.trim().toLowerCase();
  return DAY_MAP[cleaned] || null;
}

/**
 * Parses a time-range string (e.g. "09:45 - 11:15") into start/end times.
 * @param {string} raw - Time range string
 * @returns {{start: string, end: string}|null} Parsed times or null on failure
 */
function parseTime(raw) {
  const match = raw.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const start = match[1].padStart(2, "0") + ":" + match[2];
  const end = match[3].padStart(2, "0") + ":" + match[4];
  return { start, end };
}

/**
 * Checks whether an VL name indicates optional attendance (HÜ / GÜ).
 * Used by the optimizer to classify "free" days.
 * @param {string} name - VL or group name
 * @returns {boolean} True if the VL is considered optional
 */
function isOptionalVl(name) {
  if (!name) return false;
  const n = name.toLowerCase();
  return (
    n.includes("hü") ||
    n.includes("gü") ||
    n.includes("hörsaalübung") ||
    n.includes("gruppenübung") ||
    n.includes("hoersaaluebung") ||
    n.includes("gruppenuebung") ||
    /\bhu\b/.test(n) ||
    /\bgu\b/.test(n)
  );
}
