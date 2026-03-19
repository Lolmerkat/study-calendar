/**
 * @file Application bootstrap.
 * Loads persisted state, restores UI toggles, and renders the initial view.
 */

loadOptimizerPriorities();
load();

document.getElementById("filterSelect").value = filter;
document.getElementById("colorModeSelect").value = colorMode;

render();
