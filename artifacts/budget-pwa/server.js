/**
 * Production static server for the Vite-built PWA.
 * Serves dist/ under BASE_PATH with SPA fallback to index.html.
 * Zero external dependencies — uses Node.js built-ins only.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_ROOT = path.resolve(__dirname, "dist");
const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");
const port = parseInt(process.env.PORT || "5173", 10);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
  ".webmanifest": "application/manifest+json",
};

if (!fs.existsSync(DIST_ROOT)) {
  console.error(`[budget-pwa] dist/ not found at ${DIST_ROOT}. Did the build run?`);
  process.exit(1);
}

const indexHtmlPath = path.join(DIST_ROOT, "index.html");
if (!fs.existsSync(indexHtmlPath)) {
  console.error(`[budget-pwa] dist/index.html missing — build is incomplete.`);
  process.exit(1);
}
const indexHtml = fs.readFileSync(indexHtmlPath);

function send(res, status, contentType, body, extraHeaders) {
  res.writeHead(status, { "content-type": contentType, ...(extraHeaders || {}) });
  res.end(body);
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const isAsset = /\/assets\//.test(filePath) || /\.[a-f0-9]{8,}\./.test(filePath);
  const cacheControl = isAsset ? "public, max-age=31536000, immutable" : "no-cache";
  fs.createReadStream(filePath)
    .on("open", () =>
      res.writeHead(200, { "content-type": contentType, "cache-control": cacheControl }),
    )
    .on("error", () => send(res, 500, "text/plain", "Internal Server Error"))
    .pipe(res);
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    let pathname = decodeURIComponent(url.pathname);

    if (pathname === "/healthz" || pathname === `${basePath}/healthz`) {
      return send(res, 200, "application/json", '{"status":"ok"}');
    }

    if (basePath && pathname.startsWith(basePath)) {
      pathname = pathname.slice(basePath.length) || "/";
    } else if (basePath && pathname !== basePath && pathname !== `${basePath}/`) {
      return send(res, 404, "text/plain", "Not Found");
    }

    const safe = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(DIST_ROOT, safe);
    if (!filePath.startsWith(DIST_ROOT)) return send(res, 403, "text/plain", "Forbidden");

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return serveFile(filePath, res);
    }

    return send(res, 200, "text/html; charset=utf-8", indexHtml, {
      "cache-control": "no-cache",
    });
  } catch (err) {
    console.error("[budget-pwa] request error:", err);
    send(res, 500, "text/plain", "Internal Server Error");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[budget-pwa] static server listening on port ${port} (basePath="${basePath || "/"}")`);
});
