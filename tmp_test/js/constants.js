/** @type {string[]} Available module color palette */
const COLORS = [
  "#7c6af7",
  "#c084fc",
  "#34d399",
  "#fbbf24",
  "#60a5fa",
  "#fb923c",
  "#e879f9",
  "#4ade80",
  "#f472b6",
];

/** @type {string[]} Short day labels (Mon–Fri, German abbreviations) */
const DAYS = ["Mo", "Di", "Mi", "Do", "Fr"];

/** @type {string[]} Full day names (German) */
const DAYS_FULL = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

/**
 * Maps various day name representations (German/English, short/long)
 * to the canonical short-form abbreviation.
 * @type {Record<string, string>}
 */
const DAY_MAP = {
  mo: "Mo",
  di: "Di",
  mi: "Mi",
  do: "Do",
  fr: "Fr",
  montag: "Mo",
  dienstag: "Di",
  mittwoch: "Mi",
  donnerstag: "Do",
  freitag: "Fr",
  monday: "Mo",
  tuesday: "Di",
  wednesday: "Mi",
  thursday: "Do",
  friday: "Fr",
};

/**
 * Color palette keyed by VL type abbreviation.
 * @type {Record<string, string>}
 */
const TYPE_COLORS = {
  vl: "#60a5fa",
  hü: "#fbbf24",
  gü: "#34d399",
  pr: "#c084fc",
  se: "#fb923c",
  tu: "#f472b6",
  other: "#9090a8",
};

/** @type {number} First calendar hour displayed */
const HOUR_START = 8;

/** @type {number} Last calendar hour displayed (exclusive) */
const HOUR_END = 19;

/** @type {number} Total number of hours rendered */
const TOTAL_HOURS = HOUR_END - HOUR_START;
