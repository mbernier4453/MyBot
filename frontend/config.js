/**
 * Frontend Configuration
 * API endpoint configuration for different environments
 */

// Determine environment based on hostname
const isProduction = window.location.hostname !== 'localhost' && 
                     window.location.hostname !== '127.0.0.1';

// API Configuration
const config = {
    // API Base URL
    API_BASE_URL: isProduction 
        ? 'https://api.yourdomain.com'  // Update with your domain
        : 'http://localhost:5000',
    
    // WebSocket URL (for future real-time features)
    WS_BASE_URL: isProduction
        ? 'wss://api.yourdomain.com'
        : 'ws://localhost:5000',
    
    // Environment
    ENV: isProduction ? 'production' : 'development',
    
    // Feature flags
    FEATURES: {
        AUTH_REQUIRED: false,  // Set to true when authentication is fully implemented
        WEBSOCKET_ENABLED: false,
        OFFLINE_MODE: false
    },
    
    // API endpoints
    ENDPOINTS: {
        // Auth
        LOGIN: '/api/auth/login',
        REGISTER: '/api/auth/register',
        VERIFY: '/api/auth/verify',
        
        // Backtest
        PREVIEW: '/api/backtest/preview',
        RUN: '/api/backtest/run',
        RESULTS: '/api/backtest/results',
        HISTORY: '/api/backtest/history',
        
        // Data
        TICKERS: '/api/data/tickers',
        BARS: '/api/data/bars',
        
        // Files
        TEARSHEET: '/api/files/tearsheet',
        CSV: '/api/files/csv'
    },
    
    // Timeout settings (ms)
    TIMEOUT: {
        API_REQUEST: 30000,
        BACKTEST: 120000,
        PREVIEW: 10000
    }
};

// Helper function to get full URL
config.getUrl = function(endpoint) {
    return this.API_BASE_URL + (this.ENDPOINTS[endpoint] || endpoint);
};

// Helper function for authenticated requests
config.getHeaders = function(includeAuth = false) {
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (includeAuth && this.FEATURES.AUTH_REQUIRED) {
        const token = localStorage.getItem('auth_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }
    
    return headers;
};

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
}
