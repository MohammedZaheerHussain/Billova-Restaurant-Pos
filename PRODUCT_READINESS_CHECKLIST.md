# Billova POS — Product Readiness Checklist

> **Generated:** 2026-02-11 | **Skills Installed:** `find-skills`, `vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines`, `vercel-react-native-skills`
>
> Complete audit of 25 pages, 21 API routes, 22 components, sync engine, printing system, and PWA config.

---

## 🔴 P0 — Critical Bugs (Fix Before Any Release)

### Console Errors & Crashes
- [x] **manifest.webmanifest Syntax Error** — Deleted conflicting `public/manifest.json`. VitePWA in `vite.config.ts` handles manifest generation exclusively.
- [x] **Settings → Online Menu URL shows `undefined`** — Added branchId null check with fallback message + disabled copy/open buttons.
- [x] **useSubscription crash on invalid plan** — Already patched. Login now calls `fetchUserProfile` to always populate branch data.

### Data Integrity
- [x] **No input validation middleware on API** — Created `validate.ts` middleware + `schemas.ts` with Zod schemas for orders, auth, menu, tables, users. Wired validation to order creation and payment routes.
- [x] **Cart persistence TODO** — Added `printHistory` table to IndexedDB (DB v3 migration). Print-orchestrator now persists print jobs to IndexedDB with auto-cleanup.

---

## 🟠 P1 — Important (Fix Before Beta Launch)

### Security
- [x] **Rate limiting** — Already implemented: `generalLimiter` (500/15min) and `authLimiter` (20/15min) via `express-rate-limit`.
- [x] **API keys in `.env.production` committed** — Added `.env.production` to `.gitignore` (along with build artifacts, IDE configs, OS files).
- [x] **CORS configuration review** — Updated CORS to accept comma-separated origins from `FRONTEND_URL` env var. Rejects unlisted origins.
- [x] **JWT token expiry & refresh** — Added `tokenExpiry`, `isTokenExpired()`, `checkAuth()` to auth store. `Layout.tsx` checks on mount + every 5 minutes, auto-logs out expired sessions.

### Performance & Code Quality
- [x] **50+ `console.log` statements in production code** — Created `logger.ts` utility (suppresses debug/info in prod). Replaced all console.log/error/warn calls across `Login.tsx`, `sync-service.ts`, `transaction-journal.ts`, `useNetworkStatus.ts`, `supabase.ts`, `indexed-db.ts`.

- [x] **No code splitting / lazy loading** — All 23 pages converted to `React.lazy()` with `Suspense` + `PageLoader` fallback in `App.tsx`.
- [ ] **Large page files** — Several pages are monolithic:
  - `Inventory.tsx` — 50KB (1400+ lines)
  - `Warehouse.tsx` — 43KB
  - `Menu.tsx` — 41KB
  - `Orders.tsx` — 41KB
  - `PrinterSettings.tsx` — 35KB

  **Fix:** Refactor into smaller components using composition patterns (use installed `vercel-composition-patterns` skill).

### PWA & Offline
- [x] **PWA icons** — Generated `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` from logo. Updated `vite.config.ts` manifest and `index.html` apple-touch-icon.
- [ ] **Service Worker dev mode disabled** — `devOptions.enabled: false` in `vite.config.ts`, which is correct for dev, but ensure production build is tested with SW enabled.
- [ ] **Offline order sync reliability** — Sync engine exists but needs stress testing:
  - What happens with 100+ pending offline orders?
  - Is there conflict resolution for concurrent edits?
  - Are failed syncs retried with exponential backoff?

### UI/UX Issues
- [x] **Loading skeletons** — Added contextual skeleton loaders for POS menu grid, Orders table, and Reports dashboard (`Skeleton.tsx` + `Skeleton.css`).
- [x] **Empty states** — Added professional empty states with icons + helper text for Tables, Menu, Users pages. Orders already had one.
- [x] **Mobile responsiveness** — Added collapsible sidebar with hamburger toggle for screens ≤768px, backdrop overlay, and content padding adjustments in `Layout.css` + `Layout.tsx`.
- [ ] **Accessibility (a11y)** — No ARIA labels, no keyboard navigation support, no focus management. Run Lighthouse audit.
- [ ] **No dark/light theme toggle** — App is dark-only. Some users may prefer light mode.

