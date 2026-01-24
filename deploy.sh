#!/bin/bash

# Billova POS - Build and Push to Docker Hub
# Usage: ./deploy.sh <docker-hub-username>

set -e

DOCKER_USERNAME=${1:-"billova"}
VERSION=${2:-"latest"}

echo "🚀 Building Billova POS Docker Images..."
echo "📦 Docker Hub Username: $DOCKER_USERNAME"
echo "🏷️  Version: $VERSION"

# Build Frontend
echo ""
echo "📦 Building Frontend (Web)..."
docker build -t $DOCKER_USERNAME/billova-web:$VERSION ./apps/web

# Build Backend (from root for monorepo context)
echo ""
echo "📦 Building Backend (API)..."
docker build -t $DOCKER_USERNAME/billova-api:$VERSION -f packages/api/Dockerfile .

# Push to Docker Hub
echo ""
echo "🚀 Pushing to Docker Hub..."
docker push $DOCKER_USERNAME/billova-web:$VERSION
docker push $DOCKER_USERNAME/billova-api:$VERSION

echo ""
echo "✅ Done! Images pushed to Docker Hub:"
echo "   - $DOCKER_USERNAME/billova-web:$VERSION"
echo "   - $DOCKER_USERNAME/billova-api:$VERSION"
echo ""
echo "🖥️  On your E2E server, run:"
echo "   docker pull $DOCKER_USERNAME/billova-web:$VERSION"
echo "   docker pull $DOCKER_USERNAME/billova-api:$VERSION"
echo "   docker-compose up -d"
