#!/bin/bash
# Complete deployment script for alpharhythm on 138.197.6.220
# Run this on your droplet: bash deploy.sh

set -e  # Exit on error

echo "🚀 Starting alpharhythm deployment..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Clone repository (you may need to enter GitHub credentials if repo is private)
echo -e "${YELLOW}📥 Cloning repository...${NC}"
cd /var/www
if [ -d "alpharhythm" ]; then
    echo "Repository already exists, pulling latest..."
    cd alpharhythm
    git pull origin server-version
else
    git clone https://github.com/mbernier4453/MyBot.git alpharhythm
    cd alpharhythm
    git checkout server-version
fi

# 2. Install Node.js dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
cd frontend
npm install

# 3. Configure Nginx
echo -e "${YELLOW}⚙️ Configuring Nginx...${NC}"
cat > /tmp/alpharhythm-nginx.conf << 'NGINXCONF'
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
NGINXCONF

sudo mv /tmp/alpharhythm-nginx.conf /etc/nginx/sites-available/alpharhythm
sudo ln -sf /etc/nginx/sites-available/alpharhythm /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and restart nginx
echo -e "${YELLOW}🔍 Testing Nginx configuration...${NC}"
sudo nginx -t
sudo systemctl restart nginx

# 4. Create systemd service
echo -e "${YELLOW}🔧 Creating systemd service...${NC}"
cat > /tmp/alpharhythm.service << 'SERVICECONF'
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
SERVICECONF

sudo mv /tmp/alpharhythm.service /etc/systemd/system/alpharhythm.service

# 5. Start service
echo -e "${YELLOW}🚀 Starting alpharhythm service...${NC}"
sudo systemctl daemon-reload
sudo systemctl enable alpharhythm
sudo systemctl restart alpharhythm

# 6. Configure firewall
echo -e "${YELLOW}🔒 Configuring firewall...${NC}"
sudo ufw allow 'Nginx Full' 2>/dev/null || true
sudo ufw allow OpenSSH 2>/dev/null || true
sudo ufw --force enable 2>/dev/null || true

# 7. Check status
echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "📊 Service Status:"
sudo systemctl status alpharhythm --no-pager -l | head -20
echo ""
echo -e "${GREEN}🌐 Access your app at: http://138.197.6.220${NC}"
echo ""
echo "📝 Useful commands:"
echo "  View logs: sudo journalctl -u alpharhythm -f"
echo "  Restart:   sudo systemctl restart alpharhythm"
echo "  Stop:      sudo systemctl stop alpharhythm"
echo "  Status:    sudo systemctl status alpharhythm"
