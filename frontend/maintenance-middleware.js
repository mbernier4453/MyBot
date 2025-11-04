/**
 * Maintenance Mode Middleware
 * Place this in server.js to enable/disable maintenance mode
 */

const fs = require('fs');
const path = require('path');

// Toggle this to enable/disable maintenance mode
const MAINTENANCE_MODE = true;

// Optional: List of IP addresses that can bypass maintenance mode
const ALLOWED_IPS = [
  '127.0.0.1',
  '::1',
  // Add your IP here to access during maintenance
];

function maintenanceMiddleware(req, res, next) {
  // Skip maintenance for certain paths (like health checks)
  const excludedPaths = ['/health', '/api/health'];
  if (excludedPaths.includes(req.path)) {
    return next();
  }

  // Check if maintenance mode is enabled
  if (MAINTENANCE_MODE) {
    // Allow certain IPs to bypass
    const clientIP = req.ip || req.connection.remoteAddress;
    if (ALLOWED_IPS.includes(clientIP)) {
      return next();
    }

    // Serve maintenance page
    const maintenancePath = path.join(__dirname, 'maintenance.html');
    return res.status(503).sendFile(maintenancePath);
  }

  next();
}

module.exports = maintenanceMiddleware;
