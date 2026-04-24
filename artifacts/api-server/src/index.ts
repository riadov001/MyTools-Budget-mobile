import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT: "${rawPort}"`);

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(cors({ origin: true, credentials: true }));

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));

app.use((req, _res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJson: Record<string, unknown> | undefined;
  const origJson = _res.json.bind(_res);
  _res.json = function (body: unknown) {
    capturedJson = body as Record<string, unknown>;
    return origJson(body);
  };
  _res.on("finish", () => {
    const ms = Date.now() - start;
    if (path.startsWith("/api")) {
      let line = `${req.method} ${path} ${_res.statusCode} in ${ms}ms`;
      if (capturedJson) line += ` :: ${JSON.stringify(capturedJson).slice(0, 120)}`;
      logger.info(line);
    }
  });
  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  // In production, serve the built PWA from <dist>/public (added by build script).
  // API routes are registered above and take precedence; everything else falls back to index.html.
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  }

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const e = err as { status?: number; statusCode?: number; message?: string };
    const status = e.status || e.statusCode || 500;
    const message = e.message || "Internal Server Error";
    logger.error({ err }, "Unhandled error");
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  httpServer.listen(port, () => {
    logger.info({ port }, "Server listening");
  });
})();
