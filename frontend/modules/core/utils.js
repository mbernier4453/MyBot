/**
 * Utility Functions
 * Shared helper functions used across the application
 */

// ========================================
// FORMATTING UTILITIES
// ========================================

/**
 * Format a decimal value as a percentage
 * @param {number} value - Value to format (e.g., 0.15 for 15%)
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage string
 */
export function formatPercent(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return (value * 100).toFixed(decimals) + '%';
}

/**
 * Format a value already in percentage format (not decimal)
 * @param {number} value - Value to format (e.g., 15 for 15%)
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage string
 */
export function formatPercentAlready(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return Number(value).toFixed(decimals) + '%';
}

/**
 * Format a number with specific decimal places
 * @param {number} value - Value to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number string
 */
export function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return Number(value).toFixed(decimals);
}

/**
 * Format a large number with K/M/B suffixes
 * @param {number} value - Value to format
 * @returns {string} Formatted string with suffix
 */
export function formatLargeNumber(value) {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  
  if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
  if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
  if (value >= 1e3) return (value / 1e3).toFixed(2) + 'K';
  return value.toFixed(2);
}

/**
 * Format a date string to readable format
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

/**
 * Format a date string to readable format with time
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string with time
 */
export function formatDateTime(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ========================================
// UI COMPONENT CREATORS
// ========================================

/**
 * Create a metric card HTML element
 * @param {string} label - Metric label
 * @param {string} value - Metric value
 * @param {boolean|null} isPositive - Whether value is positive (for styling)
 * @returns {string} HTML string for metric card
 */
export function createMetricCard(label, value, isPositive = null) {
  let valueClass = '';
  if (isPositive !== null) {
    valueClass = isPositive ? 'positive' : 'negative';
  }
  
  return `
    <div class="metric-card">
      <div class="metric-label">${label}</div>
      <div class="metric-value ${valueClass}">${value}</div>
    </div>
  `;
}

/**
 * Create an info row HTML element
 * @param {string} label - Row label
 * @param {string} value - Row value
 * @returns {string} HTML string for info row
 */
export function createInfoRow(label, value) {
  return `
    <div class="info-row">
      <span class="info-label">${label}:</span>
      <span class="info-value">${value}</span>
    </div>
  `;
}

// ========================================
// ARRAY/OBJECT UTILITIES
// ========================================

/**
 * Sort an array of objects by a specific field
 * @param {Array} array - Array to sort
 * @param {string} field - Field name to sort by
 * @param {boolean} descending - Sort in descending order
 * @returns {Array} Sorted array
 */
export function sortByField(array, field, descending = true) {
  return array.sort((a, b) => {
    let aVal = a[field];
    let bVal = b[field];
    
    // Handle null/undefined values
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    // Numeric comparison
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return descending ? bVal - aVal : aVal - bVal;
    }
    
    // String comparison
    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();
    
    if (descending) {
      return bStr.localeCompare(aStr);
    } else {
      return aStr.localeCompare(bStr);
    }
  });
}

/**
 * Debounce a function call
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle a function call
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ========================================
// VALIDATION UTILITIES
// ========================================

/**
 * Check if a value is a valid number
 * @param {any} value - Value to check
 * @returns {boolean} True if valid number
 */
export function isValidNumber(value) {
  return value !== null && value !== undefined && !isNaN(Number(value));
}

/**
 * Check if a string is a valid ticker symbol
 * @param {string} ticker - Ticker to validate
 * @returns {boolean} True if valid ticker
 */
export function isValidTicker(ticker) {
  if (!ticker || typeof ticker !== 'string') return false;
  // Ticker should be 1-5 uppercase letters
  return /^[A-Z]{1,5}$/.test(ticker.toUpperCase());
}

/**
 * Parse comma-separated tickers
 * @param {string} input - Input string with tickers
 * @returns {Array<string>} Array of valid tickers
 */
export function parseTickers(input) {
  if (!input) return [];
  return input
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter(t => isValidTicker(t));
}

// ========================================
// STATUS MESSAGE UTILITY
// ========================================

/**
 * Set status message in the status bar
 * @param {string} message - Status message
 * @param {boolean} isError - Whether this is an error message
 */
export function setStatus(message, isError = false) {
  const statusText = document.getElementById('statusText');
  if (statusText) {
    statusText.textContent = message;
    statusText.style.color = isError ? 'var(--negative)' : 'var(--text-secondary)';
  }
}

// ========================================
// COLOR UTILITIES
// ========================================

/**
 * Get color for positive/negative value
 * @param {number} value - Value to check
 * @returns {string} CSS color value
 */
export function getValueColor(value) {
  if (value > 0) return 'var(--positive)';
  if (value < 0) return 'var(--negative)';
  return 'var(--text-primary)';
}

/**
 * Get CSS class for positive/negative value
 * @param {number} value - Value to check
 * @returns {string} CSS class name
 */
export function getValueClass(value) {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return '';
}

// ========================================
// CHART UTILITIES
// ========================================

/**
 * Add watermark to Plotly chart layout
 * @param {object} layout - Plotly layout object
 */
export function addWatermark(layout) {
  if (!layout.annotations) {
    layout.annotations = [];
  }
  layout.annotations.push({
    text: 'Alpharhythm',
    xref: 'paper',
    yref: 'paper',
    x: 0.5,
    y: 0.5,
    xanchor: 'center',
    yanchor: 'middle',
    showarrow: false,
    font: {
      size: 40,
      color: 'rgba(150, 150, 150, 0.1)',
      family: 'Arial Black, sans-serif'
    },
    captureevents: false,
    editable: false
  });
}
