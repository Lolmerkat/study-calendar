/**
 * @file Global mutable application state.
 * Variables are declared with `let` so they can be reassigned from any module.
 */

/** @type {Array<Object>} All loaded modules with their LVs and groups */
let modules = [];

/** @type {'all'|'available'|'selected'} Current calendar filter mode */
let filter = "all";

/** @type {'module'|'type'} Current event coloring mode */
let colorMode = "module";

/** @type {number} Running index into the COLORS palette */
let colorIdx = 0;

/** @type {Object|null} Pending XHTML import data ({groups: PG[]}) */
let pendingImport = null;

/** @type {string|null} Module ID currently receiving a new LV */
let addingLvToModuleId = null;

/** @type {string[]} Temporary LV form IDs in the add-module modal */
let tempLvForms = [];
