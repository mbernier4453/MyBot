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
  // Skip maintenance for certain paths
  const excludedPaths = ['/health', '/api/health'];
  
  // Skip maintenance for static assets (JS, CSS, images, fonts, etc.)
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.csv'];
  const isStaticAsset = staticExtensions.some(ext => req.path.endsWith(ext));
  
  // Skip maintenance for API routes
  const isApiRoute = req.path.startsWith('/api/');
  
  if (excludedPaths.includes(req.path) || isStaticAsset || isApiRoute) {
    return next();
  }

  // Check if maintenance mode is enabled
  if (MAINTENANCE_MODE) {
    // Allow certain IPs to bypass
    const clientIP = req.ip || req.connection.remoteAddress;
    if (ALLOWED_IPS.includes(clientIP)) {
      return next();
    }

    // Serve maintenance page for HTML requests only
    const maintenancePath = path.join(__dirname, 'maintenance.html');
    return res.status(503).sendFile(maintenancePath);
  }

  next();
}

module.exports = maintenanceMiddleware;
