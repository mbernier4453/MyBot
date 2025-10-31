# Deploy to Your DigitalOcean Droplet
**Server IP:** 138.197.6.220

## Quick Commands - Copy & Paste

### 1. Connect to Your Droplet
```bash
ssh root@138.197.6.220
```

### 2. Install Node.js and Nginx (One Command)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt install -y nodejs nginx git
```

### 3. Clone and Setup Application
```bash
cd /var/www && \
git clone https://github.com/mbernier4453/MyBot.git alpharhythm && \
cd alpharhythm && \
git checkout server-version && \
cd frontend && \
npm install
```

### 4. Create Nginx Configuration
```bash
sudo tee /etc/nginx/sites-available/alpharhythm > /dev/null <<'EOF'
server {
    listen 80;
    server_name 138.197.6.220;

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
EOF
```

### 5. Enable Nginx Site
```bash
sudo ln -sf /etc/nginx/sites-available/alpharhythm /etc/nginx/sites-enabled/ && \
sudo rm -f /etc/nginx/sites-enabled/default && \
sudo nginx -t && \
sudo systemctl restart nginx
```

### 6. Create Systemd Service
```bash
sudo tee /etc/systemd/system/alpharhythm.service > /dev/null <<'EOF'
[Unit]
Description=alpharhythm Web Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/alpharhythm/frontend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
```

### 7. Start the Service
```bash
sudo systemctl daemon-reload && \
sudo systemctl enable alpharhythm && \
sudo systemctl start alpharhythm
```

### 8. Open Firewall
```bash
sudo ufw allow 'Nginx Full' && \
sudo ufw allow OpenSSH && \
sudo ufw --force enable
```

### 9. Check Status
```bash
sudo systemctl status alpharhythm
```

---

## 🎉 Done! Access Your App

**Open in browser:** http://138.197.6.220

---

## Useful Commands

### View Live Logs
```bash
sudo journalctl -u alpharhythm -f
```

### Restart Application
```bash
sudo systemctl restart alpharhythm
```

### Restart Nginx
```bash
sudo systemctl restart nginx
```

### Update Application
```bash
cd /var/www/alpharhythm && \
git pull origin server-version && \
cd frontend && \
npm install && \
sudo systemctl restart alpharhythm
```

### Check if Port 3000 is Running
```bash
curl http://localhost:3000
```

### Check Nginx Status
```bash
sudo systemctl status nginx
sudo nginx -t
```

---

## Troubleshooting

### Application Not Starting
```bash
# Check logs
sudo journalctl -u alpharhythm -n 50

# Check if port 3000 is in use
sudo netstat -tulpn | grep 3000

# Try running manually
cd /var/www/alpharhythm/frontend
node server.js
```

### Can't Access from Browser
```bash
# Check firewall
sudo ufw status

# Check if nginx is running
sudo systemctl status nginx

# Check application is running
sudo systemctl status alpharhythm

# Test locally
curl http://localhost:3000
curl http://138.197.6.220
```

### Update Not Working
```bash
# Force pull latest changes
cd /var/www/alpharhythm
git fetch origin
git reset --hard origin/server-version
cd frontend
npm install
sudo systemctl restart alpharhythm
```

---

## Add a Domain Later

If you want to use a domain like `alpharhythm.com`:

1. Point your domain A record to: `138.197.6.220`

2. Update Nginx config:
```bash
sudo nano /etc/nginx/sites-available/alpharhythm
# Change: server_name 138.197.6.220;
# To: server_name alpharhythm.com www.alpharhythm.com;
```

3. Setup SSL:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d alpharhythm.com -d www.alpharhythm.com
```

4. Restart Nginx:
```bash
sudo systemctl restart nginx
```
