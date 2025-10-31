# Quick Server Setup - Alpharhythm

## On Your Server (Ubuntu/Linux)

### 1. Initial Setup
```bash
# SSH into your server
ssh your_user@your_server_ip

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx

# Clone the repository
cd /var/www
sudo git clone https://github.com/mbernier4453/MyBot.git alpharhythm
cd alpharhythm
sudo git checkout server-version
sudo chown -R $USER:$USER /var/www/alpharhythm
```

### 2. Configure Environment
```bash
# Create .env file for backend (if needed later)
cat > .env << EOF
POLYGON_API_KEY=your_polygon_api_key_here
EOF

# Update frontend config
nano frontend/config.js
# Add your Polygon API key
```

### 3. Install Dependencies
```bash
cd frontend
npm install
```

### 4. Test Locally
```bash
# Test the application
npm run serve

# Visit http://your_server_ip:3000 in browser
# Press Ctrl+C to stop when done testing
```

### 5. Setup Nginx
```bash
# Create nginx config
sudo nano /etc/nginx/sites-available/alpharhythm
```

Paste this configuration (replace `yourdomain.com` with your actual domain):
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

### 6. Setup SSL (After DNS is pointed to your server)
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 7. Create System Service
```bash
sudo nano /etc/systemd/system/alpharhythm.service
```

Paste this:
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

Fix permissions and start:
```bash
sudo chown -R www-data:www-data /var/www/alpharhythm
sudo systemctl enable alpharhythm
sudo systemctl start alpharhythm
sudo systemctl status alpharhythm
```

### 8. Configure Firewall
```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status
```

## Verification Checklist

- [ ] DNS points to your server IP
- [ ] Application running: `sudo systemctl status alpharhythm`
- [ ] Nginx running: `sudo systemctl status nginx`
- [ ] Port 3000 open locally: `curl http://localhost:3000`
- [ ] Domain accessible: Visit `http://yourdomain.com`
- [ ] SSL certificate installed: `https://yourdomain.com`
- [ ] WebSocket working (check browser console)

## Common Commands

```bash
# View application logs
sudo journalctl -u alpharhythm -f

# Restart application
sudo systemctl restart alpharhythm

# Restart nginx
sudo systemctl restart nginx

# Check nginx config
sudo nginx -t

# Update application
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

# Check port
sudo netstat -tulpn | grep 3000

# Fix permissions
sudo chown -R www-data:www-data /var/www/alpharhythm
```

### Can't access from browser
```bash
# Check firewall
sudo ufw status

# Check nginx
sudo nginx -t
sudo systemctl status nginx

# Check application
curl http://localhost:3000
```

### WebSocket not connecting
- Verify Polygon.io API key in `frontend/config.js`
- Check browser console for errors
- Ensure nginx WebSocket proxy headers are configured

## What's Included

✅ **Home Page**: Real-time S&P 500 treemap with live price updates
✅ **Charting**: Interactive charts with technical indicators
✅ **Financials**: Company financial statements and metrics
✅ **RSI Dashboard**: RSI-based stock analysis and screening

## What's Not Included (Coming in Next Version)

- User authentication
- Backtesting engine
- Strategy builder
- Database storage
- Multi-user support

---

Need help? Check the full deployment guide: `SERVER_DEPLOYMENT.md`
