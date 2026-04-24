import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { Readable } from "stream";
import router from "./routes";
import { logger } from "./lib/logger";

const EXTERNAL_API = process.env["EXTERNAL_API_URL"] || "https://mybudget.mytoolsgroup.eu";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

// Only parse JSON/urlencoded for non-multipart requests
// Multipart (OCR) must pass through as raw stream
app.use((req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    return next();
  }
  express.json()(req, res, () => {
    express.urlencoded({ extended: true })(req, res, next);
  });
});

// Local routes (health check, etc.)
app.use("/api", router);

// Proxy: forward all unhandled /api/* requests to the external backend
app.use("/api", async (req: Request, res: Response) => {
  const targetUrl = `${EXTERNAL_API}/api${req.path}${req.url.includes("?") ? "?" + req.url.split("?")[1] : ""}`;

  const isNoBody = ["GET", "HEAD"].includes(req.method.toUpperCase());
  const contentType = req.headers["content-type"] || "";
  const isMultipart = contentType.includes("multipart/form-data");

  const headers: Record<string, string> = {};

  const authHeader = req.headers["authorization"];
  if (authHeader) headers["Authorization"] = authHeader;

  let body: string | ReadableStream | undefined;

  if (isNoBody) {
    body = undefined;
  } else if (isMultipart) {
    // Forward multipart as a raw stream — preserve original Content-Type with boundary
    headers["Content-Type"] = contentType;
    body = Readable.toWeb(req) as ReadableStream;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(req.body);
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      // @ts-ignore — Node 24 fetch supports duplex for streaming uploads
      duplex: isMultipart ? "half" : undefined,
    });

    res.status(upstream.status);

    const upstreamContentType = upstream.headers.get("content-type");
    if (upstreamContentType) res.setHeader("Content-Type", upstreamContentType);

    const text = await upstream.text();
    res.send(text);
  } catch (err) {
    logger.error({ err, targetUrl }, "Proxy fetch error");
    res.status(502).json({ error: "Proxy error" });
  }
});

export default app;
