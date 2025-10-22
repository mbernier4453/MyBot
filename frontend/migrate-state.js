// Migration script to replace state variables with State module
// Run with: node migrate-state.js

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'renderer.js');
let content = fs.readFileSync(filePath, 'utf8');

console.log('Starting state variable migration...');

// Step 1: Comment out old declarations
content = content.replace(
  /^let currentDb = null;$/m,
  '// let currentDb = null;  // → State.getCurrentDb() / State.setCurrentDb()'
);
content = content.replace(
  /^let currentRun = null;$/m,
  '// let currentRun = null;  // → State.getCurrentRun() / State.setCurrentRun()'
);
content = content.replace(
  /^let allRuns = \[\];$/m,
  '// let allRuns = [];  // → State.getAllRuns() / State.setAllRuns()'
);
content = content.replace(
  /^let selectedRuns = new Set\(\);$/m,
  '// let selectedRuns = new Set();  // → State.getSelectedRuns() / State.setSelectedRuns()'
);
content = content.replace(
  /^let currentStrategies = \[\];$/m,
  '// let currentStrategies = [];  // → State.getCurrentStrategies() / State.setCurrentStrategies()'
);

// Step 2: Replace assignments (write operations)
// currentDb = x  →  State.setCurrentDb(x)
content = content.replace(/\bcurrentDb\s*=\s*([^;]+);/g, 'State.setCurrentDb($1);');

// currentRun = x  →  State.setCurrentRun(x)
content = content.replace(/\bcurrentRun\s*=\s*([^;]+);/g, 'State.setCurrentRun($1);');

// allRuns = x  →  State.setAllRuns(x)
content = content.replace(/\ballRuns\s*=\s*([^;]+);/g, 'State.setAllRuns($1);');

// currentStrategies = x  →  State.setCurrentStrategies(x)
content = content.replace(/\bcurrentStrategies\s*=\s*([^;]+);/g, 'State.setCurrentStrategies($1);');

// Step 3: Replace reads (read operations)
// allRuns.method()  →  State.getAllRuns().method()
content = content.replace(/\ballRuns\./g, 'State.getAllRuns().');
content = content.replace(/\ballRuns\[/g, 'State.getAllRuns()[');

// currentRun.property  →  State.getCurrentRun().property
content = content.replace(/\bcurrentRun\./g, 'State.getCurrentRun().');
content = content.replace(/\bcurrentRun\b(?![.(\[])/g, 'State.getCurrentRun()');

// selectedRuns.method()  →  State.getSelectedRuns().method()
content = content.replace(/\bselectedRuns\./g, 'State.getSelectedRuns().');

// currentStrategies.method()  →  State.getCurrentStrategies().method()
content = content.replace(/\bcurrentStrategies\./g, 'State.getCurrentStrategies().');
content = content.replace(/\bcurrentStrategies\[/g, 'State.getCurrentStrategies()[');

// Step 4: Fix double-sets that got created (State.setCurrentRun() = x should stay as is)
content = content.replace(/State\.(set\w+)\(\)\s*=\s*/g, '$1() call is invalid - ');

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Migration complete!');
console.log('Please test the app and verify everything works.');
