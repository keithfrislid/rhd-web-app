# RHD Web App — Claude Code Instructions

## Stack
- **Next.js** (app router, TypeScript) + **Tailwind CSS**
- **Supabase** — auth, Postgres DB, edge functions (Deno)
- **Leaflet.js** — map, loaded via dynamic import (no SSR); always check `cancelled` flag in useEffect
- CSS variables for theming: `--surface`, `--surface-2`, `--border`, `--text`, `--muted`, `--accent`, `--danger`, `--success`, `--warning`, `--ring`

## Key Files

### Buyer-facing
- `app/(app)/dashboard/page.tsx` — main browse page (map + list toggle)
- `components/LeafletMap.tsx` — Leaflet map, popup, pin legend, map/list toggle overlay
- `components/PropertyListView.tsx` — list view, filter/sort, badges (saved/pending/accepted)
- `components/DealSheetPanel.tsx` — deal sheet (saves, offers, Mark New button)

### Admin
- `app/(app)/admin/page.tsx` — admin page shell, routes Edit → Publish Draft flow for Draft properties
- `components/AdminCreatePropertyModal.tsx` — 2-step create wizard; also used as "Publish Draft" flow (pre-populated UPDATE path)
- `components/EditPropertyModal.tsx` — edit modal for live properties (no visibility section)
- `components/admin/AdminPropertiesPanel.tsx` — admin property list, default filter = "Active"
- `components/admin/AdminPropertyDetailsModal.tsx` — deal sheet for admins

### Core lib
- `lib/properties.ts` — `PropertyStatus` type, `effectiveVisibility()`, `fetchProperties()`
- `lib/hooks/useAdminData.ts` — `PropertyRow` type, fetches all properties + pending offers for admin
- `lib/hooks/useViewedProperties.ts` — `markViewed` / `unmarkViewed` (optimistic, Supabase)
- `components/ui/` — `ModalShell`, `Card`, `Button`, `Input`, `Select`, `Badge`, `StatusBadge`, `PageShell`

## Database — Properties Table
Key columns: `address`, `photo_url`, `status`, `price`, `beds`, `baths`, `sqft`, `acres`, `arv`, `repairs`, `lat`, `lng`, `county`, `auto_notify`, `visibility`, `vip_release_at`, `public_release_at`, `exclusive_user_id`, `due_diligence_date`, `is_archived`, `closed_outcome`, `closed_at`, `closed_reason`

### Status values
- `Draft` — admin staging only, never visible to buyers
- `New` — active listing, visible per visibility rules
- `Price Drop` — active listing
- `Under Contract` — deal locked, hidden from buyer browse by default

### Visibility rules (`effectiveVisibility()` in `lib/properties.ts`)
- `exclusive` → if `vip_release_at` passed → promote to `vip`; if `public_release_at` also passed → `public`
- `vip` → if `public_release_at` passed (or null) → `public`
- Always derive effective visibility client-side; DB column may still say `exclusive`/`vip` after timers expire

### Due Diligence date
- Admin-only field — the last day to find a buyer (wholesaler shopping window)
- Shows as DD countdown badge on **active** properties in admin panel (not Under Contract)
- If DD passes while property is still active (not Under Contract) → auto-archives as Closed Lost
- Edge function: `supabase/functions/due-diligence-check/`

## Supabase Edge Functions
- `geocode` — POST `{ text }` → `{ lat, lng, formatted, county }`
- `admin-users/buyers` — GET → buyer list with tier/rank
- `admin-offers` — offer management
- `admin-buy-boxes` — buy box management
- `due-diligence-check` — cron job: archives active properties past DD as Closed Lost
- `property-notify`, `offer-notify` — push notifications

## SQL Migrations (run in Supabase SQL Editor)
All migrations live in `supabase/sql/`:
- `add_due_diligence_date.sql` — adds `due_diligence_date` column
- `add_draft_status.sql` — adds Draft to status check constraint + timer-aware buyer SELECT RLS policy
- `fix_visibility_rls.sql` — earlier buyer RLS fix (superseded by `add_draft_status.sql`)
- `fix_multi_admin_rls.sql` — multi-admin support

## RLS Policy — Buyer SELECT
Policy name: `buyer_select_properties`
- Admins see everything (including Drafts)
- Non-admins: never see `Draft` or `is_archived=true`
- Visibility gating: exclusive → VIP → public based on release timestamps (mirrors `effectiveVisibility()`)

## UI Patterns
- Modal overlay: `fixed inset-0 z-[7000] flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-center`
- Map height: `h-[calc(100svh-80px)] md:h-[72vh] md:min-h-[520px] min-h-[400px]`
- Zoom controls at `topright`, map/list toggle pill at `top-3 left-3`
- Pin colors: New=`#ef4444`, Under Contract=`#f59e0b`, Viewed=`#111827`
- Map tile: CartoDB `light_all` (never dark — too hard to read)

## Custom Events
- `rhd:saves-changed` — fired when a save is added/removed
- `rhd:offers-changed` — fired when an offer is submitted/accepted

## Validation Rules
- **Draft**: only address required; all numeric fields optional (null-safe save)
- **Live status** (New / Price Drop / Under Contract): all numeric fields must be `> 0` AND coordinates required
- `Number("") === 0` — always check `> 0` not just `isFinite` for required numeric fields; empty string and DB placeholder `0` both fail correctly

## Draft → Publish Flow
1. Admin clicks Edit on a Draft → opens `AdminCreatePropertyModal` as "Publish Draft" (not `EditPropertyModal`)
2. Pre-populates all fields from the draft record
3. Step 1: fill required fields (Next → gated on all fields `> 0`); "Update Draft" button saves partial progress back to DB
4. Step 2: configure First Dibs / Visibility timers
5. Submit does `UPDATE` on existing draft row (not INSERT)

## Watch Out For
- Smart/curly quotes (U+201C/U+201D) can sneak into `.ts` files and cause parse errors
- Leaflet: always check `cancelled` flag in `useEffect` to prevent state updates after unmount
- `skipMarkViewedId` in `LeafletMap` prevents re-marking viewed when user clicked "Mark New" before close
- `effectiveVisibility()` runs client-side — RLS must also enforce visibility at DB level or buyers can fetch restricted rows
- When adding DB columns, check for NOT NULL / CHECK constraints (e.g. `properties_status_check`)
