# Deploy alpharhythm to 138.197.6.220

## ✅ What's Already Done
- Node.js 18 installed
- Nginx installed  
- Git installed

## 🚀 Deploy Now (Choose One Method)

### Method 1: Automated (Recommended)
Run this from your local machine (Windows PowerShell):
```powershell
cd C:\Users\mabso\MyBot
.\deploy.ps1
```
Enter your droplet password when prompted.

---

### Method 2: Manual Steps on Server

1. **SSH into your droplet:**
```bash
ssh root@138.197.6.220
```

2. **Download and run the deployment script:**
```bash
cd /tmp
wget https://raw.githubusercontent.com/mbernier4453/MyBot/server-version/deploy.sh
chmod +x deploy.sh
bash deploy.sh
```

---

### Method 3: Copy/Paste Commands

SSH into your server and run these commands one by one:

```bash
# 1. Clone repository
cd /var/www
git clone https://github.com/mbernier4453/MyBot.git alpharhythm
cd alpharhythm
git checkout server-version

# 2. Install dependencies
cd frontend
npm install

# 3. Configure Nginx
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

sudo ln -sf /etc/nginx/sites-available/alpharhythm /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# 4. Create service
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

# 5. Start service
sudo systemctl daemon-reload
sudo systemctl enable alpharhythm
sudo systemctl start alpharhythm

# 6. Configure firewall
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw --force enable

# 7. Check status
sudo systemctl status alpharhythm
```

---

## 🎉 Done!

Visit: **http://138.197.6.220**

---

## 📝 Useful Commands

```bash
# View live logs
sudo journalctl -u alpharhythm -f

# Restart application
sudo systemctl restart alpharhythm

# Stop application
sudo systemctl stop alpharhythm

# Check status
sudo systemctl status alpharhythm

# Check if app is running
curl http://localhost:3000
```

---

## 🔧 Troubleshooting

### App won't start?
```bash
# Check logs
sudo journalctl -u alpharhythm -n 50

# Try running manually to see errors
cd /var/www/alpharhythm/frontend
node server.js
```

### Can't access from browser?
```bash
# Check if running locally
curl http://localhost:3000

# Check firewall
sudo ufw status

# Check nginx
sudo systemctl status nginx
```

### Need to update?
```bash
cd /var/www/alpharhythm
git pull origin server-version
cd frontend
npm install
sudo systemctl restart alpharhythm
```
