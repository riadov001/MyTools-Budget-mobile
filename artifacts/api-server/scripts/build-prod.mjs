#!/usr/bin/env node
/**
 * Production build orchestrator for the consolidated single-service deployment.
 *
 * Order:
 *   1. Build the PWA with BASE_PATH="/" so it can be served from the root.
 *   2. Build the api-server bundle (esbuild → dist/index.mjs).
 *   3. Copy the PWA's dist/* into api-server's dist/public/.
 *
 * The api-server's `serveStatic` then serves dist/public/ for all non-API routes.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const apiServerDir = path.resolve(__dirname, "..");
const pwaDir = path.resolve(repoRoot, "artifacts/budget-pwa");

function run(cmd, args, { cwd = repoRoot, env = {} } = {}) {
  console.log(`\n$ (cd ${cwd} && ${cmd} ${args.join(" ")})`);
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(" ")} (exit ${result.status})`);
  }
}

console.log("[build-prod] Building PWA with BASE_PATH=/ ...");
run("pnpm", ["--filter", "@workspace/budget-pwa", "run", "build"], {
  env: { BASE_PATH: "/", NODE_ENV: "production" },
});

console.log("[build-prod] Building api-server bundle ...");
run("node", ["./build.mjs"], {
  cwd: apiServerDir,
  env: { NODE_ENV: "production" },
});

const pwaDist = path.join(pwaDir, "dist");
const apiDistPublic = path.join(apiServerDir, "dist", "public");
if (!existsSync(pwaDist)) {
  throw new Error(`PWA dist not found at ${pwaDist}`);
}
console.log(`[build-prod] Copying PWA dist → ${apiDistPublic}`);
rmSync(apiDistPublic, { recursive: true, force: true });
mkdirSync(apiDistPublic, { recursive: true });
cpSync(pwaDist, apiDistPublic, { recursive: true });

console.log("[build-prod] Done.");
