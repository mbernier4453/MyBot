/**
 * Debug Logger for Electron App
 * Captures console output from both main and renderer processes
 * Writes to timestamped log files for debugging
 */

const fs = require('fs');
const path = require('path');

class DebugLogger {
  constructor(logsDir = './logs') {
    this.logsDir = logsDir;
    this.mainLogFile = path.join(logsDir, 'main-process.log');
    this.rendererLogFile = path.join(logsDir, 'renderer-process.log');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Clear old logs on startup
    this.clearLogs();
    
    this.setupMainProcessLogging();
  }

  clearLogs() {
    try {
      if (fs.existsSync(this.mainLogFile)) {
        fs.unlinkSync(this.mainLogFile);
      }
      if (fs.existsSync(this.rendererLogFile)) {
        fs.unlinkSync(this.rendererLogFile);
      }
    } catch (err) {
      // Ignore errors during cleanup
    }
  }

  setupMainProcessLogging() {
    // Intercept console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    console.log = (...args) => {
      try {
        originalLog(...args);
        this.writeToFile(this.mainLogFile, '[LOG]', args);
      } catch (err) {
        originalLog('[LOGGER ERROR]', err.message);
      }
    };

    console.error = (...args) => {
      try {
        originalError(...args);
        this.writeToFile(this.mainLogFile, '[ERROR]', args);
      } catch (err) {
        originalError('[LOGGER ERROR]', err.message);
      }
    };

    console.warn = (...args) => {
      try {
        originalWarn(...args);
        this.writeToFile(this.mainLogFile, '[WARN]', args);
      } catch (err) {
        originalWarn('[LOGGER ERROR]', err.message);
      }
    };

    console.info = (...args) => {
      try {
        originalInfo(...args);
        this.writeToFile(this.mainLogFile, '[INFO]', args);
      } catch (err) {
        originalInfo('[LOGGER ERROR]', err.message);
      }
    };
  }

  writeToFile(filePath, level, args) {
    try {
      const timestamp = new Date().toISOString();
      const message = args.map(arg => {
        if (typeof arg === 'string') return arg;
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }).join(' ');

      const logLine = `${timestamp} ${level} ${message}\n`;
      fs.appendFileSync(filePath, logLine);
    } catch (err) {
      // Silently fail to avoid infinite loops
    }
  }

  setupRendererLogging(mainWindow) {
    // Create IPC handler for renderer process logs
    // ipcMain should already be available from require('electron') in main.js
    try {
      const { ipcMain } = require('electron');
      
      ipcMain.on('renderer-log', (event, { level, message }) => {
        const timestamp = new Date().toISOString();
        const logLine = `${timestamp} [${level}] ${message}\n`;
        try {
          fs.appendFileSync(this.rendererLogFile, logLine);
        } catch (err) {
          // Silently fail
        }
      });
    } catch (err) {
      // If ipcMain setup fails, just continue
      console.error('[DEBUG-LOGGER] Failed to setup renderer logging:', err.message);
    }
  }

  getMainLogs() {
    try {
      if (fs.existsSync(this.mainLogFile)) {
        return fs.readFileSync(this.mainLogFile, 'utf-8');
      }
    } catch (err) {
      return `Error reading logs: ${err.message}`;
    }
    return '';
  }

  getRendererLogs() {
    try {
      if (fs.existsSync(this.rendererLogFile)) {
        return fs.readFileSync(this.rendererLogFile, 'utf-8');
      }
    } catch (err) {
      return `Error reading logs: ${err.message}`;
    }
    return '';
  }

  getAllLogs() {
    return {
      main: this.getMainLogs(),
      renderer: this.getRendererLogs()
    };
  }
}

module.exports = DebugLogger;