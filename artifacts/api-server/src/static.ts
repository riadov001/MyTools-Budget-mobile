import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * In production, serve the PWA's built static assets from `<distDir>/public`.
 * - API routes (`/api/*`) MUST be registered before calling this so they take precedence.
 * - All other paths fall back to `index.html` for client-side routing.
 * - Hashed assets get a long cache; HTML never caches.
 */
export function serveStatic(app: Express): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.resolve(here, "public");

  if (!fs.existsSync(distPath)) {
    console.warn(
      `[api-server] Static dir not found at ${distPath}; PWA will not be served.`,
    );
    return;
  }

  const indexHtmlPath = path.join(distPath, "index.html");
  if (!fs.existsSync(indexHtmlPath)) {
    console.warn(`[api-server] ${indexHtmlPath} missing; PWA will not be served.`);
    return;
  }

  app.use(
    express.static(distPath, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache");
        } else if (/[/\\]assets[/\\]/.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );

  // SPA fallback — only for non-API GET requests
  app.get("/{*path}", (req, res, next) => {
    if (req.path === "/api" || req.path.startsWith("/api/")) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexHtmlPath);
  });
}
