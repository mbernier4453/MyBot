# Manual Deployment Steps

## Step 1: SSH into your droplet
```bash
ssh root@138.197.6.220
```

## Step 2: Clone the repository
```bash
cd /var/www
git clone https://github.com/mbernier4453/MyBot.git alpharhythm
cd alpharhythm
git checkout server-version
```

If the repository is private and you get an authentication error, you have two options:

### Option A: Use a Personal Access Token
1. Go to GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with `repo` scope
3. Use this command instead:
```bash
git clone https://<YOUR_TOKEN>@github.com/mbernier4453/MyBot.git alpharhythm
```

### Option B: Make the repo public temporarily
1. Go to your repo on GitHub: https://github.com/mbernier4453/MyBot
2. Settings → Danger Zone → Change visibility → Public
3. Clone as above
4. Change back to private after deployment

## Step 3: Install dependencies
```bash
cd /var/www/alpharhythm/frontend
npm install
```

## Step 4: Configure Nginx
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

sudo ln -sf /etc/nginx/sites-available/alpharhythm /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## Step 5: Create systemd service
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

## Step 6: Start the service
```bash
sudo systemctl daemon-reload
sudo systemctl enable alpharhythm
sudo systemctl start alpharhythm
```

## Step 7: Configure firewall
```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw --force enable
```

## Step 8: Check status
```bash
sudo systemctl status alpharhythm
```

## Done! 
Visit: http://138.197.6.220

---

## Useful Commands

```bash
# View live logs
sudo journalctl -u alpharhythm -f

# Restart app
sudo systemctl restart alpharhythm

# Check if running locally
curl http://localhost:3000

# Check nginx status
sudo systemctl status nginx
```
