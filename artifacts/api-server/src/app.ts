import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { createProxyMiddleware } from "http-proxy-middleware";
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

// Proxy everything else under /api to the external backend
app.use(
  "/api",
  createProxyMiddleware({
    target: EXTERNAL_API,
    changeOrigin: true,
    on: {
      error: (err, _req, res) => {
        logger.error({ err }, "Proxy error");
        if (typeof (res as { headersSent?: boolean }).headersSent !== "undefined") {
          const httpRes = res as import("http").ServerResponse;
          if (!httpRes.headersSent) {
            httpRes.writeHead(502);
            httpRes.end("Proxy error");
          }
        }
      },
    },
  }),
);

export default app;
