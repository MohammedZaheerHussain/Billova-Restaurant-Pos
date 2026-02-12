# Billova POS

> Universal, Industry-Level Billing & POS System — Offline-First, PWA-Ready

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Express.js + TypeScript |
| Database | Supabase (PostgreSQL + Auth) |
| Offline | IndexedDB + Sync Engine |
| Styling | Vanilla CSS (dark theme) |
| Animation | Framer Motion |
| PWA | VitePWA + Workbox |

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- Supabase project (for database + auth)

## Quick Start

```bash
# 1. Clone & install
git clone <repo-url> && cd Billova
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your Supabase + API keys

# 3. Set up database
# Run supabase/schema.sql against your Supabase project

# 4. Start dev servers (API + Web)
npm run dev
```

- **Web** → http://localhost:5175
- **API** → http://localhost:3002

## Project Structure

```
Billova/
├── apps/web/              # React frontend (Vite)
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Route pages (lazy-loaded)
│   │   ├── store/         # Zustand state stores
│   │   ├── services/      # Sync engine, offline logic
│   │   ├── hooks/         # Custom React hooks
│   │   ├── printing/      # ESC/POS, Bluetooth, Browser print
│   │   └── lib/           # Supabase client, utilities
│   └── public/            # PWA icons, logo
├── packages/api/          # Express API server
│   └── src/
│       ├── routes/        # 21 API endpoints
│       ├── middleware/     # Auth, validation, rate limiting
│       └── index.ts       # Server entry
├── supabase/              # Database schema & migrations
├── docker-compose.yml     # Production container setup
├── nginx.conf             # Reverse proxy config
└── deploy.sh              # Deployment script
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + Web dev servers |
| `npm run dev:web` | Start web only (port 5175) |
| `npm run dev:api` | Start API only (port 3002) |
| `npm run build` | TypeScript check + production build |
| `npm test --workspace=apps/web` | Run 29 unit tests |

## Environment Variables

See [.env.example](.env.example) for all required variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key |
| `JWT_SECRET` | ✅ | API JWT signing secret |
| `FRONTEND_URL` | ✅ | Frontend origin for CORS |
| `VITE_SUPABASE_URL` | ✅ | Frontend Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Frontend Supabase anon key |
| `GROQ_API_KEY` | ⬜ | AI menu card scanning |

## Features

- **POS Terminal** — Fast order entry with categories, addons, order types (Dine In, Takeaway, Online)
- **Order Management** — Status tracking, filters, date picker
- **Table Management** — Visual table layout with status
- **Menu Management** — Categories, items, pricing, variants
- **Reports Dashboard** — Sales metrics, hourly trends, payment breakdowns
- **Kitchen Display (Captain)** — KOT view for kitchen staff
- **Delivery Tracking** — Assign and track delivery orders
- **Multi-User Roles** — Owner, Admin, Cashier, Captain with role-based access
- **Offline-First** — IndexedDB sync engine with conflict resolution
- **PWA** — Install on any device, works offline
- **Printing** — ESC/POS, Bluetooth, and browser print drivers
- **Multi-Branch** — Branch-level data isolation via RLS

## Deployment

### Docker

```bash
docker-compose up -d
```

### Manual

```bash
# Build frontend
npm run build --workspace=apps/web

# Start API
npm run start --workspace=packages/api
```

See `nginx.conf` for reverse proxy configuration.

## License

MIT
`, "TargetFile": "/Users/zoro/Downloads/Billova/Billova/README.md", "Overwrite": false, "EmptyFile": false, "Description": "Created a comprehensive README covering tech stack, project structure, setup, scripts, environment variables, features, and deployment.", "Complexity": 5, "IsArtifact": false}
