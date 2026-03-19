/**
 * @file keybinds.js
 * Global keybind handlers.
 */

document.addEventListener('keydown', (e) => {
  // Ignore keybinds if user is typing in an input or textarea
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
    return;
  }

  // Ctrl / Cmd modifier keybinds
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 's') {
      e.preventDefault();
      openShareModal('export');
    }
  } else {
    // Single key keybinds
    if (e.key === 's') {
      toggleSidebar();
    } else if (e.key === 'o') {
      openOptimizerModal();
    } else if (e.key === 'l') {
      openShareModal('import');
    } else if (e.key === ',' || e.key === '.') {
      // Allow cycling through optimized variants when optimizer has completed
      if (typeof optimizerResult !== 'undefined' && optimizerResult && optimizerResult.topResults && optimizerResult.topResults.length > 1) {
        const delta = e.key === ',' ? -1 : 1;
        let newIdx = optimizerResult.currentIdx + delta;
        
        // Wrap around
        if (newIdx < 0) newIdx = optimizerResult.topResults.length - 1;
        if (newIdx >= optimizerResult.topResults.length) newIdx = 0;
        
        optimizerResult.currentIdx = newIdx;
        applyOptimalPlan(optimizerResult.topResults[newIdx].combo);
        
        const modal = document.getElementById('modalOptimize');
        if (modal && modal.classList.contains('open')) {
          renderOptimizerResultCard(newIdx);
        } else {
          if (typeof showToast === 'function') {
            showToast(`Variante ${newIdx + 1} von ${optimizerResult.topResults.length} angewendet`, 'success');
          }
        }
      }
    }
  }
});