---

## 🟡 P2 — Important for Production Quality

### Testing
- [x] **Testing infrastructure** — Vitest + Testing Library + jsdom configured.
  - [x] Added unit tests for store logic (`useCartStore` patterns, `useAuthStore` patterns) — 16 tests
  - [x] Added unit tests for utility functions (price calculations, date formatting, order numbers) — 13 tests
  - [ ] Add integration tests for API routes (auth, orders, menu)
  - [ ] Add E2E tests for critical flows (login → create order → checkout → print)
  - [x] Set up Vitest for frontend (`npm test` runs 29 tests, all passing)

### Database & Migrations
- [x] **Multiple migration approaches** — Created `supabase/README.md` explaining the structure. `schema.sql` is the single source for fresh DBs; `migrations/` has incremental patches for live DB.
- [x] **RLS policies audit** — All 26 tables have `ENABLE ROW LEVEL SECURITY`. 29 policies verified: service_role full access, branch_id tenant isolation, role-based access control.
- [x] **Database indexes audit** — 31 indexes confirmed on hot columns (branch_id, status, created_at, order_id, email, sku).

### API Hardening
- [x] **Request logging** — `morgan('combined')` was already configured.
- [x] **Deep health check** — `/api/health` now checks DB connectivity (latency), reports uptime, memory usage, and returns 503 if degraded.
- [ ] **No API versioning** — Routes are at `/api/*` with no version prefix. **Fix:** Consider `/api/v1/*` for future compatibility.
- [x] **Error responses standardized** — Global error handler returns consistent JSON with status codes, CORS error handling, and stack traces in dev only.

### Feature Completeness (Browser Verified ✅)
- [x] **POS page** — Categories, menu items, cart, order types (Dine In, Takeaway, Online) all render.
- [x] **Orders page** — Date picker, status filters (Pending/Completed/Cancelled), empty state works.
- [x] **Tables page** — Table management with "Add Table" button functional.
- [x] **Menu page** — 3 items across 3 categories shown, edit/delete actions present.
- [x] **Reports page** — Dashboard with sales metrics, hourly trends, order types, payment methods.
- [x] **Settings page** — Branch Details, GST Settings, Order Settings, Printer Settings, Online Menu, Cloud Backup.
- [x] **Users page** — Shows employees list with roles.
- [x] **Captain page** — KOT/kitchen display with "Select Table" section (empty until tables configured).
- [x] **Delivery page** — ~~500 error~~ Fixed: returns empty array when `delivery_assignments` table not yet created.
- [x] **Login/Forgot Password** — Correctly redirect authenticated users to POS.
- [x] **Addons page** — Wired to sidebar with `inventory` feature gate + lazy-loaded route in `App.tsx`.
- [x] **Owner Dashboard** — Wired to sidebar with OWNER/ADMIN role guard + route in `App.tsx`.
- [ ] **Customer self-order** — `CustomerOrder.tsx` + `/order/:token` route — needs end-to-end testing.
- [ ] **Public Menu** — `/m/:branchId` route — needs branchId fix.
- [ ] **Online Order** — `/o/:branchId` — needs end-to-end testing.
- [ ] **Order Tracking** — `/track/:orderId` — needs real-time verification.
- [ ] **Warehouse ↔ Inventory sync** — Both pages exist (locked 🔒) but need data sync verification.

---

## 🟢 P3 — Nice to Have (Post-Launch Polish)

