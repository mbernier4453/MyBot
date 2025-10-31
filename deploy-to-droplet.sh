#!/bin/bash
# Deployment script for alpharhythm to DigitalOcean Droplet
# Server IP: 138.197.6.220

echo "🚀 Deploying alpharhythm to 138.197.6.220"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Install Node.js
echo -e "${YELLOW}Installing Node.js 18...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Step 2: Install Nginx
echo -e "${YELLOW}Installing Nginx...${NC}"
sudo apt install -y nginx

# Step 3: Clone repository
echo -e "${YELLOW}Cloning repository...${NC}"
cd /var/www
sudo git clone https://github.com/mbernier4453/MyBot.git alpharhythm
cd alpharhythm
sudo git checkout server-version
sudo chown -R $USER:$USER /var/www/alpharhythm

# Step 4: Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
cd frontend
npm install

# Step 5: Configure Nginx
echo -e "${YELLOW}Configuring Nginx...${NC}"
sudo tee /etc/nginx/sites-available/alpharhythm > /dev/null <<EOF
server {
    listen 80;
    server_name 138.197.6.220;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/alpharhythm /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# Step 6: Create systemd service
echo -e "${YELLOW}Creating systemd service...${NC}"
sudo tee /etc/systemd/system/alpharhythm.service > /dev/null <<EOF
[Unit]
Description=alpharhythm Web Application
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
EOF

# Step 7: Fix permissions
echo -e "${YELLOW}Setting permissions...${NC}"
sudo chown -R www-data:www-data /var/www/alpharhythm

# Step 8: Start service
echo -e "${YELLOW}Starting service...${NC}"
sudo systemctl daemon-reload
sudo systemctl enable alpharhythm
sudo systemctl start alpharhythm

# Step 9: Configure firewall
echo -e "${YELLOW}Configuring firewall...${NC}"
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw --force enable

# Step 10: Check status
echo -e "${GREEN}Deployment complete!${NC}"
echo ""
echo "Service status:"
sudo systemctl status alpharhythm --no-pager
echo ""
echo "Access your app at: http://138.197.6.220"
echo ""
echo "Useful commands:"
echo "  View logs: sudo journalctl -u alpharhythm -f"
echo "  Restart app: sudo systemctl restart alpharhythm"
echo "  Restart nginx: sudo systemctl restart nginx"
