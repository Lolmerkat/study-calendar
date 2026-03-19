/**
 * Opens the share/load modal on the specified tab.
 * @param {'export'|'import'} [tab='export'] - Which tab to show initially
 */
function openShareModal(tab) {
  switchShareTab(tab || "export");
  if (tab === "export") {
    if (modules.length === 0) {
      showToast("Keine Daten zum Exportieren", "error");
      return;
    }
    document.getElementById("shareJsonOutput").value = JSON.stringify(
      { modules, colorIdx },
      null,
      2,
    );
    document.getElementById("shareCopyBtn").textContent = "Kopieren";
  }
  openModal("modalShare");
}

/**
 * Switches the active tab in the share/load modal.
 * @param {'export'|'import'} tab - Tab to activate
 */
function switchShareTab(tab) {
  const isExport = tab === "export";
  document
    .getElementById("shareTabExport")
    .classList.toggle("active", isExport);
  document
    .getElementById("shareTabImport")
    .classList.toggle("active", !isExport);
  document.getElementById("sharePanelExport").style.display = isExport
    ? ""
    : "none";
  document.getElementById("sharePanelImport").style.display = isExport
    ? "none"
    : "";
  if (!isExport) {
    document.getElementById("shareJsonInput").value = "";
    document.getElementById("shareJsonError").style.display = "none";
    document.getElementById("shareImportBtn").disabled = true;
  }
}

/**
 * Copies the JSON export text to the clipboard.
 */
function copyShareJson() {
  const ta = document.getElementById("shareJsonOutput");
  ta.select();
  try {
    navigator.clipboard
      .writeText(ta.value)
      .catch(() => document.execCommand("copy"));
  } catch (e) {
    document.execCommand("copy");
  }
  const btn = document.getElementById("shareCopyBtn");
  btn.textContent = "Kopiert ✓";
  setTimeout(() => (btn.textContent = "Kopieren"), 2000);
}

/**
 * Downloads the current schedule as a JSON file.
 */
function downloadShareJson() {
  const blob = new Blob([document.getElementById("shareJsonOutput").value], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "stundenplan.json";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Stundenplan exportiert ✓", "success");
}

/**
 * Generates an iCalendar (ICS) string from the current schedule.
 * Includes static LVs and selected parallel groups as weekly recurring events.
 * @returns {string} Complete ICS file content
 */
function generateICalData() {
  const now = new Date();
  const dtStamp =
    now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  let ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TheoFailenschmid//stundenplan//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  const anchorDate = new Date();
  anchorDate.setDate(anchorDate.getDate() - (anchorDate.getDay() || 7) + 1);
  anchorDate.setHours(0, 0, 0, 0);

  const dayOffsets = { Mo: 0, Di: 1, Mi: 2, Do: 3, Fr: 4 };

  /**
   * Formats a Date as a YYYYMMDD string.
   * @param {Date} date - Date to format
   * @returns {string} Formatted date string
   */
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}${m}${d}`;
  };

  /**
   * Adds a VEVENT to the ICS output.
   * @param {string} name - Event summary
   * @param {string} day - Day abbreviation
   * @param {string} start - Start time "HH:MM"
   * @param {string} end - End time "HH:MM"
   * @param {string} room - Room/location
   */
  const addEvent = (name, day, start, end, room) => {
    if (dayOffsets[day] === undefined) return;

    const eventDate = new Date(anchorDate);
    eventDate.setDate(eventDate.getDate() + dayOffsets[day]);
    const dateStr = formatDate(eventDate);

    const formatTime = (t) => t.replace(":", "") + "00";

    const dtStart = dateStr + "T" + formatTime(start);
    const dtEnd = dateStr + "T" + formatTime(end);

    ics.push(
      "BEGIN:VEVENT",
      `UID:${nextId()}@stundenplan.local`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${name}`,
      `RRULE:FREQ=WEEKLY;COUNT=25`,
      room ? `LOCATION:${room}` : "",
      "END:VEVENT",
    );
  };

  modules.forEach((mod) => {
    mod.lvs.forEach((lv) => {
      if (lv.type === "static") {
        addEvent(
          `${mod.name} (${lv.name})`,
          lv.day,
          lv.startTime,
          lv.endTime,
          lv.room,
        );
      } else {
        lv.groups.forEach((pg) => {
          if (pg.selected) {
            addEvent(
              `${mod.name} (${lv.name} - ${pg.name})`,
              pg.day,
              pg.startTime,
              pg.endTime,
              pg.room,
            );
          }
        });
      }
    });
  });

  ics.push("END:VCALENDAR");
  return ics.filter(Boolean).join("\r\n");
}

/**
 * Downloads the current schedule as an iCal (.ics) file.
 */
function downloadShareICal() {
  if (modules.length === 0) {
    showToast("Keine Daten zum Exportieren", "error");
    return;
  }
  const icsData = generateICalData();
  const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "stundenplan.ics";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Stundenplan als iCal exportiert ✓", "success");
}

/**
 * Validates the JSON string in the import textarea and enables/disables the load button.
 */
function validateShareJson() {
  const raw = document.getElementById("shareJsonInput").value.trim();
  const errEl = document.getElementById("shareJsonError");
  const btn = document.getElementById("shareImportBtn");
  if (!raw) {
    errEl.style.display = "none";
    btn.disabled = true;
    return;
  }
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data.modules))
      throw new Error('Kein "modules"-Array gefunden');
    errEl.style.display = "none";
    btn.disabled = false;
  } catch (e) {
    errEl.textContent = "⚠ Ungültiges JSON: " + e.message;
    errEl.style.display = "block";
    btn.disabled = true;
  }
}

/**
 * Parses and applies the JSON from the import textarea.
 */
function applyShareJson() {
  const raw = document.getElementById("shareJsonInput").value.trim();
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data.modules)) throw new Error("Ungültiges Format");
    _applyImportedData(data);
  } catch (e) {
    showToast("Fehler: " + e.message, "error");
  }
}