### Developer Experience
- [ ] **Add ESLint + Prettier** — No linting configuration found. **Fix:** Set up ESLint with React + TypeScript rules.
- [ ] **Add pre-commit hooks** — Use Husky + lint-staged to enforce code quality.
- [ ] **Add TypeScript strict mode** — Enable `strict: true` in `tsconfig.json` if not already.
- [ ] **CI/CD pipeline** — `.github/` folder exists but verify GitHub Actions are set up for build + test + deploy.

### Monitoring & Analytics
- [ ] **No error tracking** — No Sentry, LogRocket, or similar. **Fix:** Add Sentry for production error tracking.
- [ ] **No analytics** — No usage tracking for feature adoption. Consider Mixpanel/PostHog for product analytics.
- [ ] **No uptime monitoring** — Set up UptimeRobot or similar for API health monitoring.

### Printing System
- [ ] **Browser print driver** — `browser-print.ts` exists — test actual thermal printer compatibility.
- [ ] **Bluetooth print driver** — `bluetooth-print.ts` exists — test with real Bluetooth thermal printers.
- [ ] **ESC/POS encoder** — `escpos-encoder.ts` — verify command compatibility with common Indian POS printers (TVS, Epson TM-T82).
- [ ] **KOT template** — `kot-template.ts` — verify kitchen order ticket format.
- [ ] **Print preview component** — `PrintPreview.tsx` — ensure WYSIWYG accuracy.

### Documentation
- [ ] **No README.md** — Project root has no README with setup instructions.
- [ ] **No API documentation** — No Swagger/OpenAPI spec for the 21 API routes.
- [ ] **No architecture docs** — `docs/` folder exists (2 files) but need comprehensive architecture overview.
- [ ] **No deployment guide** — `deploy.sh` and `docker-compose.yml` exist but no written guide.

### Build & Deployment
- [ ] **Docker configs** — `Dockerfile.api` and `Dockerfile.web` exist — test full Docker build.
- [ ] **Nginx configs** — `nginx.conf` and `nginx.web.conf` exist — verify reverse proxy setup.
- [ ] **Production build test** — Run `npm run build` and verify no TypeScript errors, bundle size is reasonable.
- [ ] **Environment variable documentation** — `.env.example` exists (1.2KB) — verify it lists ALL required vars.

---

## 📊 Audit Summary

| Category | Count | Status |
|----------|-------|--------|
| Pages | 25 | Built, need testing |
| API Routes | 21 | Built, need security hardening |
| Components | 22+ | Built, need a11y review |
| Console.logs | 50+ | ❌ Remove for production |
| Tests | 0 | ❌ Critical gap |
| PWA Config | VitePWA | ⚠️ Manifest conflict |
| Security | Helmet only | ⚠️ Needs rate limiting |
| Offline Sync | IndexedDB + Journal | ⚠️ Needs stress testing |
| Printing | 3 drivers | ⚠️ Needs hardware testing |

---

## 🛠️ Installed Skills (via `npx skills add`)

| Skill | Source | Purpose |
|-------|--------|---------|
| `find-skills` | `vercel-labs/skills` | Discover & install agent skills |
| `vercel-react-best-practices` | `vercel-labs/agent-skills` | React/Next.js performance optimization |
| `vercel-composition-patterns` | `vercel-labs/agent-skills` | Component architecture & refactoring |
| `web-design-guidelines` | `vercel-labs/agent-skills` | UI/UX audit & accessibility |
| `vercel-react-native-skills` | `vercel-labs/agent-skills` | Mobile app best practices |

---

## 📋 Recommended Priority Order

1. **Fix P0 bugs** (manifest, Settings undefined, input validation)
2. **Security hardening** (rate limiting, env keys, CORS)
3. **Remove console.logs** (quick win, big impact)
4. **Add code splitting** (performance win)
5. **Add tests** (start with store logic + critical API routes)
6. **Refactor large pages** (Inventory, Warehouse, Menu, Orders)
7. **PWA icons + testing** (proper icon set, SW testing)
8. **a11y audit** (Lighthouse, ARIA labels)
9. **Add monitoring** (Sentry, uptime)
10. **Documentation** (README, API docs, deployment guide)
