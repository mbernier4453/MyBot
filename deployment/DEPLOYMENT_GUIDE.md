# Deployment Guide - Backtesting Application

## Overview
This guide covers deploying the backtesting application to a production server with:
- Flask backend API with gunicorn
- Static frontend served by nginx
- SSL/HTTPS with Let's Encrypt
- Systemd service management
- Authentication (to be implemented)

## Prerequisites

### Server Requirements
- Ubuntu 20.04+ or similar Linux distribution
- 2GB+ RAM
- 20GB+ disk space
- Python 3.9+
- Domain name pointing to server IP

### Required Software
```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-venv
sudo apt install -y nginx
sudo apt install -y certbot python3-certbot-nginx
sudo apt install -y git
```

## Step 1: Server Setup

### 1.1 Create Application User
```bash
# Create www-data directories if not exists
sudo mkdir -p /var/www
sudo chown www-data:www-data /var/www
```

### 1.2 Clone Repository
```bash
cd /var/www
sudo -u www-data git clone https://github.com/yourusername/backtester.git
cd backtester
```

### 1.3 Create Python Virtual Environment
```bash
sudo -u www-data python3 -m venv venv
sudo -u www-data venv/bin/pip install --upgrade pip
sudo -u www-data venv/bin/pip install -r backend/requirements.txt
```

## Step 2: Environment Configuration

### 2.1 Copy and Configure .env File
```bash
sudo -u www-data cp .env.example .env
sudo -u www-data nano .env
```

Update the following in `.env`:
```properties
# Set to production
FLASK_ENV=production
FLASK_DEBUG=false

# Generate secure secret key
# Run: python -c "import secrets; print(secrets.token_hex(32))"
FLASK_SECRET_KEY=your_generated_secret_key_here

# Update CORS with your domain
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Add your API keys
POLYGON_API_KEY=your_actual_key
AWS_ACCESS_KEY_ID=your_actual_key
AWS_SECRET_ACCESS_KEY=your_actual_key
```

### 2.2 Create Log Directory
```bash
sudo mkdir -p /var/log/backtester
sudo chown www-data:www-data /var/log/backtester
```

### 2.3 Set Permissions
```bash
sudo chown -R www-data:www-data /var/www/backtester
sudo chmod -R 755 /var/www/backtester
```

## Step 3: Frontend Configuration

### 3.1 Update Frontend Config
Edit `frontend/config.js`:
```javascript
// Update API_BASE_URL for production
API_BASE_URL: isProduction 
    ? 'https://api.yourdomain.com'  // Your actual API domain
    : 'http://localhost:5000',
```

### 3.2 Copy Frontend Files
```bash
# If using a build process, run it first
# Otherwise, frontend files are ready to serve as-is

sudo mkdir -p /var/www/backtester/frontend
sudo cp -r /var/www/backtester/frontend/* /var/www/backtester/frontend/
```

## Step 4: Nginx Configuration

### 4.1 Copy Nginx Config
```bash
sudo cp deployment/nginx.conf /etc/nginx/sites-available/backtester
```

### 4.2 Update Domain Names
Edit `/etc/nginx/sites-available/backtester`:
- Replace all instances of `yourdomain.com` with your actual domain
- Update SSL certificate paths

### 4.3 Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/backtester /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
```

## Step 5: SSL Certificate (Let's Encrypt)

### 5.1 Obtain Certificate
```bash
# For both main domain and API subdomain
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com
```

### 5.2 Auto-renewal
```bash
# Test renewal
sudo certbot renew --dry-run

# Cron job is automatically created by certbot
```

## Step 6: Systemd Service

### 6.1 Copy Service File
```bash
sudo cp deployment/backtester-api.service /etc/systemd/system/
```

### 6.2 Update Service File Paths
Edit `/etc/systemd/system/backtester-api.service` if your paths differ from `/var/www/backtester`

### 6.3 Enable and Start Service
```bash
sudo systemctl daemon-reload
sudo systemctl enable backtester-api
sudo systemctl start backtester-api
```

### 6.4 Check Service Status
```bash
sudo systemctl status backtester-api
sudo journalctl -u backtester-api -f  # Follow logs
```

## Step 7: Nginx Start

```bash
sudo systemctl restart nginx
sudo systemctl enable nginx  # Enable on boot
```

## Step 8: Firewall Configuration

```bash
# Allow HTTP, HTTPS, and SSH
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Step 9: Verification

### 9.1 Test Backend API
```bash
curl https://api.yourdomain.com/api/health
# Should return: {"status":"healthy",...}
```

