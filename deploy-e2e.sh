#!/bin/bash
# Billova POS - E2E Server Deployment Script
# Run this on your Ubuntu server

set -e

echo "🚀 Starting Billova POS Deployment..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
    echo "Docker installed. Please logout and login again, then re-run this script."
    exit 0
fi

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null; then
    echo "🐳 Installing Docker Compose..."
    sudo apt install -y docker-compose
fi

# Create app directory
echo "📁 Setting up application directory..."
mkdir -p ~/billova
cd ~/billova

# Create .env file
echo "⚙️ Creating environment configuration..."
cat > .env << 'EOF'
# Billova POS Production Environment
DOCKER_USERNAME=fahadfx

# Database
DB_PASSWORD=Ayubsheik@1506

# JWT Secret (CHANGE THIS IN PRODUCTION!)
JWT_SECRET=billova-super-secret-jwt-key-2024

# API URL
VITE_API_URL=http://164.52.213.134:3001
EOF

# Create docker-compose.yml
echo "📄 Creating Docker Compose configuration..."
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  # MySQL Database
  db:
    image: mysql:8.0
    container_name: billova-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD:-Ayubsheik@1506}
      MYSQL_DATABASE: dfcpos
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - billova-network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend API
  api:
    image: fahadfx/billova:api
    container_name: billova-api
    restart: unless-stopped
    environment:
      DATABASE_URL: mysql://root:${DB_PASSWORD:-Ayubsheik@1506}@db:3306/dfcpos
      JWT_SECRET: ${JWT_SECRET:-billova-super-secret-jwt-key-2024}
      NODE_ENV: production
      PORT: 3001
    ports:
      - "3001:3001"
    depends_on:
      db:
        condition: service_healthy
    networks:
      - billova-network

  # Frontend Web App
  web:
    image: fahadfx/billova:web
    container_name: billova-web
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - api
    networks:
      - billova-network

volumes:
  mysql_data:
    driver: local

networks:
  billova-network:
    driver: bridge
EOF

# Login to Docker Hub (for private repos)
echo "🔐 Logging into Docker Hub..."
docker login -u fahadfx

# Pull images
echo "📥 Pulling Docker images..."
docker-compose pull

# Start the application
echo "🚀 Starting Billova POS..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Check status
echo "✅ Deployment complete! Checking status..."
docker-compose ps

echo ""
echo "=========================================="
echo "🎉 Billova POS is now running!"
echo "=========================================="
echo ""
echo "📱 Web App: http://164.52.213.134"
echo "🔌 API: http://164.52.213.134:3001"
echo ""
echo "Default login credentials:"
echo "  Email: admin@billova.com"
echo "  Password: admin123"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop: docker-compose down"
echo "=========================================="
