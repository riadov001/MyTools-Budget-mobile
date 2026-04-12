# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/budget-mobile run dev` — run mobile app

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Budget by MyTools (Mobile App)
- **Package**: `@workspace/budget-mobile`
- **Type**: Expo (React Native)
- **Framework**: Expo SDK 54 with expo-router
- **Font**: Exo 2 (`@expo-google-fonts/exo-2`)
- **Theme**: Always dark mode, near-black (#0A0A0A) background, red (#DC2626) accent
- **Auth**: Email/password via backend JWT + consent gate (RGPD)
- **State**: AuthContext (JWT in expo-secure-store) + React Query
- **API client**: axios with JWT interceptor (`src/api/client.ts`)
- **Backend**: External REST API via `EXPO_PUBLIC_API_URL` env var

### Screens
- `app/welcome.tsx` — Login screen (email + password)
- `app/consent.tsx` — RGPD consent gate
- `app/(tabs)/dashboard.tsx` — Stats overview + recent expenses/invoices
- `app/(tabs)/scan.tsx` — OCR batch scan (camera + gallery)
- `app/(tabs)/agenda.tsx` — URSSAF deadlines + reminders
- `app/(tabs)/budget.tsx` — Expense list + add/delete expenses
- `app/(tabs)/profile.tsx` — User profile + RGPD + legal docs + account

### Environment Variables
- `EXPO_PUBLIC_API_URL` — Backend REST API base URL (set in `.env`)
