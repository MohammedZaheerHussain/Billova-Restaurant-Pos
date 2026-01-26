#!/bin/bash

# Billova POS - Cloud Deployment Script
# Usage: ./deploy.sh [command]
# Commands: setup, deploy, ssl, backup, logs

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[Billova]${NC} $1"; }
warn() { echo -e "${YELLOW}[Warning]${NC} $1"; }
error() { echo -e "${RED}[Error]${NC} $1"; }

# Check if .env exists
check_env() {
    if [ ! -f .env ]; then
        error ".env file not found!"
        echo "Copy .env.example to .env and fill in your values:"
        echo "  cp .env.example .env"
        exit 1
    fi
}

# Initial setup
setup() {
    log "Setting up Billova POS..."
    
    check_env
    
    # Create directories
    mkdir -p certbot/conf certbot/www
    
    # Build images
    log "Building Docker images..."
    docker-compose build
    
    # Start database first
    log "Starting database..."
    docker-compose up -d db
    sleep 10
    
    # Run migrations
    log "Running database migrations..."
    docker-compose run --rm api npx prisma migrate deploy
    
    # Seed initial data
    log "Seeding database..."
    docker-compose run --rm api npx prisma db seed
    
    log "Setup complete! Run './deploy.sh deploy' to start all services."
}

# Deploy all services
deploy() {
    log "Deploying Billova POS..."
    check_env
    
    # Pull latest images
    docker-compose pull
    
    # Build and start
    docker-compose up -d --build
    
    log "Deployment complete!"
    log "Billova POS is running at http://localhost"
    docker-compose ps
}

# Setup SSL with Certbot
ssl() {
    check_env
    source .env
    
    if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
        error "DOMAIN and EMAIL must be set in .env"
        exit 1
    fi
    
    log "Setting up SSL for $DOMAIN..."
    
    # Stop nginx temporarily
    docker-compose stop nginx
    
    # Get certificate
    docker-compose run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        -d $DOMAIN \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email
    
    log "SSL certificate obtained!"
    log "Update nginx.conf to enable HTTPS, then run './deploy.sh deploy'"
}

# Backup database
backup() {
    log "Creating database backup..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="backup_billova_${TIMESTAMP}.sql"
    
    docker-compose exec db mysqldump -u root -p billova > $BACKUP_FILE
    
    log "Backup saved to $BACKUP_FILE"
}

# View logs
logs() {
    docker-compose logs -f --tail=100 $1
}

# Stop all services
stop() {
    log "Stopping Billova POS..."
    docker-compose down
    log "All services stopped."
}

# Show status
status() {
    docker-compose ps
}

# Main command handler
case "$1" in
    setup)
        setup
        ;;
    deploy)
        deploy
        ;;
    ssl)
        ssl
        ;;
    backup)
        backup
        ;;
    logs)
        logs $2
        ;;
    stop)
        stop
        ;;
    status)
        status
        ;;
    *)
        echo "Billova POS Deployment Script"
        echo ""
        echo "Usage: ./deploy.sh [command]"
        echo ""
        echo "Commands:"
        echo "  setup   - Initial setup (first time only)"
        echo "  deploy  - Deploy/update all services"
        echo "  ssl     - Setup SSL certificate"
        echo "  backup  - Backup database"
        echo "  logs    - View logs (optional: service name)"
        echo "  stop    - Stop all services"
        echo "  status  - Show service status"
        ;;
esac
