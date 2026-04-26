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

## Notes

- `sharp` is loaded dynamically — OCR falls back to raw images if sharp isn't built
- `drizzle-kit` is in api-server devDependencies for `db:push`
- The old `src/app.ts` proxy server is unused — new `src/index.ts` uses `registerRoutes()` directly
