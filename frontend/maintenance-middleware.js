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
  console.log(`[MAINTENANCE] Request: ${req.method} ${req.path} - Mode: ${MAINTENANCE_MODE}`);
  
  // Skip maintenance for certain paths
  const excludedPaths = ['/health', '/api/health'];
  
  // Skip maintenance for static assets (JS, CSS, images, fonts, etc.)
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.csv', '.json'];
  const isStaticAsset = staticExtensions.some(ext => req.path.endsWith(ext));
  
  // Skip maintenance for API routes and WebSocket
  const isApiRoute = req.path.startsWith('/api/') || req.path.startsWith('/socket.io/');
  
  if (excludedPaths.includes(req.path) || isStaticAsset || isApiRoute) {
    console.log(`[MAINTENANCE] Skipping maintenance for ${req.path}`);
    return next();
  }

  // Check if maintenance mode is enabled
  if (MAINTENANCE_MODE) {
    console.log(`[MAINTENANCE] Serving maintenance page for ${req.path}`);

    // Allow certain IPs to bypass
    const clientIP = req.ip || req.connection.remoteAddress;
    if (ALLOWED_IPS.includes(clientIP)) {
      return next();
    }

    // Serve maintenance page for ALL HTML routes (/, /app, /auth.html, etc.)
    // This ensures refresh always shows maintenance
    const maintenancePath = path.join(__dirname, 'maintenance.html');
    return res.status(503).sendFile(maintenancePath);
  }

  next();
}

module.exports = maintenanceMiddleware;
