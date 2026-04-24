import type { Express, Request, Response, NextFunction } from "express";
import { Router } from "express";
import { db } from "./db";
import { apiKeys, apiClients, apiPlans, apiUsage, invoices, expenses, services } from "@shared/schema";
import { eq, and, gte, count, sql, desc } from "drizzle-orm";
import crypto from "crypto";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

// ─── Key hashing ─────────────────────────────────────────────────────────────

export function generateApiKey(environment: "test" | "prod"): { raw: string; hash: string; prefix: string } {
  const secret = crypto.randomBytes(24).toString("hex");
  const prefix = `sk_${environment}_`;
  const raw = `${prefix}${secret}`;
  const hash = crypto.createHmac("sha256", process.env.SESSION_SECRET || "api-secret").update(raw).digest("hex");
  const displayPrefix = raw.slice(0, prefix.length + 8);
  return { raw, hash, prefix: displayPrefix };
}

export function hashApiKey(raw: string): string {
  return crypto.createHmac("sha256", process.env.SESSION_SECRET || "api-secret").update(raw).digest("hex");
}

// ─── Swagger spec ─────────────────────────────────────────────────────────────

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "MyTools Budget Tracker API",
      version: "1.0.0",
      description: "API REST pour intégrer les données de MyTools Budget Tracker dans vos applications PWA. Authentification par clé API (`sk_test_*` ou `sk_prod_*`).",
      contact: { name: "MyJantes", email: "contact@myjantes.com" },
    },
    servers: [
      { url: "/api/v1", description: "Production" },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
          description: "Clé API au format `sk_test_xxx` (test) ou `sk_prod_xxx` (production)",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
        Invoice: {
          type: "object",
          properties: {
            id: { type: "integer" },
            number: { type: "string" },
            clientName: { type: "string" },
            status: { type: "string", enum: ["draft", "sent", "paid", "overdue", "cancelled"] },
            total: { type: "string" },
            currency: { type: "string" },
            issuedDate: { type: "string", format: "date-time" },
            dueDate: { type: "string", format: "date-time" },
          },
        },
        Expense: {
          type: "object",
          properties: {
            id: { type: "integer" },
            description: { type: "string" },
            amount: { type: "string" },
            category: { type: "string" },
            status: { type: "string", enum: ["pending", "approved", "paid", "rejected", "overdue"] },
            date: { type: "string", format: "date-time" },
          },
        },
        Service: {
          type: "object",
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
            provider: { type: "string" },
            cost: { type: "string" },
            currency: { type: "string" },
            status: { type: "string" },
            nextBillingDate: { type: "string", format: "date-time" },
          },
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
  },
  apis: [], // inline docs in this file
});

// ─── Middleware ───────────────────────────────────────────────────────────────

interface ApiRequest extends Request {
  apiClient?: { id: number; name: string; planId: number | null; environment: string; keyId: number };
}

async function apiKeyAuth(req: ApiRequest, res: Response, next: NextFunction) {
  const raw = (req.headers["x-api-key"] as string) || (req.query.api_key as string);
  if (!raw) return res.status(401).json({ error: "API key required", code: "MISSING_API_KEY" });

  const hash = hashApiKey(raw);
  const environment = raw.startsWith("sk_prod_") ? "prod" : "test";

  const [keyRow] = await db
    .select({ key: apiKeys, client: apiClients, plan: apiPlans })
    .from(apiKeys)
    .leftJoin(apiClients, eq(apiKeys.clientId, apiClients.id))
    .leftJoin(apiPlans, eq(apiClients.planId, apiPlans.id))
    .where(and(eq(apiKeys.keyHash, hash), eq(apiKeys.environment, environment)));

  if (!keyRow?.key) return res.status(401).json({ error: "Invalid API key", code: "INVALID_API_KEY" });
  if (keyRow.key.status === "revoked") return res.status(401).json({ error: "API key revoked", code: "REVOKED_KEY" });
  if (keyRow.client?.status === "suspended") return res.status(403).json({ error: "Account suspended", code: "SUSPENDED" });

  // Rate limit check (daily)
  if (keyRow.plan?.requestsPerDay) {
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const [usage] = await db.select({ cnt: count() }).from(apiUsage)
      .where(and(eq(apiUsage.apiKeyId, keyRow.key.id), gte(apiUsage.timestamp, since)));
    if ((usage?.cnt ?? 0) >= keyRow.plan.requestsPerDay) {
      return res.status(429).json({ error: "Daily rate limit exceeded", code: "RATE_LIMIT", limit: keyRow.plan.requestsPerDay });
    }
  }

  req.apiClient = {
    id: keyRow.client!.id,
    name: keyRow.client!.name,
    planId: keyRow.client?.planId ?? null,
    environment,
    keyId: keyRow.key.id,
  };

  // Update last used & count (fire and forget)
  db.update(apiKeys).set({ lastUsedAt: new Date(), requestCount: sql`${apiKeys.requestCount} + 1` })
    .where(eq(apiKeys.id, keyRow.key.id)).catch(() => {});

  next();
}

