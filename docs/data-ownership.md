# Billova POS - Data Ownership

> **⚠️ CRITICAL: Read before modifying any data layer**

This document defines the source of truth for each domain in Billova POS.  
Violating these rules can corrupt inventory, break offline sync, or cause audit failures.

---

## Source of Truth Matrix

| Domain | Source of Truth | Writer | Supabase Role | Notes |
|--------|-----------------|--------|---------------|-------|
| **Orders** | Node + MySQL | Node API only | READ-ONLY mirror | Clients cannot write |
| **Order Events** | Supabase | Node API only | Append-only | Audit trail |
| **Inventory** | Node + MySQL | Node API only | READ-ONLY mirror | Atomic with orders |
| **Payments** | Supabase | Node API only | Append-only | Financial records |
| **Auth/Users** | Supabase | Supabase Auth | Full control | JWT issuance |
| **Profiles** | Supabase | Auth trigger + Admin | RLS protected | Branch-scoped |
| **Menu Items** | Supabase | Manager+ via client | RLS protected | Cloud master |
| **Categories** | Supabase | Manager+ via client | RLS protected | Cloud master |
| **Reports** | Supabase | Edge Functions | READ-ONLY | Aggregations only |
| **Audit Logs** | Supabase | Node API only | Append-only | Compliance |

---

## 🔴 Critical Rules

### 1. Orders are APPEND-ONLY for clients

```sql
-- Clients can ONLY read
REVOKE INSERT, UPDATE, DELETE ON orders FROM authenticated;
GRANT SELECT ON orders TO authenticated;
```

**Why:** Order writes trigger inventory deduction, offline sync, and audit events.  
If clients write directly, inventory math breaks.

### 2. Inventory is a READ-ONLY mirror

```sql
-- Clients can ONLY read
REVOKE INSERT, UPDATE, DELETE ON inventory_items FROM authenticated;
GRANT SELECT ON inventory_items TO authenticated;
```

**Why:** Inventory deduction must be atomic with order creation.  
Node handles this in a transaction.

### 3. Node is the ONLY writer for transactional data

```
Node Inventory Engine
        ↓ (writes)
 MySQL Primary → Supabase Mirror
```

Supabase inventory tables are **projections**, not sources of truth.

---

## Write Flow

```
┌─────────────────────────────────────────────────────────┐
│ Client Action (e.g., Create Order)                       │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Node API                                                 │
│ 1. Validate request                                      │
│ 2. BEGIN TRANSACTION                                     │
│ 3. Create order in MySQL                                 │
│ 4. Deduct inventory (atomic)                             │
│ 5. COMMIT TRANSACTION                                    │
│ 6. Shadow-write to Supabase (async, non-blocking)        │
│ 7. Create order_event (audit)                            │
└─────────────────────────────────────────────────────────┘
```

---

## Read Patterns

| Client | What they read | From where |
|--------|----------------|------------|
| POS Terminal | Orders, Menu | Supabase (realtime) |
| Kitchen Display | Orders (pending/preparing) | Supabase (realtime) |
| Owner Dashboard | Reports, Analytics | Supabase (Edge functions) |
| Offline Mode | Everything | IndexedDB (local) |

---

## Edge Function Rules

### ✅ Allowed

- `daily-report` - aggregates orders
- `live-metrics` - counts and sums
- `inventory-alerts` - low stock queries
- `sales-by-hour` - time-based aggregation

### ❌ Never Allowed

- Any inventory mutation
- Order status changes
- Payment creation
- Anything transactional

---

## Ownership Change Process

1. **Discuss** in team meeting
2. **Document** the change here first
3. **Update** RLS policies
4. **Review** by senior engineer
5. **Deploy** with feature flag
6. **Monitor** for 1 week

---

**Last Updated:** January 13, 2026  
**Maintainer:** Backend Team
