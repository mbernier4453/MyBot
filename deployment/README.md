# Production Deployment Structure

## Architecture Overview

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Browser   │────────▶│    Nginx    │────────▶│   Flask     │
│             │◀────────│  (Reverse   │◀────────│   Backend   │
│  (Frontend) │  HTTPS  │   Proxy)    │  HTTP   │  (Gunicorn) │
└─────────────┘         └─────────────┘         └─────────────┘
                              │                        │
                              │                        │
                              ▼                        ▼
                        ┌─────────────┐         ┌─────────────┐
                        │ Static Files│         │  Data Cache │
                        │  (Frontend) │         │  (Results)  │
                        └─────────────┘         └─────────────┘
```

## Domain Configuration

### Main Domain (Frontend)
- **URL**: `https://yourdomain.com`
- **Purpose**: Serves static frontend files
- **Server**: Nginx
- **Location**: `/var/www/backtester/frontend`

### API Subdomain (Backend)
- **URL**: `https://api.yourdomain.com`
- **Purpose**: REST API for backtesting operations
- **Server**: Nginx → Gunicorn → Flask
- **Service**: `backtester-api.service`

## Directory Structure on Server

```
/var/www/backtester/
├── backend/
│   ├── app.py              # Flask application
│   ├── config.py           # Configuration
│   ├── requirements.txt    # Python dependencies
│   ├── backtest/           # Backtesting engine
│   │   ├── engine.py
│   │   ├── indicators.py
│   │   ├── signals.py
│   │   └── ...
│   └── data/
│       ├── polygon_flatfiles.py
│       └── cache/          # Downloaded data cache
├── frontend/
│   ├── index.html
│   ├── config.js           # API endpoint config
│   ├── renderer.js
│   └── modules/
├── results/
│   ├── csv/               # Backtest metrics
│   ├── tearsheets/        # HTML reports
│   └── db/                # Database (when implemented)
├── venv/                  # Python virtual environment
├── .env                   # Environment variables (NOT in git)
└── deployment/
    ├── nginx.conf
    ├── backtester-api.service
    └── DEPLOYMENT_GUIDE.md
```

## File Locations

### Configuration Files
```
/etc/nginx/sites-available/backtester          # Nginx config
/etc/systemd/system/backtester-api.service     # Systemd service
/var/www/backtester/.env                       # Environment variables
```

### Log Files
```
/var/log/nginx/backtester_access.log           # Frontend access
/var/log/nginx/backtester_api_access.log       # API access
/var/log/nginx/backtester_error.log            # Nginx errors
/var/log/backtester/access.log                 # Gunicorn access
/var/log/backtester/error.log                  # Gunicorn errors
```

### SSL Certificates
```
/etc/letsencrypt/live/yourdomain.com/fullchain.pem
/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

## Service Management

### Backend Service
```bash
sudo systemctl start backtester-api     # Start
sudo systemctl stop backtester-api      # Stop
sudo systemctl restart backtester-api   # Restart
sudo systemctl status backtester-api    # Status
sudo systemctl enable backtester-api    # Enable on boot
sudo journalctl -u backtester-api -f    # Logs
```

### Nginx Service
```bash
sudo systemctl start nginx              # Start
sudo systemctl stop nginx               # Stop
sudo systemctl restart nginx            # Restart
sudo systemctl reload nginx             # Reload (no downtime)
sudo systemctl status nginx             # Status
sudo nginx -t                           # Test configuration
```

## Development vs Production

### Development (Local)
- Backend: `http://localhost:5000`
- Frontend: Open `frontend/index.html` or use local server
- Environment: `FLASK_ENV=development`, `FLASK_DEBUG=true`
- CORS: Allows localhost origins
- Authentication: Optional/disabled

### Production (Server)
- Backend: `https://api.yourdomain.com`
- Frontend: `https://yourdomain.com`
- Environment: `FLASK_ENV=production`, `FLASK_DEBUG=false`
- CORS: Only allows configured domains
- Authentication: Will be required (to be implemented)
- SSL: Required (Let's Encrypt)
- Server: Gunicorn with multiple workers

## API Endpoints

### Authentication (Placeholder)
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/verify` - Verify token

### Backtesting
- `POST /api/backtest/preview` - Preview strategy with signals
- `POST /api/backtest/run` - Execute full backtest
- `GET /api/backtest/results/<run_id>` - Get results
- `GET /api/backtest/history` - List all runs

### Data
- `GET /api/data/tickers` - Available symbols
- `GET /api/data/bars/<symbol>` - OHLCV data

### Files
- `GET /api/files/tearsheet/<filename>` - Tearsheet HTML
- `GET /api/files/csv/<filename>` - Metrics CSV

### Health
- `GET /api/health` - Service health check

## Environment Variables

Key variables in `.env`:

### Required
- `POLYGON_API_KEY` - Polygon/Massive API key
- `AWS_ACCESS_KEY_ID` - Massive.com S3 access
- `AWS_SECRET_ACCESS_KEY` - Massive.com S3 secret
- `FLASK_SECRET_KEY` - Session encryption (must be random)

### Important
- `FLASK_ENV` - `development` or `production`
- `FLASK_DEBUG` - `true` or `false`
- `CORS_ORIGINS` - Comma-separated allowed origins
- `FLASK_HOST` - `0.0.0.0` for production
- `FLASK_PORT` - `5000` (default)

## Security Checklist

- [ ] Strong `FLASK_SECRET_KEY` (generate with `secrets.token_hex(32)`)
- [ ] `FLASK_DEBUG=false` in production
- [ ] CORS limited to your domains only
- [ ] SSL certificates installed and auto-renewing
- [ ] Firewall configured (UFW)
- [ ] .env file not committed to git
- [ ] Regular backups configured
- [ ] Monitoring/health checks active
- [ ] Rate limiting configured (optional)

## Quick Commands

### Deploy/Update
```bash
cd /var/www/backtester
sudo -u www-data git pull
sudo -u www-data venv/bin/pip install -r backend/requirements.txt
sudo systemctl restart backtester-api
sudo systemctl reload nginx
```

### Check Status
```bash
# Services
sudo systemctl status backtester-api nginx

# Logs (real-time)
sudo journalctl -u backtester-api -f
sudo tail -f /var/log/nginx/backtester_api_access.log

# Test endpoints
curl https://api.yourdomain.com/api/health
```

### Generate Secret Key
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

## Next Steps

1. **Test Locally**: Run `start-dev.bat` (Windows) or `start-dev.sh` (Linux)
2. **Configure Domain**: Point DNS to your server IP
3. **Deploy**: Follow `deployment/DEPLOYMENT_GUIDE.md`
4. **SSL Setup**: Use Let's Encrypt for certificates
5. **Test Production**: Verify all endpoints work
6. **Implement Auth**: Add user registration/login (when ready)
7. **Monitor**: Set up health checks and alerts

## Support Resources

- [Flask Documentation](https://flask.palletsprojects.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Gunicorn Documentation](https://gunicorn.org/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Systemd Documentation](https://systemd.io/)