// ─── Usage tracker middleware ─────────────────────────────────────────────────

function trackUsage(req: ApiRequest, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on("finish", () => {
    if (!req.apiClient) return;
    db.insert(apiUsage).values({
      apiKeyId: req.apiClient.keyId,
      clientId: req.apiClient.id,
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
      responseTimeMs: Date.now() - start,
      environment: req.apiClient.environment,
    }).catch(() => {});
  });
  next();
}

// ─── Setup ────────────────────────────────────────────────────────────────────

export function setupApiGateway(app: Express) {
  // Swagger UI
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: `.swagger-ui .topbar { background: #111; } .swagger-ui .topbar-wrapper img { display:none; } .swagger-ui .topbar-wrapper::after { content: "MyTools API"; color: white; font-size: 18px; font-weight: bold; }`,
    customSiteTitle: "MyTools API Docs",
  }));
  app.get("/api/docs.json", (_req, res) => res.json(swaggerSpec));

  const v1 = Router();
  app.use("/api/v1", apiKeyAuth, trackUsage, v1);

  /**
   * @openapi
   * /status:
   *   get:
   *     summary: Health check
   *     description: Vérifier le statut de l'API et les informations du client
   *     security: [{ApiKeyAuth: []}]
   *     responses:
   *       200:
   *         description: API opérationnelle
   */
  v1.get("/status", (req: ApiRequest, res: Response) => {
    res.json({
      status: "ok",
      version: "1.0.0",
      environment: req.apiClient!.environment,
      client: req.apiClient!.name,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * @openapi
   * /invoices:
   *   get:
   *     summary: Lister les factures
   *     description: Retourne la liste des factures clients
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [draft, sent, paid, overdue, cancelled]
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *     responses:
   *       200:
   *         description: Liste des factures
   */
  v1.get("/invoices", async (req: ApiRequest, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      let query = db.select().from(invoices).orderBy(desc(invoices.createdAt)).limit(limit);
      const data = await query;
      res.json({ data, count: data.length, environment: req.apiClient!.environment });
    } catch { res.status(500).json({ error: "Internal error" }); }
  });

  /**
   * @openapi
   * /invoices/{id}:
   *   get:
   *     summary: Détail d'une facture
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Facture
   *       404:
   *         description: Non trouvée
   */
  v1.get("/invoices/:id", async (req: ApiRequest, res: Response) => {
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, +req.params.id));
    if (!inv) return res.status(404).json({ error: "Invoice not found" });
    res.json(inv);
  });

  /**
   * @openapi
   * /expenses:
   *   get:
   *     summary: Lister les dépenses
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *     responses:
   *       200:
   *         description: Liste des dépenses
   */
  v1.get("/expenses", async (req: ApiRequest, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const data = await db.select().from(expenses).orderBy(desc(expenses.createdAt)).limit(limit);
      res.json({ data, count: data.length, environment: req.apiClient!.environment });
    } catch { res.status(500).json({ error: "Internal error" }); }
  });

  /**
   * @openapi
   * /services:
   *   get:
   *     summary: Lister les abonnements SaaS
   *     responses:
   *       200:
   *         description: Liste des services
   */
  v1.get("/services", async (req: ApiRequest, res: Response) => {
    try {
      const data = await db.select().from(services).where(eq(services.status, "active"));
      res.json({ data, count: data.length, environment: req.apiClient!.environment });
    } catch { res.status(500).json({ error: "Internal error" }); }
  });

  /**
   * @openapi
   * /analytics/summary:
   *   get:
   *     summary: Résumé analytique
   *     description: Totaux factures, dépenses, et ratio par statut
   *     responses:
   *       200:
   *         description: Résumé financier
   */
  v1.get("/analytics/summary", async (req: ApiRequest, res: Response) => {
    try {
      const [invStats] = await db.select({
        total: sql<string>`COALESCE(SUM(CAST(${invoices.total} AS numeric)), 0)`,
        count: count(),
      }).from(invoices).where(eq(invoices.status, "paid"));

      const [expStats] = await db.select({
        total: sql<string>`COALESCE(SUM(CAST(${expenses.total} AS numeric)), 0)`,
        count: count(),
      }).from(expenses);

      const [svcStats] = await db.select({
        total: sql<string>`COALESCE(SUM(CAST(${services.cost} AS numeric)), 0)`,
        count: count(),
      }).from(services).where(eq(services.status, "active"));

      res.json({
        environment: req.apiClient!.environment,
        invoices: { paid: parseFloat(invStats?.total ?? "0"), count: invStats?.count ?? 0 },
        expenses: { total: parseFloat(expStats?.total ?? "0"), count: expStats?.count ?? 0 },
        services: { monthlyTotal: parseFloat(svcStats?.total ?? "0"), active: svcStats?.count ?? 0 },
        generatedAt: new Date().toISOString(),
      });
    } catch { res.status(500).json({ error: "Internal error" }); }
  });

  console.log("[API Gateway] v1 routes mounted — Swagger at /api/docs");
}

