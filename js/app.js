/**
 * @file Application bootstrap.
 * Loads persisted state, restores UI toggles, and renders the initial view.
 */

loadOptimizerPriorities();
load();

document
  .getElementById("filterAll")
  .classList.toggle("active", filter === "all");
document
  .getElementById("filterAvailable")
  .classList.toggle("active", filter === "available");
document
  .getElementById("filterSelected")
  .classList.toggle("active", filter === "selected");
document
  .getElementById("colorModeModule")
  .classList.toggle("active", colorMode === "module");
document
  .getElementById("colorModeType")
  .classList.toggle("active", colorMode === "type");

render();
