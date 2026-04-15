#!/bin/bash

# stockex VPS Deployment Script for Hostinger
# Domain: stockex.com

set -e

echo "=========================================="
echo "  stockex VPS Deployment Script"
echo "  Domain: stockex.com"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Update system
echo -e "${YELLOW}[1/10] Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
echo -e "${YELLOW}[2/10] Installing Node.js 20.x...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node.js installation
node -v
npm -v

# Install MongoDB
echo -e "${YELLOW}[3/10] Installing MongoDB...${NC}"
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# Install Nginx
echo -e "${YELLOW}[4/10] Installing Nginx...${NC}"
sudo apt install -y nginx

# Install PM2 globally
echo -e "${YELLOW}[5/10] Installing PM2...${NC}"
sudo npm install -g pm2

# Install Certbot for SSL
echo -e "${YELLOW}[6/10] Installing Certbot for SSL...${NC}"
sudo apt install -y certbot python3-certbot-nginx

# Create app directory
echo -e "${YELLOW}[7/10] Setting up application directory...${NC}"
sudo mkdir -p /var/www/stockex
sudo chown -R $USER:$USER /var/www/stockex

# Clone or copy project
echo -e "${YELLOW}[8/10] Cloning project from GitHub...${NC}"
cd /var/www
if [ -d "stockex" ]; then
    cd stockex
    git pull origin main
else
    git clone https://github.com/shivammacoss/stockex.liv.git stockex
    cd stockex
fi

# Install dependencies
echo -e "${YELLOW}[9/10] Installing dependencies...${NC}"
npm run install-all

# Build frontend
echo -e "${YELLOW}[10/10] Building frontend...${NC}"
cd client
npm run build
cd ..

echo -e "${GREEN}=========================================="
echo "  Base installation complete!"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Configure server/.env file"
echo "2. Setup Nginx configuration"
echo "3. Get SSL certificate"
echo "4. Start the application"
echo ""
echo "Run these commands manually:"
echo ""
echo -e "${YELLOW}# 1. Edit server environment file:${NC}"
echo "nano /var/www/stockex/server/.env"
echo ""
echo -e "${YELLOW}# 2. Copy Nginx config:${NC}"
echo "sudo cp /var/www/stockex/nginx.conf /etc/nginx/sites-available/stockex.com"
echo "sudo ln -s /etc/nginx/sites-available/stockex.com /etc/nginx/sites-enabled/"
echo "sudo rm /etc/nginx/sites-enabled/default"
echo ""
echo -e "${YELLOW}# 3. Get SSL certificate (run BEFORE enabling SSL in nginx):${NC}"
echo "sudo certbot --nginx -d stockex.com -d www.stockex.com"
echo ""
echo -e "${YELLOW}# 4. Test and reload Nginx:${NC}"
echo "sudo nginx -t"
echo "sudo systemctl reload nginx"
echo ""
echo -e "${YELLOW}# 5. Start application with PM2:${NC}"
echo "cd /var/www/stockex"
echo "pm2 start ecosystem.config.cjs   # app name: stockex-api"
echo "pm2 save"
echo "pm2 startup"
echo ""
echo -e "${GREEN}Done! Your app should be live at https://stockex.com${NC}"
