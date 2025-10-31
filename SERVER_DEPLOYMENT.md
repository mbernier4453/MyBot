# Server Deployment Guide - Version 1.0

This guide covers deploying the Alpharhythm web application to your server.

## Features in This Version
- **Home Page**: Real-time S&P 500 treemap with sector grouping
- **Charting**: Interactive price charts with technical indicators
- **Financials**: Company financial statements (Balance Sheet, Cash Flow, Income Statement)
- **RSI Dashboard**: RSI-based stock screener and analysis

## Prerequisites
- Ubuntu 20.04+ or similar Linux server
- Node.js 16+ and npm
- Domain name pointed to your server
- SSL certificate (Let's Encrypt)

## Server Setup

### 1. Install Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install nginx
sudo apt install -y nginx

# Install certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Clone Repository
```bash
cd /var/www
sudo git clone https://github.com/mbernier4453/MyBot.git alpharhythm
cd alpharhythm
sudo git checkout server-version
sudo chown -R $USER:$USER /var/www/alpharhythm
```

### 3. Configure Application

Create `.env` file in the root:
```bash
# Polygon.io API Key
POLYGON_API_KEY=your_polygon_api_key_here
```

Update `frontend/config.js`:
```javascript
window.APP_CONFIG = {
  POLYGON_API_KEY: 'your_polygon_api_key_here',
  // Add your domain
  API_BASE_URL: 'https://yourdomain.com'
};
```

### 4. Install Frontend Dependencies
```bash
cd frontend
npm install
```

### 5. Convert to Web Application

Since this is an Electron app, we need to serve it as a web application:

Create `frontend/server.js`:
```javascript
const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static(__dirname));

// Serve index.html for all routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Alpharhythm server running on port ${PORT}`);
});
```

Update `frontend/package.json` to add start script:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "electron ."
  }
}
```

Install express:
```bash
npm install express
```

### 6. Setup Nginx Reverse Proxy

Create `/etc/nginx/sites-available/alpharhythm`:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket support for real-time updates
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/alpharhythm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. Setup SSL with Let's Encrypt
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 8. Create Systemd Service

Create `/etc/systemd/system/alpharhythm.service`:
```ini
[Unit]
Description=Alpharhythm Web Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/alpharhythm/frontend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl enable alpharhythm
sudo systemctl start alpharhythm
sudo systemctl status alpharhythm
```

### 9. Setup Firewall
```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

## Monitoring

### View Application Logs
```bash
sudo journalctl -u alpharhythm -f
```

### View Nginx Logs
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Restart Services
```bash
# Restart application
sudo systemctl restart alpharhythm

# Restart nginx
sudo systemctl restart nginx
```

## Updating the Application

```bash
cd /var/www/alpharhythm
git pull origin server-version
cd frontend
npm install
sudo systemctl restart alpharhythm
```

## Troubleshooting

### Application won't start
```bash
# Check logs
sudo journalctl -u alpharhythm -n 50

# Check if port 3000 is in use
sudo netstat -tulpn | grep 3000

# Verify file permissions
ls -la /var/www/alpharhythm/frontend
```

### WebSocket connection issues
- Ensure nginx is configured with WebSocket support (see proxy_set_header Upgrade)
- Check firewall rules allow WebSocket connections
- Verify Polygon.io API key is correct

### SSL certificate issues
```bash
# Renew certificate
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

## Performance Optimization

### Enable Gzip Compression in Nginx
Add to nginx config:
```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
```

### Enable Browser Caching
Add to nginx location block:
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## Security Considerations

1. **API Key Protection**: Never expose your Polygon.io API key in client-side code
2. **HTTPS Only**: Always use SSL/TLS certificates
3. **Regular Updates**: Keep Node.js, npm, and system packages updated
4. **Rate Limiting**: Consider implementing rate limiting in nginx
5. **Backup**: Regularly backup your configuration files

## Support

For issues or questions:
- Check logs: `sudo journalctl -u alpharhythm`
- Verify nginx config: `sudo nginx -t`
- Test connectivity: `curl http://localhost:3000`
