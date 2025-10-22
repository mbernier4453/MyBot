/**
 * Formatting Utilities Module
 * Common formatting functions for numbers, percentages, and HTML
 */

/**
 * Format a decimal value as a percentage
 * @param {number} value - Decimal value (e.g., 0.15 for 15%)
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage string
 */
export function formatPercent(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return (value * 100).toFixed(decimals) + '%';
}

/**
 * Format a value already in percentage format (not decimal)
 * @param {number} value - Percentage value (e.g., 15 for 15%)
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage string
 */
export function formatPercentAlready(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return Number(value).toFixed(decimals) + '%';
}

/**
 * Format a number with specified decimal places
 * @param {number} value - Number to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number string
 */
export function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return Number(value).toFixed(decimals);
}

/**
 * Display a status message in the UI
 * @param {string} message - Message to display
 * @param {boolean} isError - Whether this is an error message
 */
export function setStatus(message, isError = false) {
  const statusText = document.getElementById('statusText');
  if (statusText) {
    statusText.textContent = message;
    statusText.style.color = isError ? 'var(--negative)' : 'var(--text-secondary)';
  }
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML string
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Export all as a single object for convenience
const Formatters = {
  formatPercent,
  formatPercentAlready,
  formatNumber,
  setStatus,
  escapeHtml
};

export default Formatters;

// Expose to window for backward compatibility
window.formatPercent = formatPercent;
window.formatPercentAlready = formatPercentAlready;
window.formatNumber = formatNumber;
window.setStatus = setStatus;
window.escapeHtml = escapeHtml;