// ─── Admin CRUD for API management ───────────────────────────────────────────
// These are exposed on /api/admin/* (protected by app JWT)

export function setupApiAdmin(app: Express, authenticate: any, requireRole: any) {
  const ar = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

  // Plans
  app.get("/api/admin/api-plans", authenticate, ar(async (_req: Request, res: Response) => {
    res.json(await db.select().from(apiPlans).orderBy(apiPlans.name));
  }));
  app.post("/api/admin/api-plans", authenticate, requireRole(["SUPER_ADMIN"]), ar(async (req: Request, res: Response) => {
    const { name, description, requestsPerDay, requestsPerMonth, price, features } = req.body;
    const [row] = await db.insert(apiPlans).values({ name, description, requestsPerDay, requestsPerMonth, price: price?.toString() ?? "0", features: features ? JSON.stringify(features) : null }).returning();
    res.status(201).json(row);
  }));
  app.put("/api/admin/api-plans/:id", authenticate, requireRole(["SUPER_ADMIN"]), ar(async (req: Request, res: Response) => {
    const { name, description, requestsPerDay, requestsPerMonth, price, features, isActive } = req.body;
    const [row] = await db.update(apiPlans).set({ name, description, requestsPerDay, requestsPerMonth, price: price?.toString(), features: features ? JSON.stringify(features) : null, isActive }).where(eq(apiPlans.id, +req.params.id)).returning();
    res.json(row);
  }));
  app.delete("/api/admin/api-plans/:id", authenticate, requireRole(["SUPER_ADMIN"]), ar(async (req: Request, res: Response) => {
    await db.delete(apiPlans).where(eq(apiPlans.id, +req.params.id));
    res.status(204).end();
  }));

  // Clients
  app.get("/api/admin/api-clients", authenticate, ar(async (_req: Request, res: Response) => {
    const rows = await db.select({ client: apiClients, plan: apiPlans })
      .from(apiClients)
      .leftJoin(apiPlans, eq(apiClients.planId, apiPlans.id))
      .orderBy(desc(apiClients.createdAt));
    res.json(rows);
  }));
  app.post("/api/admin/api-clients", authenticate, requireRole(["SUPER_ADMIN"]), ar(async (req: Request, res: Response) => {
    const { name, email, companyName, planId, notes } = req.body;
    const [row] = await db.insert(apiClients).values({ name, email, companyName, planId: planId || null, notes }).returning();
    res.status(201).json(row);
  }));
  app.put("/api/admin/api-clients/:id", authenticate, requireRole(["SUPER_ADMIN"]), ar(async (req: Request, res: Response) => {
    const { name, email, companyName, planId, status, notes } = req.body;
    const [row] = await db.update(apiClients).set({ name, email, companyName, planId: planId || null, status, notes }).where(eq(apiClients.id, +req.params.id)).returning();
    res.json(row);
  }));
  app.delete("/api/admin/api-clients/:id", authenticate, requireRole(["SUPER_ADMIN"]), ar(async (req: Request, res: Response) => {
    await db.delete(apiClients).where(eq(apiClients.id, +req.params.id));
    res.status(204).end();
  }));

  // API Keys
  app.get("/api/admin/api-clients/:clientId/keys", authenticate, ar(async (req: Request, res: Response) => {
    const keys = await db.select().from(apiKeys).where(eq(apiKeys.clientId, +req.params.clientId)).orderBy(desc(apiKeys.createdAt));
    // Never return keyHash
    res.json(keys.map(k => ({ ...k, keyHash: undefined })));
  }));
  app.post("/api/admin/api-clients/:clientId/keys", authenticate, requireRole(["SUPER_ADMIN"]), ar(async (req: Request, res: Response) => {
    const { name, environment } = req.body;
    const env: "test" | "prod" = environment === "prod" ? "prod" : "test";
    const { raw, hash, prefix } = generateApiKey(env);
    const [row] = await db.insert(apiKeys).values({
      clientId: +req.params.clientId,
      name: name || `Clé ${env}`,
      keyHash: hash,
      keyPrefix: prefix,
      environment: env,
      status: "active",
    }).returning();
    // Return raw key ONCE — never stored in plain text
    res.status(201).json({ ...row, keyHash: undefined, rawKey: raw, warning: "Conservez cette clé, elle ne sera plus affichée." });
  }));
  app.delete("/api/admin/api-keys/:id", authenticate, requireRole(["SUPER_ADMIN"]), ar(async (req: Request, res: Response) => {
    await db.update(apiKeys).set({ status: "revoked" }).where(eq(apiKeys.id, +req.params.id));
    res.status(204).end();
  }));

  // Usage
  app.get("/api/admin/api-usage", authenticate, ar(async (req: Request, res: Response) => {
    const clientId = req.query.clientId ? +req.query.clientId : undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    let q = db.select().from(apiUsage).orderBy(desc(apiUsage.timestamp)).limit(limit);
    const data = await q;
    res.json(data);
  }));

  app.get("/api/admin/api-usage/stats", authenticate, ar(async (_req: Request, res: Response) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [todayUsage] = await db.select({ cnt: count() }).from(apiUsage).where(gte(apiUsage.timestamp, today));
    const totalClients = await db.select({ cnt: count() }).from(apiClients).where(eq(apiClients.status, "active"));
    const totalKeys = await db.select({ cnt: count() }).from(apiKeys).where(eq(apiKeys.status, "active"));
    const byEndpoint = await db.select({ endpoint: apiUsage.endpoint, cnt: count() })
      .from(apiUsage).where(gte(apiUsage.timestamp, today)).groupBy(apiUsage.endpoint).orderBy(desc(count()));
    res.json({
      today: { requests: todayUsage?.cnt ?? 0 },
      total: { clients: totalClients[0]?.cnt ?? 0, activeKeys: totalKeys[0]?.cnt ?? 0 },
      topEndpoints: byEndpoint,
    });
  }));
}
