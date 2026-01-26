# Billova POS - Cloud Deployment Guide

This guide walks you through deploying Billova POS to production with **Dual-Auth Mode** (both Node JWT and Supabase authentication).

## Prerequisites

1. **A cloud server** (Ubuntu 22.04+ recommended) with:
   - 2+ GB RAM
   - 20+ GB storage
   - Docker & Docker Compose installed
   - Domain name pointing to your server

2. **Supabase Project** (you already have this)
   - Get your project URL and keys from the Supabase dashboard

---

## Step 1: Prepare Your Server

### Option A: Fresh VPS (DigitalOcean, AWS, Hetzner, etc.)

```bash
# SSH into your server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version
```

### Option B: Railway (Simpler, No Docker Required)

Skip to [Railway Deployment](#railway-deployment) section below.

---

## Step 2: Clone and Configure

```bash
# Clone the repository
git clone https://github.com/your-username/Billova.git
cd Billova

# Create production environment file
cp .env.example .env

# Edit with your values
nano .env
```

### Fill in your .env file:

```env
# ============================================
# MySQL Database
# ============================================
MYSQL_ROOT_PASSWORD=YourStrongPassword123!

# ============================================
# API Server
# ============================================
JWT_SECRET=your-64-character-secret-key

FRONTEND_URL=https://your-domain.com
GROQ_API_KEY=your_groq_api_key

# ============================================
# Supabase Configuration (Dual-Auth Mode)
# ============================================
SUPABASE_URL=https://pbuqzfrffquziystkvcy.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Feature Flags
SUPABASE_SHADOW_WRITE=true
DUAL_AUTH_ENABLED=true
SUPABASE_AUTH_ONLY=false

# ============================================
# Frontend Variables (for build)
# ============================================
VITE_SUPABASE_URL=https://pbuqzfrffquziystkvcy.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=https://your-domain.com/api

# ============================================
# SSL Configuration
# ============================================
DOMAIN=your-domain.com
EMAIL=your-email@example.com
```

### Generate a secure JWT secret:
```bash
openssl rand -base64 64
```

---

## Step 3: Initial Deployment

```bash
# Make deploy script executable
chmod +x deploy.sh

# Run initial setup (builds images, migrates database)
./deploy.sh setup

# Deploy all services
./deploy.sh deploy
```

This will start:
- **MySQL database** - Port 3306 (internal)
- **API server** - Port 3002 (internal)
- **Web frontend** - Port 80 (internal)
- **Nginx proxy** - Ports 80, 443 (external)

---

## Step 4: Setup SSL Certificate

```bash
# Get SSL certificate from Let's Encrypt
./deploy.sh ssl
```

Then update `nginx.conf` to enable HTTPS (uncomment the HTTPS server block).

---

## Step 5: Verify Deployment

```bash
# Check all services are running
./deploy.sh status

# View logs
./deploy.sh logs        # All services
./deploy.sh logs api    # API only
./deploy.sh logs web    # Web only

# Test the API
curl https://your-domain.com/api/health
```

Visit `https://your-domain.com` in your browser!

---

## Railway Deployment

For a simpler deployment without managing servers:

### 1. Create Railway Account
Go to [railway.app](https://railway.app) and sign up.

### 2. Create New Project
Click "New Project" > "Empty Project"

### 3. Add MySQL Database
- Click "Add Service" > "Database" > "MySQL"
- Note the connection URL

### 4. Add API Service
- Click "Add Service" > "GitHub Repo"
- Select your Billova repository
- Set **Root Directory**: `packages/api`
- Add environment variables:

```
PORT=3002
NODE_ENV=production
DATABASE_URL=<railway-mysql-url>
JWT_SECRET=<your-jwt-secret>
FRONTEND_URL=https://your-app.railway.app
GROQ_API_KEY=<your-groq-key>
SUPABASE_URL=https://pbuqzfrffquziystkvcy.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUPABASE_SHADOW_WRITE=true
DUAL_AUTH_ENABLED=true
SUPABASE_AUTH_ONLY=false
```

### 5. Add Web Service
- Click "Add Service" > "GitHub Repo"
- Select your Billova repository
- Set **Root Directory**: `apps/web`
- Set **Build Command**: `npm run build`
- Set **Start Command**: `npx serve dist -s -l 3000`
- Add environment variables:

```
VITE_SUPABASE_URL=https://pbuqzfrffquziystkvcy.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_API_URL=https://your-api.railway.app
```

### 6. Generate Domain
For each service, go to Settings > Networking > Generate Domain

---

## Vercel + Railway Combo (Recommended for Frontend)

### Frontend on Vercel (Free)

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Set **Root Directory**: `apps/web`
4. Add Environment Variables:
   ```
   VITE_SUPABASE_URL=https://pbuqzfrffquziystkvcy.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_API_URL=https://your-api.railway.app
   ```
5. Deploy!

### API on Railway

Follow the Railway API steps above.

---

## Post-Deployment Checklist

- [ ] Test login with existing credentials
- [ ] Create a new order and verify it syncs to Supabase
- [ ] Check Supabase dashboard for shadow-written data
- [ ] Test printing functionality
- [ ] Verify offline mode works
- [ ] Set up database backups

---

## Troubleshooting

### API not connecting to database
```bash
./deploy.sh logs api
# Check for connection errors
```

### SSL certificate issues
```bash
# Renew certificate manually
docker-compose run --rm certbot renew
```

### Check container status
```bash
docker-compose ps
docker-compose logs -f
```

---

## Rollback

If something goes wrong:
```bash
# Stop all services
./deploy.sh stop

# Check logs and fix issues
vim .env

# Redeploy
./deploy.sh deploy
```

---

## After 2 Weeks: Full Supabase Auth

Once you've verified everything works in dual-auth mode:

```bash
# Edit .env
nano .env

# Change:
DUAL_AUTH_ENABLED=false
SUPABASE_AUTH_ONLY=true

# Redeploy
./deploy.sh deploy
```

This will switch to Supabase-only authentication, fully deprecating the Node JWT system.
