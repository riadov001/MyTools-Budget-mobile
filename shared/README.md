# `@mytools/shared` — Cross-artifact shared code

This directory hosts code that is shared between every artifact in the MyTools-Budget monorepo:

- `artifacts/api-server` (Express + Drizzle backend)
- `artifacts/budget-pwa` (React + Vite PWA)
- `artifacts/budget-mobile` (Expo React Native app)

## Layout

```
shared/
├── types/        // Pure TypeScript types and interfaces (no runtime code)
├── schemas/      // Zod and Drizzle schemas (e.g. accounting.ts)
├── lib/          // Shared business logic (e.g. ca.ts — chiffre d'affaires)
├── constants/    // Constants (TVA rates, account types, etc.)
└── utils/        // Pure utility functions (formatters, parsers, …)
```

## Import convention

Always import from this folder via the dedicated namespace `@mytools/shared/*`:

```ts
import { transactions, TransactionSchema } from "@mytools/shared/schemas/accounting";
import { calculateCA } from "@mytools/shared/lib/ca";
import type { Money } from "@mytools/shared/types/money";
```

> **Zero-regression contract**
> The legacy alias `@shared/*` (which already exists in `artifacts/api-server` and `artifacts/budget-pwa` and resolves to each artifact's own local `shared/` directory) is left **completely untouched**. The new alias `@mytools/shared/*` is a separate, additional namespace that resolves only to this root folder. The two never collide.

## How it is wired

| Artifact / tool       | Mechanism                                                            |
| --------------------- | -------------------------------------------------------------------- |
| TypeScript (all)      | `paths` in `tsconfig.base.json` and each artifact `tsconfig.json`    |
| `tsx` (api-server dev) | reads tsconfig `paths` natively                                     |
| `esbuild` (api-server build) | reads tsconfig `paths` natively                               |
| Vite (PWA)            | `resolve.alias` entry in `artifacts/budget-pwa/vite.config.ts`       |
| Metro (Expo mobile)   | custom `resolver.resolveRequest` in `artifacts/budget-mobile/metro.config.js` + `watchFolders` |
| pnpm                  | registered as workspace package `@mytools/shared` (private)          |
