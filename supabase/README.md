# Supabase Migrations

This folder contains incremental database migrations for Billova POS.

## Structure

| File | Purpose |
|------|---------|
| `schema.sql` | **Complete schema** — run this to set up a brand-new database from scratch |
| `migrations/` | Incremental patches applied chronologically to the live database |
| `super-admin-setup.sql` | One-time super admin seeding script |
| `set-super-admin.sql` | Grant super admin role to an existing user |

## For a Fresh Database

Run `schema.sql` in the Supabase SQL Editor. It includes all tables, RLS policies,
triggers, and functions. No need to run individual migration files.

## For an Existing Database

Migrations in the `migrations/` folder are applied in timestamp order.
Each file is idempotent (uses `IF NOT EXISTS` / `IF EXISTS`).

## Deprecated Files (Safe to Ignore)

The following files were used during initial development and are superseded by `schema.sql`:
- `schema-step1-cleanup.sql`
- `schema-step2-tables.sql`
- `schema-step3-rls.sql`
- `migration-additive.sql`
