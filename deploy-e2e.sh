#!/bin/bash
# Billova POS - E2E Server Deployment Script (Supabase-only)
# Run this on your Ubuntu server for initial setup

set -e

echo "🚀 Starting Billova POS Deployment (Supabase Edition)..."

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

# Install Docker Compose plugin if not present
if ! docker compose version &> /dev/null; then
    echo "🐳 Installing Docker Compose..."
    sudo apt install -y docker-compose-plugin
fi

# Create app directory
echo "📁 Setting up application directory..."
mkdir -p ~/billova
cd ~/billova

# Create .env file
echo "⚙️ Creating environment configuration..."
echo "Please enter your Supabase credentials:"
read -p "SUPABASE_URL: " SUPABASE_URL
read -p "SUPABASE_SERVICE_ROLE_KEY: " SUPABASE_SERVICE_ROLE_KEY
read -p "JWT_SECRET (or press Enter for default): " JWT_SECRET
JWT_SECRET=${JWT_SECRET:-$(openssl rand -base64 32)}
read -p "GROQ_API_KEY (optional): " GROQ_API_KEY

cat > .env << EOF
# Billova POS - Supabase-only Configuration
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
SUPABASE_AUTH_ONLY=true
JWT_SECRET=${JWT_SECRET}
FRONTEND_URL=https://billova.com
GROQ_API_KEY=${GROQ_API_KEY}

# Frontend Build Variables
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${SUPABASE_SERVICE_ROLE_KEY%_*}_anon
VITE_API_URL=/api
VITE_SUPABASE_AUTH_ONLY=true
EOF

# Create docker-compose.yml (Supabase-only - no MySQL)
echo "📄 Creating Docker Compose configuration..."
cat > docker-compose.yml << 'EOF'
services:
  # Backend API (Supabase-only)
  api:
    image: fahadfx/billova:api
    container_name: billova-api
    restart: unless-stopped
    environment:
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
      SUPABASE_AUTH_ONLY: true
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: production
      PORT: 3002
    expose:
      - "3002"
    networks:
      - billova-network
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3002/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  # Frontend Web App
  web:
    image: fahadfx/billova:web
    container_name: billova-web
    restart: unless-stopped
    expose:
      - "80"
    depends_on:
      - api
    networks:
      - billova-network

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: billova-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - api
      - web
    networks:
      - billova-network

networks:
  billova-network:
    driver: bridge
EOF

# Login to Docker Hub
echo "🔐 Logging into Docker Hub..."
docker login -u fahadfx

# Pull images
echo "📥 Pulling Docker images..."
docker compose pull

# Start the application
echo "🚀 Starting Billova POS..."
docker compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 15

# Check status
echo "✅ Deployment complete! Checking status..."
docker compose ps

echo ""
echo "=========================================="
echo "🎉 Billova POS is now running!"
echo "=========================================="
echo ""
echo "📱 Web App: https://billova.com"
echo "🔌 API: https://billova.com/api"
echo ""
echo "🔐 Super Admin login:"
echo "   Email: mohammedzaheerhussain2002@gmail.com"
echo ""
echo "To view logs: docker compose logs -f"
echo "To stop: docker compose down"
echo "=========================================="
