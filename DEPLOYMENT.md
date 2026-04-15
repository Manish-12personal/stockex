# stockex VPS Deployment Guide
## Domain: stockex.com | Hostinger VPS

---

## Prerequisites
- Fresh Ubuntu 22.04 VPS from Hostinger
- Domain stockex.com pointed to your VPS IP
- SSH access to your VPS

---

## Step 1: Connect to VPS via SSH

```bash
ssh root@YOUR_VPS_IP
```

---

## Step 2: Update System & Install Dependencies

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify installation
node -v  # Should show v20.x.x
npm -v
```

---

## Step 3: Install MongoDB

```bash
# Import MongoDB GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install MongoDB
apt update
apt install -y mongodb-org

# Start and enable MongoDB
systemctl start mongod
systemctl enable mongod

# Verify MongoDB is running
systemctl status mongod
```

---

## Step 4: Install Nginx & PM2

```bash
# Install Nginx
apt install -y nginx

# Install PM2 globally
npm install -g pm2

# Install Certbot for SSL
apt install -y certbot python3-certbot-nginx
```

---

## Step 5: Clone Project

```bash
# Create directory
mkdir -p /var/www
cd /var/www

# Clone from GitHub
git clone https://github.com/shivammacoss/stockex.liv.git stockex
cd stockex

# Install all dependencies
npm run install-all
```

---

## Step 6: Configure Environment

```bash
# Copy production env template
cp server/.env.production server/.env

# Edit the .env file
nano server/.env
```

**Update these values in server/.env:**
```env
NODE_ENV=production
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/stockex
JWT_SECRET=CHANGE_THIS_TO_A_SECURE_RANDOM_STRING_64_CHARS
FRONTEND_URL=https://stockex.com
CORS_ORIGIN=https://stockex.com
```

**Generate a secure JWT secret:**
```bash
openssl rand -hex 32
```

---

## Step 7: Build Frontend

```bash
cd /var/www/stockex/client
npm run build
cd ..
```

---

## Step 8: Configure Nginx (Before SSL)

First, create a basic HTTP config to get SSL certificate:

```bash
# Create Nginx config
nano /etc/nginx/sites-available/stockex.com
```

**Paste this initial config (HTTP only for certbot):**
```nginx
server {
    listen 80;
    server_name stockex.com www.stockex.com;

    root /var/www/stockex/client/dist;
    index index.html;

    location /api {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
# Enable the site
ln -s /etc/nginx/sites-available/stockex.com /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# Test and reload
nginx -t
systemctl reload nginx
```

---

## Step 9: Get SSL Certificate

```bash
# Get SSL certificate from Let's Encrypt
certbot --nginx -d stockex.com -d www.stockex.com

# Follow the prompts:
# - Enter email
# - Agree to terms
# - Choose to redirect HTTP to HTTPS (option 2)
```

---

## Step 10: Update Nginx for WebSocket Support

After SSL is configured, update the config:

```bash
nano /etc/nginx/sites-available/stockex.com
```

**Replace with full config:**
```nginx
server {
    listen 80;
    server_name stockex.com www.stockex.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name stockex.com www.stockex.com;

    ssl_certificate /etc/letsencrypt/live/stockex.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/stockex.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    root /var/www/stockex/client/dist;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # API proxy
    location /api {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Socket.IO WebSocket
    location /socket.io {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    # React Router
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
nginx -t
systemctl reload nginx
```

---

## Step 11: Start Application with PM2

```bash
cd /var/www/stockex

# Start the server
pm2 start ecosystem.config.cjs

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Run the command it outputs

# Check status
pm2 status
pm2 logs
```

---

## Step 12: Seed Initial Data

```bash
cd /var/www/stockex/server

# Run seed script to create Super Admin
node seed.js
```

---

## Step 13: Configure Firewall (Optional but Recommended)

```bash
# Allow SSH, HTTP, HTTPS
ufw allow ssh
ufw allow http
ufw allow https
ufw enable
```

---

## Useful Commands

```bash
# View logs
pm2 logs stockex-api

# Restart server
pm2 restart stockex-api

# Rebuild frontend after changes
cd /var/www/stockex/client && npm run build

# Pull latest code
cd /var/www/stockex && git pull origin main

# Full redeploy
cd /var/www/stockex
git pull origin main
npm run install-all
cd client && npm run build && cd ..
pm2 restart stockex-api

# MongoDB shell
mongosh stockex

# Check Nginx errors
tail -f /var/log/nginx/error.log

# Renew SSL (auto-renews, but manual if needed)
certbot renew
```

---

## Troubleshooting

### 502 Bad Gateway
- Check if Node.js server is running: `pm2 status`
- Check server logs: `pm2 logs`
- Verify port 5001 is listening: `netstat -tlnp | grep 5001`

### MongoDB Connection Error
- Check MongoDB status: `systemctl status mongod`
- Start MongoDB: `systemctl start mongod`

### SSL Certificate Issues
- Renew certificate: `certbot renew`
- Check certificate: `certbot certificates`

### WebSocket Not Connecting
- Ensure Nginx has WebSocket config
- Check browser console for errors
- Verify Socket.IO location block in Nginx

---

## Domain DNS Settings (Hostinger)

Point your domain to VPS:
```
Type: A
Name: @
Value: YOUR_VPS_IP
TTL: 3600

Type: A  
Name: www
Value: YOUR_VPS_IP
TTL: 3600
```

---

## Default Login

After running seed.js:
- **Super Admin**: `superadmin` / PIN: `1234`
- **Demo Admin**: `demoadmin` / PIN: `1234`

---

**Your app will be live at: https://stockex.com**
