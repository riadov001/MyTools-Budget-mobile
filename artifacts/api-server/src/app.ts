import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Local routes (health check, etc.)
app.use("/api", router);

// Manual proxy: forward all unhandled /api/* requests to the external backend
app.use("/api", async (req: Request, res: Response) => {
  const targetUrl = `${EXTERNAL_API}/api${req.path}${req.url.includes("?") ? "?" + req.url.split("?")[1] : ""}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const authHeader = req.headers["authorization"];
  if (authHeader) headers["Authorization"] = authHeader;

  try {
    const body = ["GET", "HEAD"].includes(req.method.toUpperCase())
      ? undefined
      : JSON.stringify(req.body);

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    res.status(upstream.status);

    const contentType = upstream.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);

    const text = await upstream.text();
    res.send(text);
  } catch (err) {
    logger.error({ err, targetUrl }, "Proxy fetch error");
    res.status(502).json({ error: "Proxy error" });
  }
});

export default app;
