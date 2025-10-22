#!/usr/bin/env node

/**
 * Debug Check Script
 * Reads logs from the app and checks for errors
 * Usage: node debug-check.js [main|renderer|all]
 */

const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, 'logs');
const mainLogFile = path.join(logsDir, 'main-process.log');
const rendererLogFile = path.join(logsDir, 'renderer-process.log');

function readLog(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return '';
    }
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    return `Error reading log: ${err.message}`;
  }
}

function parseErrors(logContent, processName) {
  const lines = logContent.split('\n');
  const errors = lines.filter(line => 
    line.includes('[ERROR]') || line.includes('[WARN]') || line.includes('Error') || line.includes('error')
  );
  
  if (errors.length === 0) {
    console.log(`✓ ${processName}: No errors found`);
    return [];
  }
  
  console.log(`✗ ${processName}: Found ${errors.length} error(s):`);
  errors.forEach((err, i) => {
    console.log(`  ${i + 1}. ${err.substring(0, 150)}`);
    if (err.length > 150) console.log(`     ...`);
  });
  
  return errors;
}

function main() {
  const type = process.argv[2] || 'all';
  
  console.log('\n=== ELECTRON APP DEBUG CHECK ===\n');
  
  let allErrors = [];
  
  if (type === 'main' || type === 'all') {
    console.log('--- MAIN PROCESS LOG ---');
    const mainLog = readLog(mainLogFile);
    if (!mainLog) {
      console.log('⚠ Main process log is empty (app may not have started)');
    } else {
      allErrors = allErrors.concat(parseErrors(mainLog, 'Main Process'));
    }
    console.log();
  }
  
  if (type === 'renderer' || type === 'all') {
    console.log('--- RENDERER PROCESS LOG ---');
    const rendererLog = readLog(rendererLogFile);
    if (!rendererLog) {
      console.log('⚠ Renderer process log is empty');
    } else {
      allErrors = allErrors.concat(parseErrors(rendererLog, 'Renderer Process'));
    }
    console.log();
  }
  
  if (allErrors.length === 0) {
    console.log('✓ All systems operational! No errors detected.\n');
    process.exit(0);
  } else {
    console.log(`\n✗ Found ${allErrors.length} total error(s). Check logs above.\n`);
    process.exit(1);
  }
}

main();