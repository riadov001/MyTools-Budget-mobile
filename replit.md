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

## Notes

- `sharp` is loaded dynamically — OCR falls back to raw images if sharp isn't built
- `drizzle-kit` is in api-server devDependencies for `db:push`
- The old `src/app.ts` proxy server is unused — new `src/index.ts` uses `registerRoutes()` directly
