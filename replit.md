# Budget by MyTools — Workspace

## Overview

pnpm monorepo with one shared Express backend serving a React Native Expo mobile app and a React PWA.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript**: 5.9
- **API framework**: Express 5 (backend)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod
- **PWA framework**: React + Vite 7
- **Mobile framework**: Expo SDK 54 (React Native)
- **OCR**: Gemini Vision (`@google/genai`) + Mindee

## Architecture

- **One backend**: `artifacts/api-server` — Express at port 8080, routes at `/api/*`
- **Two frontends**:
  - `artifacts/budget-pwa` — React + Vite PWA at port 5173, preview path `/budget-pwa/`
  - `artifacts/budget-mobile` — Expo (React Native) at port 19496, accessed via Expo Go QR code
- **Shared cross-artifact code**: `/shared` (workspace package `@mytools/shared`) — see *Shared folder* section below

## Workflows

| Workflow | Command | Port |
|----------|---------|------|
| Start Backend | `PORT=8080 pnpm --filter @workspace/api-server run dev` | 8080 |
| Start application | Expo bundler for budget-mobile | 19496 |
| artifacts/budget-pwa: Budget PWA | `pnpm --filter @workspace/budget-pwa run dev` | 5173 |

## Key Commands

- `pnpm install` — install all workspace deps
- `pnpm --filter @workspace/api-server run db:push` — push DB schema (uses drizzle-kit)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/budget-pwa run dev` — run PWA
- `pnpm --filter @workspace/budget-mobile run dev` — run Expo mobile

## Routing (Replit proxy at port 80)

- `/api/*` → backend at port 8080
- `/budget-pwa/*` → PWA Vite dev server at port 5173
- Expo mobile → accessed via `$REPLIT_EXPO_DEV_DOMAIN`

## Backend

- **Entry**: `artifacts/api-server/src/index.ts` (tsx dev mode)
- **Routes**: `artifacts/api-server/src/routes.ts` (2193 lines, from GitHub repo)
- **DB schema**: `artifacts/api-server/src/shared/schema.ts`
- **OCR**: `artifacts/api-server/src/services/ocrProcessor.ts` (Gemini vision, sharp optional)
- **Swagger docs**: `/api/docs`
- **Integrations**: `artifacts/api-server/src/replit_integrations/` (object storage, chat, image, batch)

## PWA

- **Entry**: `artifacts/budget-pwa/src/` (React app from GitHub repo)
- **Shared types**: `artifacts/budget-pwa/shared/schema.ts` + `shared/routes.ts`
- **Base path**: Vite uses `BASE_PATH=/budget-pwa/` env var from artifact.toml

## Appointments / iCal Agenda

- **Table** `appointments`: title, startDate/endDate, source (manual/ical/google), externalUid, **amount**, **direction** (income/expense), **status** (pending/paid/overdue/cancelled), paidAt, location, notes
- **Routes**: `GET/POST /api/appointments`, `PATCH/DELETE /api/appointments/:id`, `POST /api/appointments/import` (URL or .ics body)
- **iCal parser**: minimal RFC 5545 (line-folding, VEVENT, UID/SUMMARY/DTSTART/DTEND/LOCATION/DESCRIPTION)
- **SSRF hardened**: only http(s), DNS-resolved IP allowlist (blocks 10.x/192.168.x/172.16-31.x/127.x/169.254/IPv6 ULA & link-local), 10s timeout, 5MB cap, no redirects
- **Dedup**: unique index on (application_id, external_uid)
- **Tenant safety**: PATCH strips applicationId from update payload
- **Integration**: appointments where status=paid contribute to `totalRevenue` (income) or `totalExpenses` (expense) in `/api/analytics/dashboard` AND `/api/accounting/pnl` (revenue/revenueTotal/totalExpenses, monthly breakdown, "Rendez-vous" category line). PWA: paid expense-direction RDV are merged as virtual rows in `expenses.tsx` (negative id, `__source:"appointment"`, pink "Type d'activité : RDV" badge, edit/delete replaced by link to /agenda); paid income-direction RDV are merged the same way in `invoices.tsx` (number `RDV-<id>`). All appointments still appear in `/api/agenda` with type="appointment"; pending/overdue/upcoming in `/api/reminders`. **Reconciliation**: backend auto-sets `paidAt = now()` on POST/PATCH when status transitions to "paid" without an explicit paidAt; P&L uses `paidAt ?? startDate` as the period date so legacy paid RDV without paidAt still reconcile.
- **PWA UI**: `agenda.tsx` — month calendar, full appointment dialog (CRUD), iCal import dialog (URL or file), filter by type

## Mobile App

- **Screens**: welcome, consent (RGPD), dashboard, scan (OCR), agenda, budget, profile
- **Auth**: JWT stored in expo-secure-store
- **Backend URL**: `EXPO_PUBLIC_API_URL` env var

## Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection (auto-provisioned by Replit) |
| `JWT_SECRET` | JWT signing key (falls back to dev default) |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | Gemini OCR (or set via Replit AI integrations) |
| `MINDEE_API_KEY_PROD` | Mindee OCR fallback |
| `RESEND_API_KEY` | Email notifications |
| `STRIPE_SECRET_KEY` | Stripe payments |
| `LINXO_CLIENT_ID` / `LINXO_CLIENT_SECRET` | Open Banking (Linxo) |

## Media / pièces jointes (DEFAULT_OBJECT_STORAGE_ID)

Tous les fichiers (transactions, dépenses, factures, factures fournisseur, rendez-vous, OCR) sont persistés dans Replit Object Storage — aucun fichier sur disque local ni en mémoire.

- **Schéma**: colonnes `attachment_path` + `attachment_name` sur `bank_transactions`, `expenses`, `invoices`, `supplier_invoices`, `appointments`
- **Flux client (3 étapes)**: `POST /api/uploads/request-url` → `PUT` direct GCS → `POST /api/<resource>/:id/attachment {objectPath, attachmentName}`
- **Endpoints attach**: `/api/banking/transactions/:id/attachment`, `/api/expenses/:id/attachment`, `/api/invoices/:id/attachment`, `/api/supplier-invoices/:id/attachment`, `/api/appointments/:id/attachment` — tous tenant-safe (vérifient `applicationId` sauf SUPER/ROOT)
- **OCR auto-save**: `/api/ocr/scan|auto|batch|mindee` sauvent en parallèle le fichier source dans le stockage objet et renvoient `objectPath` + `attachmentName` — le client peut lier directement la dépense créée
- **Helper serveur**: `ObjectStorageService.uploadBuffer(buffer, contentType)` (utilisé par OCR)
- **Composant PWA réutilisable**: `<AttachmentButton linkEndpoint="..." currentPath onUploaded />` — input file caché, lien vers la pièce jointe existante, libellé "Joindre"/"Remplacer"
- **Servir les fichiers**: `GET /objects/*` (déjà câblé par `registerObjectStorageRoutes`)

## Shared folder (`@mytools/shared`)

- Root-level `/shared` directory shared by api-server, budget-pwa and budget-mobile
- Registered in `pnpm-workspace.yaml` as private workspace package `@mytools/shared@1.0.0`
- Deps: `drizzle-orm` (catalog), `zod` (catalog) — symlinked into `shared/node_modules` by pnpm
- Layout: `types/`, `schemas/`, `lib/`, `constants/`, `utils/`
- Imported via the **`@mytools/shared/*`** path alias (e.g. `import { calculateCA } from "@mytools/shared/lib/ca"`)
- **Zero-regression contract**: the legacy per-artifact `@shared/*` alias (which still resolves `@shared/schema` and `@shared/routes` to each artifact's own local `shared/` folder) is left **completely untouched**. The two namespaces never collide.
- Wiring per tool:
  - TypeScript (all): `paths` in `tsconfig.base.json` and per-artifact `tsconfig.json`
  - Vite (PWA): `resolve.alias` entry in `artifacts/budget-pwa/vite.config.ts`
  - Metro (Expo mobile): custom `resolver.resolveRequest` + `watchFolders` in `artifacts/budget-mobile/metro.config.js`
  - api-server tsconfig has `rootDir` removed (typecheck-only config; build uses `esbuild` via `build.mjs`) so files outside `src/` (in `/shared`) can be type-checked.

### Accounting domain (`@mytools/shared/schemas/accounting`)

- New Drizzle schema for the cleaned-up accounting model (Étape 2)
- **All tables and enums live under a dedicated Postgres schema namespace `accounting`** via `pgSchema('accounting')` so they cannot collide with the legacy `public.accounts` / `public.invoices` / `public.payments` defined in `artifacts/api-server/src/shared/schema.ts`
- Tables: `accounts`, `transactions`, `invoices`, `bills`, `payments` — physically `accounting.accounts`, `accounting.transactions`, …
- Enums: `transaction_type`, `invoice_status`, `tva_rate` (Maroc: 0/7/10/14/20), `payment_method`
- Drizzle relations defined for all FKs (`accounts ↔ transactions`, `transactions ↔ payments`, `invoices/bills ↔ payments`, `transactions ↔ invoices/bills`)
- Inferred TypeScript types exported (`Account`, `NewAccount`, `Transaction`, `NewTransaction`, …)
- Zod schemas exported for validation: `AccountSchema`, `TransactionSchema`, `InvoiceSchema`, `BillSchema`, `PaymentSchema` (+ `*Input` helper types)
- Étape 3 will register this file in `artifacts/api-server/drizzle.config.ts` so `db:push` issues `CREATE SCHEMA accounting` and creates the new tables alongside the legacy ones.

### Shared business logic (`@mytools/shared/lib/ca`)

- `calculateCA(transactions, start, end)` — sums `income` transactions in `[start, end]`. Accepts any object shaped like `{ type, amount, dateOperation }` (rows from drizzle, JSON payloads, etc.).

## PWA Help & Onboarding system

A complete in-app documentation, onboarding tour, and contextual help system added without touching any existing module page.

### Files
- **`artifacts/budget-pwa/src/lib/modules-catalog.ts`** — single source of truth for all module metadata (22 modules, 7 groups). Each entry has: route, group, icon, bilingual title/tagline/description, list of features and how-to steps, optional role gating, `isNew` flag. Also exports `GLOSSARY` (12 accounting terms FR/EN) and `FAQ` (8 common questions FR/EN), and `QUICK_START` (5-step onboarding).
- **`artifacts/budget-pwa/src/components/help/guided-tour.tsx`** — reusable interactive spotlight overlay using React portal. Detects DOM targets by selector, draws a 4-div backdrop with cutout + red ring around the highlighted element, displays a positioned card with title/body/progress dots/Précédent/Suivant/Terminer. Keyboard nav (←/→/Esc). Persists completion in `localStorage` under `mytools-tour-completed-v1`. Exports `DEFAULT_TOUR_STEPS` (7 steps covering Dashboard, Invoices, OCR, Payments, Accounting, Analytics, Help).
- **`artifacts/budget-pwa/src/components/help/help-launcher.tsx`** — floating circular `?` button (bottom-right, fixed z-40) mounted globally in `app-layout.tsx`. Expands to a mini-menu with "Visite guidée" and "Centre d'aide" entries. Auto-launches the tour on first login (controlled by `shouldAutoStartTour()`).
- **`artifacts/budget-pwa/src/pages/help.tsx`** — full Help Center page at route `/help` with 4 tabs:
  1. **Démarrer** — overview cards (Pour qui / Ce qu'il fait / Niveau pro), the 5-step quick-start with "Y aller" buttons, and a CTA card to launch the tour.
  2. **Modules** — filterable grid (chips per group, role-aware) of 22 modules; each card expands to show description + features + how-to + "Ouvrir le module" button.
  3. **Glossaire** — accordion of accounting terms (CA, TVA, HT/TTC, partie double, lettrage, bilan, P&L, URSSAF, FEC, DSP2, OCR, Avoir).
  4. **FAQ** — accordion of common questions.
  - Top-level search box filters across modules / glossary / FAQ depending on the active tab.

### Sidebar enhancements (`app-sidebar.tsx`)
- Added **Radix tooltip** on every nav item showing the bilingual title + tagline (delay 400 ms, side="right").
- Added a new bottom group **"Aide & Support"** containing the `/help` entry.
- Added a **"Lancer la visite guidée"** button right under the user badge (red gradient).
- Added a green **NEW** badge support per item (currently on "Module Comptabilité").
- All existing groups, items, order, role-gating, and tests-ids preserved.

### Route registered
- `/help` → `Help` component, behind `ProtectedRoute` (auth required, same as every other module).

## Sidebar reorganization — Opérations clients / internes / fournisseurs

The sidebar groups are now separated by **counterparty type**, not by accounting category:

| Group | Counterparty | Modules |
|---|---|---|
| **Opérations clients** | External clients | Factures clients, Avoirs, Encaissements, Clients |
| **Opérations internes** | None (internal-only) | Journal des écritures, Plan comptable, URSSAF & Impôts, Abonnements SaaS |
| **Opérations fournisseurs** | External suppliers | Factures fournisseurs, Dépenses, Scan OCR, Décaissements, Fournisseurs |
| **Trésorerie** | Banks | Paiements & lettrage, Open Banking |
| **Comptabilité** | (reporting) | Module Comptabilité |

The `modules-catalog.ts` `ModuleGroup` type was extended with `"internal"` and group labels updated accordingly so the `/help` page reflects the same structure.

## Agenda — `validated` status (RDV sans montant)

A new fifth status `"validated"` (label "Validé") was added for appointments with **no monetary impact** (free RDV, internal meetings, deliverables). It works alongside the existing `pending`/`paid`/`overdue`/`cancelled` values — the column type is `text`, so no DB migration needed.

- **Frontend** (`pages/agenda.tsx`):
  - Status dropdown now offers: À faire / **Validé (sans montant)** / Payé / En retard / Annulé
  - New `BadgeCheck` emerald icon + colored badge in the agenda lists
  - Inline help block in the dialog explaining the difference between Validé (no money) and Payé (counts in CA)
- **Backend** (`routes.ts`):
  - `/api/agenda` no longer marks `validated` or `cancelled` appointments as overdue when the date is past
  - `/api/analytics/dashboard` treats `validated` as a final state — only contributes money if `amount > 0` (normally false), preserving CA/expense totals integrity

## Comprehensive CA — every monetary source feeds the dashboard

`/api/analytics/dashboard` now sums revenue from **3 sources** (was 2) to ensure no transaction is missed:

1. **Paid invoices** — `invoices.status === 'paid'` (legacy)
2. **Paid/validated income appointments** — with `amount > 0` (legacy + new validated handling)
3. **Orphan inbound payments** — `payments.direction === 'inbound' && invoiceId == null` (NEW — direct receipts not tied to an invoice were previously ignored in CA)

Same logic mirrored on the expense side (orphan outbound payments). The endpoint now also returns a `revenueBreakdown` and `expenseBreakdown` object (`{ invoices, appointments, orphanPayments, total }`) so the dashboard can show users where their CA comes from. Invoice-linked payments are NOT double-counted — only orphans are added.

## Notes

- `sharp` is loaded dynamically — OCR falls back to raw images if sharp isn't built
- `drizzle-kit` is in api-server devDependencies for `db:push`
- The old `src/app.ts` proxy server is unused — new `src/index.ts` uses `registerRoutes()` directly
