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
- [ ] **JWT token expiry & refresh** — Auth store persists token to localStorage with no expiry check. **Fix:** Add token rotation or expiry validation on app init.

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
- [ ] **PWA icons — only `logo.png` for both 192×192 and 512×512** — Should have separate resolution icons. **Fix:** Generate proper icon set using a PWA icon generator.
- [ ] **Service Worker dev mode disabled** — `devOptions.enabled: false` in `vite.config.ts`, which is correct for dev, but ensure production build is tested with SW enabled.
- [ ] **Offline order sync reliability** — Sync engine exists but needs stress testing:
  - What happens with 100+ pending offline orders?
  - Is there conflict resolution for concurrent edits?
  - Are failed syncs retried with exponential backoff?

### UI/UX Issues
- [ ] **No loading skeletons** — Pages show blank or spinner while data loads. **Fix:** Add skeleton loaders (per `web-design-guidelines` skill).
- [ ] **No empty states for most pages** — Only cart has an empty state. Orders, Tables, Menu, Reports pages need proper empty states.
- [ ] **Mobile responsiveness** — POS page uses fixed `calc(100vh - 70px)` height. Test on actual tablets/phones. Many pages may not be responsive.
- [ ] **Accessibility (a11y)** — No ARIA labels, no keyboard navigation support, no focus management. Run Lighthouse audit.
- [ ] **No dark/light theme toggle** — App is dark-only. Some users may prefer light mode.

---

## 🟡 P2 — Important for Production Quality

### Testing
- [ ] **Zero test coverage** — No unit tests, integration tests, or E2E tests exist anywhere.
  - [ ] Add unit tests for store logic (`useCartStore`, `useAuthStore`)
  - [ ] Add unit tests for utility functions (price calculations, formatters)
  - [ ] Add integration tests for API routes (auth, orders, menu)
  - [ ] Add E2E tests for critical flows (login → create order → checkout → print)
  - [ ] Set up Vitest for frontend, Jest for API

### Database & Migrations
- [x] **Multiple migration approaches** — Created `supabase/README.md` explaining the structure. `schema.sql` is the single source for fresh DBs; `migrations/` has incremental patches for live DB.
- [ ] **RLS policies audit** — `schema-step3-rls.sql` (11KB) exists but verify all tables have proper RLS. Especially critical for multi-tenant data isolation.
- [ ] **No database indexes audit** — Ensure indexes exist for frequently queried columns (order date, branch_id, status).

### API Hardening
- [x] **Request logging** — `morgan('combined')` was already configured.
- [x] **Deep health check** — `/api/health` now checks DB connectivity (latency), reports uptime, memory usage, and returns 503 if degraded.
- [ ] **No API versioning** — Routes are at `/api/*` with no version prefix. **Fix:** Consider `/api/v1/*` for future compatibility.
- [x] **Error responses standardized** — Global error handler returns consistent JSON with status codes, CORS error handling, and stack traces in dev only.

### Feature Completeness
- [ ] **Addons page** — `Addons.tsx` exists (12KB) but verify it's fully functional and accessible.
- [ ] **Owner Dashboard** — `OwnerDashboard.tsx` (17KB) exists but route is at `/dashboard`, not linked from sidebar by default.
- [ ] **Delivery page** — `Delivery.tsx` (9KB) — verify integration with order flow.
- [ ] **Captain page** — `Captain.tsx` (14KB) — verify this KOT/kitchen display works end-to-end.
- [ ] **Customer self-order** — `CustomerOrder.tsx` + `/order/:token` route exists — test the full flow.
- [ ] **Public Menu** — `/m/:branchId` route — fix the undefined branchId issue first.
- [ ] **Online Order** — `/o/:branchId` — test ordering flow end-to-end.
- [ ] **Order Tracking** — `/track/:orderId` — verify real-time updates work.
- [ ] **Forgot Password** — `ForgotPassword.tsx` exists but verify Supabase email is configured.
- [ ] **Warehouse ↔ Inventory sync** — Both pages exist but verify they share data properly.

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