### 9.2 Test Frontend
Open browser to `https://yourdomain.com`

### 9.3 Check Logs
```bash
# Nginx logs
sudo tail -f /var/log/nginx/backtester_access.log
sudo tail -f /var/log/nginx/backtester_api_access.log

# Application logs
sudo journalctl -u backtester-api -f

# Gunicorn logs
sudo tail -f /var/log/backtester/access.log
sudo tail -f /var/log/backtester/error.log
```

## Step 10: Database Setup (TODO)

When implementing authentication:
1. Choose database (PostgreSQL recommended)
2. Create database and user
3. Update .env with database connection string
4. Run migrations
5. Update API endpoints to use database

## Maintenance

### Update Application
```bash
cd /var/www/backtester
sudo -u www-data git pull origin main
sudo -u www-data venv/bin/pip install -r backend/requirements.txt
sudo systemctl restart backtester-api
sudo systemctl reload nginx
```

### View Logs
```bash
# Real-time application logs
sudo journalctl -u backtester-api -f

# Nginx access logs
sudo tail -f /var/log/nginx/backtester_api_access.log

# Nginx error logs
sudo tail -f /var/log/nginx/backtester_error.log
```

### Restart Services
```bash
# Restart backend
sudo systemctl restart backtester-api

# Reload nginx (no downtime)
sudo systemctl reload nginx

# Restart nginx
sudo systemctl restart nginx
```

### Check Service Health
```bash
sudo systemctl status backtester-api
sudo systemctl status nginx
```

## Security Considerations

### 1. Secret Key
- **CRITICAL**: Generate a strong, random secret key for production
- Never commit the production .env file to git

### 2. API Keys
- Store Polygon/Massive API keys securely
- Consider using AWS Secrets Manager or similar for production

### 3. Database Security
- When implementing authentication, use strong passwords
- Limit database user permissions
- Use SSL for database connections

### 4. Rate Limiting
Consider adding rate limiting to nginx:
```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req zone=api_limit burst=20 nodelay;
```

### 5. Backup
- Regular backups of database
- Backup results directory: `/var/www/backtester/results`
- Store backups off-server

## Monitoring

### Log Rotation
Create `/etc/logrotate.d/backtester`:
```
/var/log/backtester/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload backtester-api
    endscript
}
```

### Health Checks
Set up monitoring service to check:
- `https://api.yourdomain.com/api/health`
- `https://yourdomain.com`

## Troubleshooting

### Service Won't Start
```bash
# Check logs
sudo journalctl -u backtester-api -n 50

# Check if port is in use
sudo netstat -tulpn | grep 5000

# Test Flask directly
cd /var/www/backtester/backend
../venv/bin/python app.py
```

### 502 Bad Gateway
- Backend service not running: `sudo systemctl start backtester-api`
- Check backend logs: `sudo journalctl -u backtester-api -f`
- Verify gunicorn is listening: `sudo netstat -tulpn | grep 5000`

### CORS Errors
- Verify CORS_ORIGINS in .env matches frontend domain
- Check nginx CORS headers configuration
- Verify OPTIONS preflight requests succeed

### SSL Certificate Issues
```bash
# Renew certificate
sudo certbot renew

# Check certificate expiry
sudo certbot certificates
```

## Production Checklist

- [ ] .env configured with production settings
- [ ] FLASK_SECRET_KEY is strong and unique
- [ ] FLASK_DEBUG=false
- [ ] CORS_ORIGINS set to actual domain
- [ ] API keys configured
- [ ] SSL certificates obtained and working
- [ ] Firewall configured (ufw)
- [ ] Services enabled on boot
- [ ] Log rotation configured
- [ ] Monitoring/health checks set up
- [ ] Backup strategy implemented
- [ ] Domain DNS configured correctly
- [ ] Frontend config.js updated with production URLs

## Next Steps - Authentication

When ready to implement user authentication:

1. **Choose Database**: PostgreSQL, MySQL, or SQLite
2. **User Model**: Create user table with password hashing
3. **Registration**: Implement user registration with email verification
4. **Login**: Complete login endpoint with password validation
5. **JWT**: Ensure token generation/validation is secure
6. **Protected Routes**: Add @token_required to sensitive endpoints
7. **Frontend**: Implement login/register forms
8. **Session Management**: Handle token refresh and logout

## Support

For issues:
1. Check logs: `sudo journalctl -u backtester-api -f`
2. Verify service status: `sudo systemctl status backtester-api`
3. Test API directly: `curl https://api.yourdomain.com/api/health`
4. Check nginx config: `sudo nginx -t`
