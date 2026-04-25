import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { hashPassword, comparePassword, generateToken, authenticate, requireRole } from "./auth";
import { setupApiGateway, setupApiAdmin } from "./api-gateway";
import { generateDashboardPDF, generateSupplierInvoicePDF, generateExpensesPDF } from "./pdf";
import { setupCron, computeNextOccurrence } from "./cron";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import {
  sendInvoiceNotification, sendWelcomeEmail, sendMonthlyReport,
  sendSupplierInvoicePaidNotification, sendSupplierInvoiceDueReminder, sendPasswordResetEmail,
} from "./email";
import crypto from "crypto";
import { analyzeDocument } from "./ocr";
import * as XLSX from "xlsx";
import multer from "multer";
import Stripe from "stripe";
import { getBridgeAccounts, getBridgeTransactions, createBridgeConnectSession, isBridgeConfigured } from "./bridgeService";
import { getLinxoAccounts, getLinxoTransactions, isLinxoConfigured } from "./linxoService";
import {
  loginSchema, registerSchema,
  insertApplicationSchema, insertServiceSchema, insertReminderSettingsSchema,
  insertAccountSchema, insertClientSchema, insertSupplierSchema,
  insertInvoiceSchema, insertInvoiceItemSchema, insertSupplierInvoiceSchema,
  insertCreditNoteSchema, insertExpenseSchema, insertPaymentSchema, insertJournalEntrySchema,
  insertUserApplicationSchema, insertExpenseCategorySchema,
  insertAppointmentSchema,
} from "@shared/schema";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const isSuperOrRoot = (role: string) => role === "SUPER_ADMIN" || role === "ROOT_ADMIN";

function appId(req: any): number {
  if (isSuperOrRoot(req.user!.role)) {
    const h = parseInt(req.headers["x-app-id"] as string);
    // Fallback to primary app if no header (common for dashboard exports)
    if (!h || isNaN(h)) {
      if (req.user!.applicationId) return req.user!.applicationId;
      throw Object.assign(new Error("Aucune application sélectionnée. Veuillez choisir un SaaS."), { status: 400 });
    }
    return h;
  }
  const id = req.user!.applicationId;
  if (!id) throw Object.assign(new Error("Utilisateur sans application assignée"), { status: 400 });
  return id;
}

// Like appId() but for super/root with no X-App-Id: falls back to first available app in DB
async function appIdOrFallback(req: any): Promise<number> {
  if (isSuperOrRoot(req.user!.role)) {
    const h = parseInt(req.headers["x-app-id"] as string);
    if (h && !isNaN(h)) return h;
    if (req.user!.applicationId) return req.user!.applicationId;
    // Last resort: pick first app from DB
    const apps = await storage.getApplications();
    if (apps.length > 0) return apps[0].id;
    throw Object.assign(new Error("Aucune application disponible dans le système."), { status: 400 });
  }
  const id = req.user!.applicationId;
  if (!id) throw Object.assign(new Error("Utilisateur sans application assignée"), { status: 400 });
  return id;
}

// Wraps async route handlers and forwards errors to Express error handler
const ar = (fn: (req: any, res: any, next?: any) => Promise<any>) =>
  (req: any, res: any, next: any) => fn(req, res, next).catch(next);

// ─── iCal parser (minimal RFC 5545 subset) ────────────────────────────────
type IcalEvent = { uid?: string; summary?: string; description?: string; location?: string; start: Date; end?: Date };

function unfoldICal(raw: string): string[] {
  // RFC 5545: lines starting with space/tab continue the previous line
  const lines = raw.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseICalDate(value: string): Date | null {
  // Forms: 20260425T130000Z, 20260425T130000, 20260425
  const v = value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  const [, y, mo, d, hh, mm, ss, z] = m;
  if (!hh) return new Date(Date.UTC(+y, +mo - 1, +d));
  if (z === "Z") return new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss));
  return new Date(+y, +mo - 1, +d, +hh, +mm, +ss);
}

function unescapeICalText(s: string): string {
  return s.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function parseICal(raw: string): IcalEvent[] {
  const lines = unfoldICal(raw);
  const events: IcalEvent[] = [];
  let cur: Partial<IcalEvent> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { cur = {}; continue; }
    if (line === "END:VEVENT") {
      if (cur && cur.start) events.push(cur as IcalEvent);
      cur = null; continue;
    }
    if (!cur) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const left = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const key = left.split(";")[0].toUpperCase();
    if (key === "UID") cur.uid = value.trim();
    else if (key === "SUMMARY") cur.summary = unescapeICalText(value);
    else if (key === "DESCRIPTION") cur.description = unescapeICalText(value);
    else if (key === "LOCATION") cur.location = unescapeICalText(value);
    else if (key === "DTSTART") { const d = parseICalDate(value); if (d) cur.start = d; }
    else if (key === "DTEND") { const d = parseICalDate(value); if (d) cur.end = d; }
  }
  return events;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  setupCron();
  await seedDatabase();
  await migrateUsers();

  // ─── HEALTH ───────────────────────────────────────────────────────────────
  app.get("/api/healthz", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ─── AUTH ─────────────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    try {
      const input = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(input.email);
      if (!user || !(await comparePassword(input.password, user.password)))
        return res.status(401).json({ message: "Identifiants invalides" });
      const token = generateToken(user);
      const { password, ...u } = user;
      res.json({ token, user: u });
    } catch { res.status(400).json({ message: "Requête invalide" }); }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const input = registerSchema.parse(req.body);
      if (await storage.getUserByEmail(input.email))
        return res.status(400).json({ message: "Email déjà utilisé" });
      let aid = input.applicationId;
      if (!aid) {
        const newApp = await storage.createApplication({ name: `${input.name}'s App`, description: "Auto-créée" });
        aid = newApp.id;
      }
      const hashed = await hashPassword(input.password);
      const role = input.applicationId ? "USER" : "ADMIN";
      const newUser = await storage.createUser({ name: input.name, email: input.email, password: hashed, applicationId: aid, role });
      const token = generateToken(newUser);
      const { password, ...u } = newUser;
      res.status(201).json({ token, user: u });
    } catch (err) {
      if (err instanceof z.ZodError) res.status(400).json({ message: err.errors[0].message });
      else res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get("/api/auth/me", authenticate, (req, res) => {
    const { password, ...u } = req.user!;
    res.json(u);
  });

  app.patch("/api/auth/settings", authenticate, async (req, res) => {
    try {
      const { language } = z.object({ language: z.enum(["fr", "en"]) }).parse(req.body);
      const u = await storage.updateUser(req.user!.id, { language });
      const { password, ...without } = u;
      res.json(without);
    } catch { res.status(400).json({ message: "Requête invalide" }); }
  });

  // ─── CONSENT (RGPD / CGU) ─────────────────────────────────────────────────
  app.post("/api/auth/consent", authenticate, async (req, res) => {
    try {
      const { cgu, privacy, cookies } = z.object({
        cgu: z.boolean().optional(),
        privacy: z.boolean().optional(),
        cookies: z.boolean().optional(),
      }).parse(req.body);
      const now = new Date();
      const updates: Record<string, Date | null> = {};
      if (cgu === true) updates.consentCguAt = now;
      if (privacy === true) updates.consentPrivacyAt = now;
      if (cookies !== undefined) updates.consentCookiesAt = cookies ? now : null;
      const u = await storage.updateUser(req.user!.id, updates as any);
      const { password, ...without } = u;
      res.json({ user: without });
    } catch (err) {
      res.status(400).json({ message: "Requête invalide" });
    }
  });

  // ─── ACCOUNT DELETION ─────────────────────────────────────────────────────
  app.delete("/api/auth/account", authenticate, async (req, res) => {
    try {
      await storage.updateUser(req.user!.id, {
        email: `deleted_${req.user!.id}_${Date.now()}@deleted.local`,
        password: "DELETED",
        name: "Compte supprimé",
      } as any);
      res.json({ message: "Compte supprimé" });
    } catch {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ─── LEGAL TEXTS (CGU / Privacy / Mentions légales) ──────────────────────
  app.get("/api/legal/cgu", (_req, res) => {
    res.json({
      title: "Conditions Générales d'Utilisation",
      updatedAt: "2026-01-01",
      content: `Bienvenue sur Budget by MyTools. En utilisant cette application, vous acceptez les présentes Conditions Générales d'Utilisation. L'application vous permet de gérer votre comptabilité, vos factures, vos dépenses et vos relations bancaires. Vous êtes seul responsable des données que vous saisissez et de leur exactitude.`,
    });
  });

  app.get("/api/legal/privacy", (_req, res) => {
    res.json({
      title: "Politique de Confidentialité",
      updatedAt: "2026-01-01",
      content: `Vos données personnelles sont stockées de manière sécurisée et ne sont jamais revendues. Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Pour exercer ces droits, contactez contact@mytools.fr.`,
    });
  });

  app.get("/api/legal/mentions", (_req, res) => {
    res.json({
      title: "Mentions Légales",
      updatedAt: "2026-01-01",
      content: `Éditeur : MyTools — Application Budget by MyTools. Hébergement : Replit. Pour toute question juridique : contact@mytools.fr.`,
    });
  });

  // ─── FORGOT / RESET PASSWORD ──────────────────────────────────────────────
  app.post("/api/auth/forgot-password", ar(async (req, res) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await storage.getUserByEmail(email);
    // Always return OK (security: don't reveal if email exists)
    if (!user) return res.json({ message: "Si cet email existe, un lien de réinitialisation a été envoyé." });
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await storage.createPasswordResetToken(email, token, expiresAt);
    const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN || "localhost:5000";
    const resetLink = `https://${domain}/reset-password?token=${token}`;
    try {
      await sendPasswordResetEmail({ to: email, name: user.name, resetLink });
    } catch (e) { console.error("Email reset error:", e); }
    res.json({ message: "Si cet email existe, un lien de réinitialisation a été envoyé." });
  }));

  app.post("/api/auth/reset-password", ar(async (req, res) => {
    const { token, password } = z.object({ token: z.string(), password: z.string().min(6) }).parse(req.body);
    const resetToken = await storage.getPasswordResetToken(token);
    if (!resetToken) return res.status(400).json({ message: "Token invalide ou expiré." });
    const user = await storage.getUserByEmail(resetToken.email);
    if (!user) return res.status(400).json({ message: "Utilisateur introuvable." });
    const hashed = await hashPassword(password);
    await storage.updateUser(user.id, { password: hashed });
    await storage.markPasswordResetTokenUsed(resetToken.id);
    res.json({ message: "Mot de passe réinitialisé avec succès." });
  }));

  // ─── BANKING (Stripe Financial Connections / Open Banking) ─────────────────
  function getStripe() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Stripe non configuré");
    return new Stripe(key, { apiVersion: "2026-02-25.clover" });
  }

  // Create a Financial Connections session
  app.post("/api/banking/session", authenticate, ar(async (req, res) => {
    try {
      const stripe = getStripe();
      // Get or create a Stripe customer for this user
      const user = req.user!;
      let customerId: string | undefined;
      const existingAccounts = await storage.getBankAccounts(appId(req));
      const withCustomer = existingAccounts.find(a => a.stripeCustomerId);
      if (withCustomer?.stripeCustomerId) {
        customerId = withCustomer.stripeCustomerId;
      } else {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name || user.email,
          metadata: { userId: String(user.id), appId: String(appId(req)) },
        });
        customerId = customer.id;
      }
      const session = await stripe.financialConnections.sessions.create({
        account_holder: { type: "customer", customer: customerId },
        permissions: ["balances", "transactions", "ownership"],
        filters: { countries: ["FR"] },
      } as any);
      res.json({ clientSecret: session.client_secret, sessionId: session.id, customerId });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  }));

  // Save a Stripe-connected account after Financial Connections flow
  app.post("/api/banking/accounts/stripe", authenticate, ar(async (req, res) => {
    const body = z.object({
      stripeAccountId: z.string(),
      customerId: z.string().optional(),
    }).parse(req.body);
    try {
      const stripe = getStripe();
      const existing = await storage.getBankAccountByStripeId(body.stripeAccountId);
      if (existing) return res.json(existing);
      const stripeAcct = await stripe.financialConnections.accounts.retrieve(body.stripeAccountId);
      const acctAny = stripeAcct as any;
      const institutionName = acctAny.institution_name || "Banque";
      const last4 = acctAny.last4 || null;
      const currency = (acctAny.balance?.current ? Object.keys(acctAny.balance.current)[0] : "eur").toUpperCase();
      const balance = acctAny.balance?.current ? Object.values(acctAny.balance.current as Record<string, number>)[0] : null;
      const account = await storage.createBankAccount({
        stripeAccountId: body.stripeAccountId,
        stripeCustomerId: body.customerId || null,
        institutionName,
        displayName: acctAny.display_name || institutionName,
        last4,
        currency,
        balance: balance ?? null,
        balanceUpdatedAt: balance !== null ? new Date() : null,
        status: "active",
        applicationId: appId(req),
        userId: req.user!.id,
      });
      res.status(201).json(account);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  }));

  app.get("/api/banking/accounts", authenticate, ar(async (req, res) => {
    res.json(await storage.getBankAccounts(appId(req)));
  }));

  // Sync balance and transactions for a connected account
  app.post("/api/banking/accounts/:id/sync", authenticate, ar(async (req, res) => {
    const account = await storage.getBankAccount(+req.params.id);
    if (!account) return res.status(404).json({ message: "Compte introuvable" });
    if (account.stripeAccountId.startsWith("manual_")) return res.status(400).json({ message: "Synchronisation non disponible pour les comptes manuels" });
    try {
      const stripe = getStripe();
      // Refresh balance
      const balance = await stripe.financialConnections.accounts.retrieveBalance(account.stripeAccountId) as any;
      const balanceAmount = balance?.current ? Object.values(balance.current as Record<string, number>)[0] : null;
      await storage.updateBankAccount(account.id, {
        balance: balanceAmount ?? account.balance,
        balanceUpdatedAt: new Date(),
      });
      // Refresh transactions
      const txList = await stripe.financialConnections.accounts.listTransactions(account.stripeAccountId, { limit: 100 }) as any;
      let synced = 0;
      for (const tx of (txList.data || [])) {
        await storage.upsertBankTransaction({
          bankAccountId: account.id,
          stripeTransactionId: tx.id,
          amount: tx.amount,
          currency: (tx.currency || "eur").toUpperCase(),
          description: tx.description || null,
          transactedAt: tx.transacted_at ? new Date(tx.transacted_at * 1000) : null,
          status: tx.status || "posted",
          category: tx.livemode !== undefined ? null : null,
          applicationId: account.applicationId,
        });
        synced++;
      }
      const updated = await storage.getBankAccount(account.id);
      res.json({ message: `Synchronisé: ${synced} transactions`, account: updated });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  }));

  // Get transactions for an account
  app.get("/api/banking/accounts/:id/transactions", authenticate, ar(async (req, res) => {
    const account = await storage.getBankAccount(+req.params.id);
    if (!account) return res.status(404).json({ message: "Compte introuvable" });
    res.json(await storage.getBankTransactions(account.id));
  }));

  app.delete("/api/banking/accounts/:id", authenticate, ar(async (req, res) => {
    const account = await storage.getBankAccount(+req.params.id);
    if (account) await storage.deleteBankTransactionsByAccount(account.id);
    await storage.deleteBankAccount(+req.params.id);
    res.status(204).end();
  }));

  // Manual bank account (fallback when Stripe FC not available)
  app.post("/api/banking/accounts/manual", authenticate, ar(async (req, res) => {
    const aid = appId(req);
    const body = z.object({
      institutionName: z.string(),
      displayName: z.string(),
      last4: z.string().max(4).optional(),
      currency: z.string().default("EUR"),
    }).parse(req.body);
    const account = await storage.createBankAccount({
      stripeAccountId: `manual_${crypto.randomBytes(8).toString("hex")}`,
      institutionName: body.institutionName,
      displayName: body.displayName,
      last4: body.last4 || null,
      currency: body.currency,
      status: "active",
      balance: null,
      balanceUpdatedAt: null,
      stripeCustomerId: null,
      applicationId: aid,
      userId: req.user!.id,
    });
    res.status(201).json(account);
  }));

  // ─── OPEN BANKING PROVIDERS STATUS ──────────────────────────────────────────
  app.get("/api/banking/providers", authenticate, ar(async (_req, res) => {
    res.json({
      stripe: !!process.env.STRIPE_SECRET_KEY,
      bridge: isBridgeConfigured(),
      linxo: isLinxoConfigured(),
    });
  }));

  // ─── BRIDGE OPEN BANKING ──────────────────────────────────────────────────
  app.post("/api/banking/bridge/connect", authenticate, ar(async (req, res) => {
    if (!isBridgeConfigured()) return res.status(400).json({ message: "Bridge API non configurée. Ajoutez BRIDGE_API_KEY et BRIDGE_CLIENT_ID." });
    const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN || "localhost";
    const redirectUrl = `https://${domain}/banking`;
    const url = await createBridgeConnectSession(String(req.user!.id), redirectUrl);
    if (!url) return res.status(500).json({ message: "Impossible de créer la session Bridge" });
    res.json({ connectUrl: url });
  }));

  app.post("/api/banking/bridge/sync", authenticate, ar(async (req, res) => {
    if (!isBridgeConfigured()) return res.status(400).json({ message: "Bridge API non configurée" });
    const aid = appId(req);
    const bridgeAccounts = await getBridgeAccounts(String(req.user!.id));
    let imported = 0;
    for (const ba of bridgeAccounts) {
      let account = await storage.getBankAccountByStripeId(`bridge_${ba.id}`);
      if (!account) {
        account = await storage.createBankAccount({
          stripeAccountId: `bridge_${ba.id}`,
          institutionName: ba.bank_name || "Bridge",
          displayName: ba.name || "Compte Bridge",
          last4: ba.iban ? ba.iban.slice(-4) : null,
          currency: (ba.currency || "EUR").toUpperCase(),
          balance: ba.balance,
          balanceUpdatedAt: new Date(),
          status: "active",
          stripeCustomerId: null,
          applicationId: aid,
          userId: req.user!.id,
        });
      } else {
        await storage.updateBankAccount(account.id, { balance: ba.balance, balanceUpdatedAt: new Date() });
      }
      const transactions = await getBridgeTransactions(ba.id);
      for (const t of transactions) {
        await storage.upsertBankTransaction({
          bankAccountId: account.id,
          stripeTransactionId: `bridge_tx_${t.id}`,
          amount: Math.round(Number(t.amount)),
          currency: (t.currency || "EUR").toUpperCase(),
          description: t.description || null,
          transactedAt: t.date ? new Date(t.date) : null,
          status: "posted",
          category: t.category || null,
          importSource: "bridge",
          applicationId: aid,
        });
        imported++;
      }
    }
    res.json({ message: `Bridge: ${bridgeAccounts.length} comptes, ${imported} transactions synchronisés` });
  }));

  // ─── LINXO OPEN BANKING ──────────────────────────────────────────────────
  app.post("/api/banking/linxo/sync", authenticate, ar(async (req, res) => {
    if (!isLinxoConfigured()) return res.status(400).json({ message: "Linxo API non configurée. Ajoutez LINXO_API_KEY." });
    const aid = appId(req);
    const linxoAccounts = await getLinxoAccounts(String(req.user!.id));
    let imported = 0;
    for (const la of linxoAccounts) {
      let account = await storage.getBankAccountByStripeId(`linxo_${la.id}`);
      if (!account) {
        account = await storage.createBankAccount({
          stripeAccountId: `linxo_${la.id}`,
          institutionName: la.bank_name || "Linxo",
          displayName: la.name || "Compte Linxo",
          last4: la.iban ? la.iban.slice(-4) : null,
          currency: (la.currency || "EUR").toUpperCase(),
          balance: la.balance,
          balanceUpdatedAt: new Date(),
          status: "active",
          stripeCustomerId: null,
          applicationId: aid,
          userId: req.user!.id,
        });
      } else {
        await storage.updateBankAccount(account.id, { balance: la.balance, balanceUpdatedAt: new Date() });
      }
      const transactions = await getLinxoTransactions(la.id);
      for (const t of transactions) {
        await storage.upsertBankTransaction({
          bankAccountId: account.id,
          stripeTransactionId: `linxo_tx_${t.id}`,
          amount: Math.round(Number(t.amount)),
          currency: (t.currency || "EUR").toUpperCase(),
          description: t.description || null,
          transactedAt: t.date ? new Date(t.date) : null,
          status: "posted",
          category: t.category || null,
          importSource: "linxo",
          applicationId: aid,
        });
        imported++;
      }
    }
    res.json({ message: `Linxo: ${linxoAccounts.length} comptes, ${imported} transactions synchronisés` });
  }));

  // ─── ROOT ADMIN GLOBAL STATS ───────────────────────────────────────────────
  app.get("/api/admin/global-stats", authenticate, requireRole(["ROOT_ADMIN"]), ar(async (req, res) => {
    const stats = await storage.getGlobalStats();
    const systemStatus = {
      resend: !!process.env.RESEND_API_KEY,
      stripe: !!process.env.STRIPE_SECRET_KEY,
      bridge: isBridgeConfigured(),
      linxo: isLinxoConfigured(),
      mindee: !!(process.env.MINDEE_API_KEY_PROD || process.env.MINDEE_API_KEY),
      gemini: !!(process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
      plaid: !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET),
    };
    res.json({ ...stats, systemStatus });
  }));

  // ─── APPLICATIONS ─────────────────────────────────────────────────────────
  app.get("/api/applications", authenticate, requireRole(["SUPER_ADMIN"]), async (req, res) => {
    res.json(await storage.getApplications());
  });

  // ─── USER ↔ APP LINKS (multi-tenant admin) ────────────────────────────────
  // Get applications accessible to a user (for multi-app admins)
  app.get("/api/users/:id/applications", authenticate, requireRole(["SUPER_ADMIN"]), async (req, res) => {
    const links = await storage.getUserApplications(+req.params.id);
    res.json(links);
  });
  // Assign a user to an application
  app.post("/api/users/:id/applications", authenticate, requireRole(["SUPER_ADMIN"]), async (req, res) => {
    try {
      const { applicationId } = z.object({ applicationId: z.coerce.number() }).parse(req.body);
      const link = await storage.addUserApplication(+req.params.id, applicationId);
      // Also update primary applicationId if user has none
      const user = await storage.getUser(+req.params.id);
      if (user && !user.applicationId) {
        await storage.updateUser(+req.params.id, { applicationId });
      }
      res.status(201).json(link);
    } catch { res.status(400).json({ message: "Données invalides" }); }
  });
  // Remove a user from an application
  app.delete("/api/users/:id/applications/:appId", authenticate, requireRole(["SUPER_ADMIN"]), async (req, res) => {
    await storage.removeUserApplication(+req.params.id, +req.params.appId);
    res.status(204).end();
  });
  // Users management
  app.get("/api/users", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), async (req, res) => {
    if (isSuperOrRoot(req.user!.role)) {
      const xAppId = parseInt(req.headers["x-app-id"] as string);
      const qAppId = req.query.applicationId ? parseInt(req.query.applicationId as string) : null;
      const filterAppId = xAppId || qAppId;
      if (filterAppId) {
        const list = await storage.getUsersByApp(filterAppId);
        return res.json(list.map(({ password, ...u }) => u));
      }
      // No filter: return all users across all apps
      const allApps = await storage.getApplications();
      const results: any[] = [];
      const seen = new Set<number>();
      for (const app of allApps) {
        const list = await storage.getUsersByApp(app.id);
        for (const u of list) {
          if (!seen.has(u.id)) { seen.add(u.id); const { password, ...rest } = u; results.push(rest); }
        }
      }
      return res.json(results);
    }
    const target = req.user!.applicationId;
    if (!target) return res.json([]);
    const list = await storage.getUsersByApp(target);
    res.json(list.map(({ password, ...u }) => u));
  });
  app.post("/api/users", authenticate, requireRole(["SUPER_ADMIN"]), async (req, res) => {
    try {
      const { name, email, password, role, applicationId } = z.object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(["USER", "ADMIN", "SUPER_ADMIN", "ROOT_ADMIN"]),
        applicationId: z.coerce.number().optional(),
      }).parse(req.body);
      // Only ROOT_ADMIN can create ROOT_ADMIN users
      if (role === "ROOT_ADMIN" && req.user!.role !== "ROOT_ADMIN")
        return res.status(403).json({ message: "Seul un Root Admin peut créer un Root Admin" });
      if (await storage.getUserByEmail(email))
        return res.status(400).json({ message: "Email déjà utilisé" });
      const hashed = await hashPassword(password);
      const user = await storage.createUser({ name, email, password: hashed, role, applicationId: applicationId ?? null });
      if (applicationId) await storage.addUserApplication(user.id, applicationId);
      const { password: _, ...u } = user;
      res.status(201).json(u);
    } catch (err: any) {
      if (err instanceof z.ZodError) res.status(400).json({ message: err.errors[0].message });
      else res.status(500).json({ message: "Erreur serveur" });
    }
  });
  app.put("/api/users/:id", authenticate, requireRole(["SUPER_ADMIN"]), async (req, res) => {
    try {
      const { name, email, password, role, applicationId } = z.object({
        name: z.string().min(2).optional(),
        email: z.string().email().optional(),
        password: z.string().min(6).optional(),
        role: z.enum(["USER", "ADMIN", "SUPER_ADMIN", "ROOT_ADMIN"]).optional(),
        applicationId: z.coerce.number().nullable().optional(),
      }).parse(req.body);
      // Only ROOT_ADMIN can assign ROOT_ADMIN role
      if (role === "ROOT_ADMIN" && req.user!.role !== "ROOT_ADMIN")
        return res.status(403).json({ message: "Seul un Root Admin peut attribuer le rôle Root Admin" });
      const updates: any = {};
      if (name) updates.name = name;
      if (email) updates.email = email;
      if (role) updates.role = role;
      if (applicationId !== undefined) updates.applicationId = applicationId;
      if (password) updates.password = await hashPassword(password);
      const user = await storage.updateUser(+req.params.id, updates);
      const { password: _, ...u } = user;
      res.json(u);
    } catch (err: any) {
      if (err instanceof z.ZodError) res.status(400).json({ message: err.errors[0].message });
      else res.status(500).json({ message: "Erreur serveur" });
    }
  });
  app.delete("/api/users/:id", authenticate, requireRole(["SUPER_ADMIN"]), async (req, res) => {
    await storage.deleteUser(+req.params.id);
    res.status(204).end();
  });
  app.post("/api/applications", authenticate, requireRole(["SUPER_ADMIN"]), async (req, res) => {
    try { res.status(201).json(await storage.createApplication(insertApplicationSchema.parse(req.body))); }
    catch { res.status(400).json({ message: "Données invalides" }); }
  });
  app.get("/api/applications/:id", authenticate, async (req, res) => {
    const a = await storage.getApplication(+req.params.id);
    if (!a) return res.status(404).json({ message: "Non trouvée" });
    res.json(a);
  });
  app.put("/api/applications/:id", authenticate, requireRole(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
    try { res.json(await storage.updateApplication(+req.params.id, insertApplicationSchema.partial().parse(req.body))); }
    catch { res.status(400).json({ message: "Données invalides" }); }
  });

  // ─── SERVICES ─────────────────────────────────────────────────────────────
  app.get("/api/services", authenticate, async (req, res) => {
    const appIdStr = req.query.applicationId as string;
    const isGlobalStr = req.query.isGlobal as string;
    let target = req.user!.applicationId;
    if (isSuperOrRoot(req.user!.role) && appIdStr) target = parseInt(appIdStr);
    const isGlobal = isGlobalStr === "true" ? true : isGlobalStr === "false" ? false : undefined;
    const svcs = (isSuperOrRoot(req.user!.role) && !appIdStr)
      ? await storage.getServices(undefined, isGlobal)
      : await storage.getServices(target ?? undefined, isGlobal);
    res.json(svcs);
  });
  app.post("/api/services", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), async (req, res) => {
    try {
      const input = insertServiceSchema.parse(req.body);
      if (!isSuperOrRoot(req.user!.role)) input.applicationId = req.user!.applicationId;
      res.status(201).json(await storage.createService(input));
    } catch { res.status(400).json({ message: "Données invalides" }); }
  });
  app.put("/api/services/:id", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), async (req, res) => {
    try { res.json(await storage.updateService(+req.params.id, insertServiceSchema.partial().parse(req.body))); }
    catch { res.status(400).json({ message: "Données invalides" }); }
  });
  app.delete("/api/services/:id", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), async (req, res) => {
    await storage.deleteService(+req.params.id); res.status(204).end();
  });

  // ─── ANALYTICS / DASHBOARD ────────────────────────────────────────────────
  app.get("/api/analytics/dashboard", authenticate, async (req, res) => {
    let target = req.user!.applicationId;
    const headerAppId = req.headers["x-app-id"];
    let svcs, invList, expList, payList;
    
    // If X-App-Id header is missing/0 and user is super/root, aggregate all apps
    if (isSuperOrRoot(req.user!.role) && (!headerAppId || headerAppId === "0")) {
      // Aggregate across all apps
      const allApps = await storage.getApplications();
      const allSvcs: any[] = [];
      const allInv: any[] = [];
      const allExp: any[] = [];
      const allPay: any[] = [];
      
      for (const app of allApps) {
        const [s, i, e, p] = await Promise.all([
          storage.getServices(app.id),
          storage.getInvoices(app.id),
          storage.getExpenses(app.id),
          storage.getPayments(app.id),
        ]);
        allSvcs.push(...s);
        allInv.push(...i);
        allExp.push(...e);
        allPay.push(...p);
      }
      
      svcs = allSvcs;
      invList = allInv;
      expList = allExp;
      payList = allPay;
    } else {
      if (isSuperOrRoot(req.user!.role) && headerAppId)
        target = parseInt(headerAppId as string);

      [svcs, invList, expList, payList] = await Promise.all([
        storage.getServices(target ?? undefined),
        target ? storage.getInvoices(target) : Promise.resolve([]),
        target ? storage.getExpenses(target) : Promise.resolve([]),
        target ? storage.getPayments(target) : Promise.resolve([]),
      ]);
    }

    // Appointments — paid ones contribute to revenue/expense
    let apptList: any[] = [];
    if (isSuperOrRoot(req.user!.role) && (!headerAppId || headerAppId === "0")) {
      const allApps = await storage.getApplications();
      for (const app of allApps) apptList.push(...await storage.getAppointments(app.id));
    } else if (target) {
      apptList = await storage.getAppointments(target);
    }

    let monthlyTotal = 0, activeServices = 0;
    const expByCat: Record<string, number> = {};
    svcs.forEach(s => {
      if (s.status === "active") {
        activeServices++;
        const c = parseFloat(s.cost as any);
        const m = s.billingType === "yearly" ? c / 12 : c;
        monthlyTotal += m;
        expByCat[s.category] = (expByCat[s.category] || 0) + m;
      }
    });

    const now = new Date();
    // Auto-compute overdue: unpaid with dueDate in the past
    const resolvedExpenses = expList.map(e => {
      if (e.status === "unpaid" && e.dueDate && new Date(e.dueDate) < now) {
        return { ...e, status: "overdue" };
      }
      return e;
    });

    const apptIncome = apptList
      .filter(a => a.status === "paid" && a.direction === "income" && a.amount != null)
      .reduce((s, a) => s + parseFloat(a.amount as any), 0);
    const apptExpense = apptList
      .filter(a => a.status === "paid" && a.direction === "expense" && a.amount != null)
      .reduce((s, a) => s + parseFloat(a.amount as any), 0);

    const totalRevenue = invList.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.total as any), 0) + apptIncome;
    const totalExpenses = resolvedExpenses.reduce((s, e) => s + parseFloat(e.total as any), 0) + apptExpense;
    const expensesPaid = resolvedExpenses.filter(e => e.status === "paid").reduce((s, e) => s + parseFloat(e.total as any), 0);
    const expensesUnpaid = resolvedExpenses.filter(e => e.status === "unpaid").reduce((s, e) => s + parseFloat(e.total as any), 0);
    const expensesOverdue = resolvedExpenses.filter(e => e.status === "overdue").reduce((s, e) => s + parseFloat(e.total as any), 0);
    const totalPaid = payList.filter(p => p.direction === "inbound").reduce((s, p) => s + parseFloat(p.amount as any), 0);
    const totalOutbound = payList.filter(p => p.direction === "outbound").reduce((s, p) => s + parseFloat(p.amount as any), 0);
    const pendingInvoices = invList.filter(i => i.status === "sent" || i.status === "overdue").length;
    const overdueInvoices = invList.filter(i => i.status === "overdue").length;

    // Expenses by category (real expense data)
    const expByCatReal: Record<string, number> = {};
    resolvedExpenses.forEach(e => {
      expByCatReal[e.category] = (expByCatReal[e.category] || 0) + parseFloat(e.total as any);
    });

    // Expenses by payment method
    const expByMethod: Record<string, number> = {};
    resolvedExpenses.forEach(e => {
      const m = e.paymentMethod || "non renseigné";
      expByMethod[m] = (expByMethod[m] || 0) + parseFloat(e.total as any);
    });

    const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
    const expByMonth = months.map((m, i) => {
      const monthExp = resolvedExpenses.filter(e => {
        const d = new Date(e.date!);
        return d.getMonth() === i && d.getFullYear() === now.getFullYear();
      }).reduce((s, e) => s + parseFloat(e.total as any), 0);
      return { month: m, amount: monthExp || (i <= now.getMonth() ? monthlyTotal * (0.8 + i * 0.03) : 0) };
    });

    const upcomingPayments = svcs.filter(s => s.status === "active")
      .sort((a, b) => new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime())
      .slice(0, 5);

    res.json({
      monthlyTotal, yearlyTotal: monthlyTotal * 12, activeServices,
      upcomingPayments, expensesByMonth: expByMonth,
      expensesByCategory: Object.entries(expByCatReal).map(([category, amount]) => ({ category, amount })),
      expensesByPaymentMethod: Object.entries(expByMethod).map(([method, amount]) => ({ method, amount })),
      expensesByApp: [],
      burnRate: monthlyTotal, projection12Months: monthlyTotal * 12 * 1.1,
      totalRevenue, totalExpenses, totalPaid, totalOutbound,
      expensesPaid, expensesUnpaid, expensesOverdue,
      pendingInvoices, overdueInvoices,
      invoiceCount: invList.length, expenseCount: resolvedExpenses.length,
    });
  });

  const errH = (err: any, res: any) => {
    if (err?.status) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(400).json({ message: "Données invalides" });
  };

  // ─── ACCOUNTS (Plan Comptable) ────────────────────────────────────────────
  app.get("/api/accounts", authenticate, ar(async (req, res) => {
    res.json(await storage.getAccounts(appId(req)));
  }));
  app.post("/api/accounts", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    try {
      const input = { ...insertAccountSchema.parse(req.body), applicationId: appId(req) };
      res.status(201).json(await storage.createAccount(input));
    } catch (e: any) { errH(e, res); }
  }));
  app.put("/api/accounts/:id", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    try { res.json(await storage.updateAccount(+req.params.id, insertAccountSchema.partial().parse(req.body))); }
    catch (e: any) { errH(e, res); }
  }));
  app.delete("/api/accounts/:id", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    await storage.deleteAccount(+req.params.id); res.status(204).end();
  }));

  // ─── CLIENTS ──────────────────────────────────────────────────────────────
  app.get("/api/clients", authenticate, ar(async (req, res) => {
    res.json(await storage.getClients(appId(req)));
  }));
  app.post("/api/clients", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    try {
      const input = { ...insertClientSchema.parse(req.body), applicationId: appId(req) };
      res.status(201).json(await storage.createClient(input));
    } catch (e: any) { errH(e, res); }
  }));
  app.put("/api/clients/:id", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    try { res.json(await storage.updateClient(+req.params.id, insertClientSchema.partial().parse(req.body))); }
    catch (e: any) { errH(e, res); }
  }));
  app.delete("/api/clients/:id", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    await storage.deleteClient(+req.params.id); res.status(204).end();
  }));

  // ─── SUPPLIERS ────────────────────────────────────────────────────────────
  app.get("/api/suppliers", authenticate, ar(async (req, res) => {
    res.json(await storage.getSuppliers(appId(req)));
  }));
  app.post("/api/suppliers", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    try {
      const input = { ...insertSupplierSchema.parse(req.body), applicationId: appId(req) };
      res.status(201).json(await storage.createSupplier(input));
    } catch (e: any) { errH(e, res); }
  }));
  app.put("/api/suppliers/:id", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    try { res.json(await storage.updateSupplier(+req.params.id, insertSupplierSchema.partial().parse(req.body))); }
    catch (e: any) { errH(e, res); }
  }));
  app.delete("/api/suppliers/:id", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    await storage.deleteSupplier(+req.params.id); res.status(204).end();
  }));

  // ─── INVOICES ─────────────────────────────────────────────────────────────
  app.get("/api/invoices", authenticate, ar(async (req, res) => {
    res.json(await storage.getInvoices(appId(req)));
  }));
  app.get("/api/invoices/:id", authenticate, ar(async (req, res) => {
    const inv = await storage.getInvoice(+req.params.id);
    if (!inv) return res.status(404).json({ message: "Non trouvée" });
    const items = await storage.getInvoiceItems(inv.id);
    res.json({ ...inv, items });
  }));
  app.post("/api/invoices", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    try {
      const { items, ...invoiceData } = req.body;
      const parsed = insertInvoiceSchema.parse(invoiceData);
      // Server-authoritative recurrence scheduling (calendar-stable, never trusts client math)
      const input = {
        ...parsed,
        applicationId: appId(req),
        nextOccurrenceDate: parsed.isRecurring && parsed.recurrenceFrequency
          ? computeNextOccurrence(new Date(parsed.issuedDate), parsed.recurrenceFrequency, parsed.recurrenceInterval ?? 1)
          : null,
      };
      const inv = await storage.createInvoice(input);
      if (items && Array.isArray(items)) {
        for (const item of items) {
          await storage.createInvoiceItem({ ...item, invoiceId: inv.id });
        }
      }
      const savedItems = await storage.getInvoiceItems(inv.id);
      res.status(201).json({ ...inv, items: savedItems });
    } catch (e: any) { errH(e, res); }
  }));
  app.put("/api/invoices/:id", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    try {
      const { items, ...invoiceData } = req.body;
      const parsed = insertInvoiceSchema.partial().parse(invoiceData);
      // If recurrence is being (re)enabled or its frequency/anchor changed, recompute server-side
      if (parsed.isRecurring && parsed.recurrenceFrequency && (parsed.issuedDate || parsed.nextOccurrenceDate == null)) {
        const anchor = parsed.issuedDate ? new Date(parsed.issuedDate) : new Date();
        parsed.nextOccurrenceDate = computeNextOccurrence(anchor, parsed.recurrenceFrequency, parsed.recurrenceInterval ?? 1);
      } else if (parsed.isRecurring === false) {
        parsed.nextOccurrenceDate = null;
      }
      const inv = await storage.updateInvoice(+req.params.id, parsed);
      if (items && Array.isArray(items)) {
        await storage.deleteInvoiceItems(inv.id);
        for (const item of items) {
          await storage.createInvoiceItem({ ...item, invoiceId: inv.id });
        }
      }
      const savedItems = await storage.getInvoiceItems(inv.id);
      res.json({ ...inv, items: savedItems });
    } catch (e: any) { errH(e, res); }
  }));
  app.delete("/api/invoices/:id", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    await storage.deleteInvoice(+req.params.id); res.status(204).end();
  }));

  // ─── SUPPLIER INVOICES ────────────────────────────────────────────────────
  app.get("/api/supplier-invoices", authenticate, ar(async (req, res) => {
    res.json(await storage.getSupplierInvoices(appId(req)));
  }));
  app.get("/api/supplier-invoices/:id/pdf", authenticate, ar(async (req, res) => {
    const inv = await storage.getSupplierInvoice(+req.params.id);
    if (!inv) return res.status(404).json({ message: "Non trouvée" });
    try {
      const pdfBuffer = await generateSupplierInvoicePDF(inv as any);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="facture-fournisseur-${inv.number}.pdf"`);
      res.send(pdfBuffer);
    } catch (e: any) {
      console.error("PDF generation error:", e);
      res.status(500).json({ message: "Erreur génération PDF" });
    }
  }));
  app.post("/api/supplier-invoices", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    try {
      const input = { ...insertSupplierInvoiceSchema.parse(req.body), applicationId: appId(req) };
      res.status(201).json(await storage.createSupplierInvoice(input));
    } catch (e: any) { errH(e, res); }
  }));
  app.put("/api/supplier-invoices/:id", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    try {
      const existing = await storage.getSupplierInvoice(+req.params.id);
      const updated = await storage.updateSupplierInvoice(+req.params.id, insertSupplierInvoiceSchema.partial().parse(req.body));
      // Send payment notification when status changes to "paid"
      if (existing && existing.status !== "paid" && updated.status === "paid" && process.env.RESEND_API_KEY) {
        sendSupplierInvoicePaidNotification({
          invoiceNumber: updated.number,
          supplierName: updated.supplierName,
          total: updated.total as string,
          currency: updated.currency,
          paidDate: new Date().toLocaleDateString("fr-FR"),
        }).catch(console.error);
      }
      res.json(updated);
    } catch (e: any) { errH(e, res); }
  }));
  app.delete("/api/supplier-invoices/:id", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    await storage.deleteSupplierInvoice(+req.params.id); res.status(204).end();
  }));

  // ─── CREDIT NOTES ─────────────────────────────────────────────────────────
  app.get("/api/credit-notes", authenticate, ar(async (req, res) => {
    res.json(await storage.getCreditNotes(appId(req)));
  }));
  app.post("/api/credit-notes", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    try {
      const input = { ...insertCreditNoteSchema.parse(req.body), applicationId: appId(req) };
      res.status(201).json(await storage.createCreditNote(input));
    } catch (e: any) { errH(e, res); }
  }));
  app.put("/api/credit-notes/:id", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    try { res.json(await storage.updateCreditNote(+req.params.id, insertCreditNoteSchema.partial().parse(req.body))); }
    catch (e: any) { errH(e, res); }
  }));
  app.delete("/api/credit-notes/:id", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    await storage.deleteCreditNote(+req.params.id); res.status(204).end();
  }));

  // ─── EXPENSES ─────────────────────────────────────────────────────────────
  app.get("/api/expenses", authenticate, ar(async (req, res) => {
    res.json(await storage.getExpenses(appId(req)));
  }));
  app.post("/api/expenses", authenticate, ar(async (req, res) => {
    try {
      const parsed = insertExpenseSchema.parse(req.body);
      const input = {
        ...parsed,
        applicationId: appId(req),
        userId: req.user!.id,
        // Server-authoritative recurrence scheduling
        nextOccurrenceDate: parsed.isRecurring && parsed.recurrenceFrequency
          ? computeNextOccurrence(new Date(parsed.date), parsed.recurrenceFrequency, parsed.recurrenceInterval ?? 1)
          : null,
      };
      res.status(201).json(await storage.createExpense(input));
    } catch (e: any) { errH(e, res); }
  }));
  app.put("/api/expenses/:id", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    try {
      const parsed = insertExpenseSchema.partial().parse(req.body);
      if (parsed.isRecurring && parsed.recurrenceFrequency && (parsed.date || parsed.nextOccurrenceDate == null)) {
        const anchor = parsed.date ? new Date(parsed.date) : new Date();
        parsed.nextOccurrenceDate = computeNextOccurrence(anchor, parsed.recurrenceFrequency, parsed.recurrenceInterval ?? 1);
      } else if (parsed.isRecurring === false) {
        parsed.nextOccurrenceDate = null;
      }
      res.json(await storage.updateExpense(+req.params.id, parsed));
    } catch (e: any) { errH(e, res); }
  }));
  app.delete("/api/expenses/:id", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    await storage.deleteExpense(+req.params.id); res.status(204).end();
  }));

  // ─── PAYMENTS ─────────────────────────────────────────────────────────────
  app.get("/api/payments", authenticate, ar(async (req, res) => {
    res.json(await storage.getPayments(appId(req)));
  }));
  app.post("/api/payments", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    try {
      const input = { ...insertPaymentSchema.parse(req.body), applicationId: appId(req) };
      res.status(201).json(await storage.createPayment(input));
    } catch (e: any) { errH(e, res); }
  }));
  app.put("/api/payments/:id", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    try { res.json(await storage.updatePayment(+req.params.id, insertPaymentSchema.partial().parse(req.body))); }
    catch (e: any) { errH(e, res); }
  }));
  app.delete("/api/payments/:id", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    await storage.deletePayment(+req.params.id); res.status(204).end();
  }));

  // ─── JOURNAL ENTRIES ──────────────────────────────────────────────────────
  app.get("/api/journal", authenticate, ar(async (req, res) => {
    res.json(await storage.getJournalEntries(appId(req)));
  }));
  app.post("/api/journal", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    try {
      const input = { ...insertJournalEntrySchema.parse(req.body), applicationId: appId(req) };
      res.status(201).json(await storage.createJournalEntry(input));
    } catch (e: any) { errH(e, res); }
  }));
  app.put("/api/journal/:id", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    try { res.json(await storage.updateJournalEntry(+req.params.id, insertJournalEntrySchema.partial().parse(req.body))); }
    catch (e: any) { errH(e, res); }
  }));
  app.delete("/api/journal/:id", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    await storage.deleteJournalEntry(+req.params.id); res.status(204).end();
  }));

  // ─── REMINDERS (Mobile agenda — aggregates upcoming bills) ────────────────
  app.get("/api/reminders", authenticate, ar(async (req, res) => {
    try {
      const application = appId(req);
      const now = new Date();
      const horizon = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days ahead

      type Reminder = {
        id: string;
        kind: "supplier_invoice" | "service" | "expense" | "invoice" | "recurring_expense" | "recurring_invoice";
        title: string;
        amount?: string;
        currency?: string;
        dueDate: string;
        status?: string;
        meta?: Record<string, unknown>;
      };

      const reminders: Reminder[] = [];

      // 1) Supplier invoices coming due (unpaid)
      const supplierInvs = await storage.getSupplierInvoices(application);
      for (const inv of supplierInvs) {
        const due = new Date(inv.dueDate);
        if (inv.status === "paid" || inv.status === "cancelled") continue;
        if (due >= now && due <= horizon) {
          reminders.push({
            id: `supplier_invoice:${inv.id}`,
            kind: "supplier_invoice",
            title: `Facture fournisseur ${inv.number} — ${inv.supplierName}`,
            amount: inv.total as string,
            currency: inv.currency,
            dueDate: due.toISOString(),
            status: inv.status,
          });
        }
      }

      // 2) Client invoices coming due (unpaid)
      const clientInvs = await storage.getInvoices(application);
      for (const inv of clientInvs) {
        const due = new Date(inv.dueDate);
        if (inv.status === "paid" || inv.status === "cancelled") continue;
        if (due >= now && due <= horizon) {
          reminders.push({
            id: `invoice:${inv.id}`,
            kind: "invoice",
            title: `Facture client ${inv.number} — ${inv.clientName}`,
            amount: inv.total as string,
            currency: inv.currency,
            dueDate: due.toISOString(),
            status: inv.status,
          });
        }
      }

      // 3) SaaS subscriptions next billing date
      try {
        const allServices = await storage.getServices(application);
        for (const s of allServices) {
          if (s.status !== "active" || !s.nextBillingDate) continue;
          const next = new Date(s.nextBillingDate);
          if (next >= now && next <= horizon) {
            reminders.push({
              id: `service:${s.id}`,
              kind: "service",
              title: `Abonnement ${s.name}`,
              amount: s.cost as string,
              currency: s.currency,
              dueDate: next.toISOString(),
            });
          }
        }
      } catch {
        // services storage may be optional in some builds — don't fail the whole route
      }

      // 4) Unpaid expenses with a due date
      const allExpenses = await storage.getExpenses(application);
      for (const e of allExpenses) {
        if (!e.dueDate || e.status === "paid" || e.status === "reimbursed" || e.status === "rejected") continue;
        const due = new Date(e.dueDate);
        if (due >= now && due <= horizon) {
          reminders.push({
            id: `expense:${e.id}`,
            kind: "expense",
            title: `Dépense ${e.description}`,
            amount: e.total as string,
            currency: "EUR",
            dueDate: due.toISOString(),
            status: e.status,
          });
        }
        // 5) Upcoming recurring expense generation
        if (e.isRecurring && e.nextOccurrenceDate) {
          const next = new Date(e.nextOccurrenceDate);
          const endOk = !e.recurrenceEndDate || new Date(e.recurrenceEndDate) >= next;
          if (endOk && next >= now && next <= horizon) {
            reminders.push({
              id: `recurring_expense:${e.id}`,
              kind: "recurring_expense",
              title: `🔁 ${e.description} (récurrent)`,
              amount: e.total as string,
              currency: "EUR",
              dueDate: next.toISOString(),
              meta: { frequency: e.recurrenceFrequency, interval: e.recurrenceInterval },
            });
          }
        }
      }

      // 6bis) Upcoming appointments (income or expense, pending or overdue)
      const appts = await storage.getAppointments(application);
      for (const ap of appts) {
        const start = new Date(ap.startDate);
        if (ap.status === "paid" || ap.status === "cancelled") continue;
        if (start <= horizon && start >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)) {
          reminders.push({
            id: `appointment:${ap.id}`,
            kind: "expense",
            title: `📅 ${ap.title}${ap.amount ? ` — ${ap.amount} €` : ""}`,
            amount: (ap.amount as string) || undefined,
            currency: "EUR",
            dueDate: start.toISOString(),
            status: ap.status,
            meta: { source: ap.source, direction: ap.direction },
          });
        }
      }

      // 6) Upcoming recurring invoice generation
      for (const inv of clientInvs) {
        if (inv.isRecurring && inv.nextOccurrenceDate) {
          const next = new Date(inv.nextOccurrenceDate);
          const endOk = !inv.recurrenceEndDate || new Date(inv.recurrenceEndDate) >= next;
          if (endOk && next >= now && next <= horizon) {
            reminders.push({
              id: `recurring_invoice:${inv.id}`,
              kind: "recurring_invoice",
              title: `🔁 Facture ${inv.number} (récurrente)`,
              amount: inv.total as string,
              currency: inv.currency,
              dueDate: next.toISOString(),
              meta: { frequency: inv.recurrenceFrequency, interval: inv.recurrenceInterval },
            });
          }
        }
      }

      reminders.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      res.json({ reminders });
    } catch (e: unknown) {
      console.error("[Reminders] error:", e);
      const message = e instanceof Error ? e.message : "Erreur";
      res.status(500).json({ message });
    }
  }));

  // ─── SETTINGS ─────────────────────────────────────────────────────────────
  app.get("/api/settings/reminders", authenticate, ar(async (req, res) => {
    const s = await storage.getReminderSettings(appId(req));
    res.json(s ?? null);
  }));
  app.put("/api/settings/reminders", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), ar(async (req, res) => {
    try {
      const s = await storage.upsertReminderSettings(appId(req), insertReminderSettingsSchema.partial().parse(req.body));
      res.json(s);
    } catch (e: any) { errH(e, res); }
  }));

  // ─── EMAIL ────────────────────────────────────────────────────────────────
  app.post("/api/email/test", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), async (req, res) => {
    if (!process.env.RESEND_API_KEY) {
      return res.status(503).json({ message: "RESEND_API_KEY non configurée" });
    }
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      await sendWelcomeEmail({ to: email, name: req.user!.name, appName: "MyTools Budget Tracker" });
      res.json({ message: `Email de test envoyé à ${email}` });
    } catch (err: any) {
      res.status(500).json({ message: "Erreur envoi email", detail: err?.message });
    }
  });

  app.post("/api/email/invoice/:id", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), async (req, res) => {
    if (!process.env.RESEND_API_KEY) {
      return res.status(503).json({ message: "RESEND_API_KEY non configurée" });
    }
    try {
      const invoice = await storage.getInvoice(+req.params.id);
      if (!invoice || invoice.applicationId !== appId(req)) {
        return res.status(404).json({ message: "Facture non trouvée" });
      }
      if (!invoice.clientEmail) {
        return res.status(400).json({ message: "Email client manquant" });
      }
      await sendInvoiceNotification({
        to: invoice.clientEmail,
        clientName: invoice.clientName,
        invoiceNumber: invoice.number,
        total: invoice.total as string,
        dueDate: new Date(invoice.dueDate).toLocaleDateString("fr-FR"),
        status: invoice.status as any,
      });
      res.json({ message: `Facture ${invoice.number} envoyée à ${invoice.clientEmail}` });
    } catch (err: any) {
      res.status(500).json({ message: "Erreur envoi email", detail: err?.message });
    }
  });

  app.post("/api/email/report", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), async (req, res) => {
    if (!process.env.RESEND_API_KEY) {
      return res.status(503).json({ message: "RESEND_API_KEY non configurée" });
    }
    try {
      const now = new Date();
      const month = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      const invoices = await storage.getInvoices(appId(req));
      const expenses = await storage.getExpenses(appId(req));
      const revenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.total as any), 0);
      const expPaid = expenses.filter(e => e.status === "paid").reduce((s, e) => s + parseFloat(e.total as any), 0);
      const expUnpaid = expenses.filter(e => e.status === "unpaid").reduce((s, e) => s + parseFloat(e.total as any), 0);
      const expOverdue = expenses.filter(e => e.status === "overdue").reduce((s, e) => s + parseFloat(e.total as any), 0);
      const expTotal = expenses.reduce((s, e) => s + parseFloat(e.total as any), 0);
      await sendMonthlyReport({
        to: req.user!.email,
        userName: req.user!.name,
        month,
        revenue,
        expenses: expTotal,
        expensesPaid: expPaid,
        expensesUnpaid: expUnpaid,
        expensesOverdue: expOverdue,
        balance: revenue - expTotal,
        invoiceCount: invoices.length,
        expenseCount: expenses.length,
      });
      res.json({ message: `Rapport mensuel envoyé à ${req.user!.email}` });
    } catch (err: any) {
      res.status(500).json({ message: "Erreur envoi rapport", detail: err?.message });
    }
  });

  // ─── EXPORT ───────────────────────────────────────────────────────────────
  app.get("/api/export/pdf", authenticate, async (req, res) => {
    try {
      const aid = appId(req);
      const [expenses, invoices, services] = await Promise.all([
        storage.getExpenses(aid),
        storage.getInvoices(aid),
        storage.getServices(aid),
      ]);
      const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.total as any), 0);
      const totalExp = expenses.reduce((s, e) => s + parseFloat(e.total as any), 0);
      const expPaid = expenses.filter(e => e.status === "paid").reduce((s, e) => s + parseFloat(e.total as any), 0);
      const expUnpaid = expenses.filter(e => e.status === "unpaid").reduce((s, e) => s + parseFloat(e.total as any), 0);
      const expOverdue = expenses.filter(e => e.status === "overdue").reduce((s, e) => s + parseFloat(e.total as any), 0);
      const monthlyServices = services.filter(s => s.status === "active").reduce((sum, s) => sum + parseFloat(s.cost as any), 0);

      const pdfBuffer = await generateDashboardPDF({
        totalRevenue, totalExpenses: totalExp, expPaid, expUnpaid, expOverdue,
        monthlyServices, expenses: expenses as any,
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=rapport-${new Date().toISOString().slice(0, 10)}.pdf`);
      res.send(pdfBuffer);
    } catch (err: any) { res.status(500).json({ message: "Erreur génération PDF", detail: err?.message }); }
  });

  app.get("/api/expenses/export/pdf", authenticate, async (req, res) => {
    try {
      const expenses = await storage.getExpenses(appId(req));
      const pdfBuffer = await generateExpensesPDF(expenses as any);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=depenses-${new Date().toISOString().slice(0, 10)}.pdf`);
      res.send(pdfBuffer);
    } catch (err: any) { res.status(500).json({ message: "Erreur génération PDF", detail: err?.message }); }
  });

  app.get("/api/export/excel", authenticate, async (req, res) => {
    try {
      const aid = appId(req);
      const [expenses, invoices, services] = await Promise.all([
        storage.getExpenses(aid),
        storage.getInvoices(aid),
        storage.getServices(aid),
      ]);

      const wb = XLSX.utils.book_new();

      // Sheet 1: Résumé
      const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.total as any), 0);
      const totalExp = expenses.reduce((s, e) => s + parseFloat(e.total as any), 0);
      const expPaid = expenses.filter(e => e.status === "paid").reduce((s, e) => s + parseFloat(e.total as any), 0);
      const expUnpaid = expenses.filter(e => e.status === "unpaid").reduce((s, e) => s + parseFloat(e.total as any), 0);
      const expOverdue = expenses.filter(e => e.status === "overdue").reduce((s, e) => s + parseFloat(e.total as any), 0);
      const monthlyServices = services.filter(s => s.status === "active").reduce((sum, s) => sum + parseFloat(s.cost as any), 0);

      const summaryData = [
        ["Indicateur", "Valeur (€)"],
        ["Revenus encaissés", totalRevenue],
        ["Dépenses totales", totalExp],
        ["Dépenses payées", expPaid],
        ["Dépenses à payer", expUnpaid],
        ["Dépenses en retard", expOverdue],
        ["Solde net", totalRevenue - totalExp],
        ["Abonnements mensuels", monthlyServices],
        ["Projection annuelle", monthlyServices * 12],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
      ws1["!cols"] = [{ wch: 30 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, ws1, "Résumé");

      // Sheet 2: Dépenses
      const expenseData = [
        ["ID", "Description", "Catégorie", "Fournisseur", "Méthode de paiement", "Montant HT (€)", "TVA (€)", "Total TTC (€)", "Statut", "Date", "Date d'échéance", "Notes"],
        ...expenses.map(e => [
          e.id,
          e.description,
          e.category,
          e.supplierName || "",
          e.paymentMethod || "",
          parseFloat(e.amount as any),
          parseFloat(e.taxAmount as any),
          parseFloat(e.total as any),
          e.status === "paid" ? "Payé" : e.status === "overdue" ? "En retard" : e.status === "unpaid" ? "À payer" : e.status,
          e.date ? new Date(e.date).toLocaleDateString("fr-FR") : "",
          e.dueDate ? new Date(e.dueDate).toLocaleDateString("fr-FR") : "",
          e.notes || "",
        ]),
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(expenseData);
      ws2["!cols"] = [{ wch: 6 }, { wch: 35 }, { wch: 16 }, { wch: 25 }, { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, ws2, "Dépenses");

      // Sheet 3: Abonnements
      const serviceData = [
        ["ID", "Service", "Fournisseur", "Catégorie", "Facturation", "Coût fixe (€)", "Statut", "Prochaine facturation", "Coût variable"],
        ...services.map(s => [
          s.id,
          s.name,
          s.provider,
          s.category,
          s.billingType === "monthly" ? "Mensuel" : s.billingType === "yearly" ? "Annuel" : s.billingType,
          parseFloat(s.cost as any),
          s.status === "active" ? "Actif" : s.status === "paused" ? "Suspendu" : "Résilié",
          s.nextBillingDate ? new Date(s.nextBillingDate).toLocaleDateString("fr-FR") : "",
          s.notes ? (s.notes.match(/Variable\s*:\s*([^|]+)/i)?.[1]?.trim() ?? "") : "",
        ]),
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(serviceData);
      ws3["!cols"] = [{ wch: 6 }, { wch: 25 }, { wch: 25 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, ws3, "Abonnements");

      // Sheet 4: Factures
      const invoiceData = [
        ["ID", "Numéro", "Client", "Total TTC (€)", "Statut", "Date émission", "Date échéance"],
        ...invoices.map(i => [
          i.id,
          i.number,
          i.clientName,
          parseFloat(i.total as any),
          i.status === "paid" ? "Payée" : i.status === "overdue" ? "En retard" : i.status === "sent" ? "Envoyée" : "Brouillon",
          i.issuedDate ? new Date(i.issuedDate).toLocaleDateString("fr-FR") : "",
          i.dueDate ? new Date(i.dueDate).toLocaleDateString("fr-FR") : "",
        ]),
      ];
      const ws4 = XLSX.utils.aoa_to_sheet(invoiceData);
      ws4["!cols"] = [{ wch: 6 }, { wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws4, "Factures");

      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=export-${new Date().toISOString().slice(0, 10)}.xlsx`);
      res.send(buffer);
    } catch (err: any) { res.status(500).json({ message: "Erreur export Excel", detail: err?.message }); }
  });

  // ─── EXPENSE CATEGORIES ──────────────────────────────────────────────────
  app.get("/api/expense-categories", authenticate, ar(async (req, res) => {
    res.json(await storage.getExpenseCategories(appId(req)));
  }));
  app.post("/api/expense-categories", authenticate, ar(async (req, res) => {
    try {
      const input = { ...insertExpenseCategorySchema.parse(req.body), applicationId: appId(req) };
      res.status(201).json(await storage.createExpenseCategory(input));
    } catch (e: any) { errH(e, res); }
  }));
  app.delete("/api/expense-categories/:id", authenticate, ar(async (req, res) => {
    await storage.deleteExpenseCategory(+req.params.id); res.status(204).end();
  }));

  // ─── OCR DOCUMENT SCANNING (GEMINI) ────────────────────────────────────
  // Helper : persiste le fichier OCR dans le stockage objet par défaut
  // pour qu'on puisse le rattacher à la dépense créée. Tolérant aux erreurs.
  const saveOcrSourceToObjectStorage = async (file: Express.Multer.File, req?: any) => {
    try {
      const { ObjectStorageService } = await import("./replit_integrations/object_storage/objectStorage");
      const svc = new ObjectStorageService();
      const aid = req && !isSuperOrRoot(req.user?.role) ? appId(req) : (req ? appId(req) : null);
      const objectPath = await svc.uploadBuffer(file.buffer, file.mimetype || "application/octet-stream", aid);
      return { objectPath, attachmentName: file.originalname };
    } catch (err) {
      console.warn("[OCR] Sauvegarde stockage objet échouée:", err instanceof Error ? err.message : err);
      return null;
    }
  };

  app.post("/api/ocr/scan", authenticate, upload.single("file"), ar(async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Aucun fichier fourni" });
      const docType = (req.body?.type as string) || "invoice";
      const [result, stored] = await Promise.all([
        analyzeDocument(req.file.buffer, req.file.originalname, docType),
        saveOcrSourceToObjectStorage(req.file, req),
      ]);
      res.json({ ...result, ...(stored ?? {}) });
    } catch (e: unknown) {
      console.error("OCR error:", e);
      const status = e instanceof Error && "status" in e ? (e as { status: number }).status : 500;
      const message = e instanceof Error ? e.message : "Erreur OCR";
      res.status(status).json({ message });
    }
  }));

  // ─── OCR DOCUMENT SCANNING (AUTO: MINDEE + GEMINI) ───────────────────────
  app.post("/api/ocr/auto", authenticate, upload.single("file"), ar(async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Aucun fichier fourni" });
      const { scanInvoiceWithMindee } = await import("./services/mindee");
      const storedPromise = saveOcrSourceToObjectStorage(req.file, req);

      // Try Mindee first (mock or real)
      try {
        const result = await scanInvoiceWithMindee(req.file.buffer, req.file.originalname);
        console.log(`[OCR Auto] ✓ Mindee succeeded, confidence=${result.confidence}`);
        const stored = await storedPromise;
        return res.json({ ...result, ...(stored ?? {}) });
      } catch (mindeeErr) {
        console.log(`[OCR Auto] Mindee failed, fallback to Gemini: ${mindeeErr instanceof Error ? mindeeErr.message : "unknown error"}`);
      }

      // Fallback to Gemini if Mindee fails
      const docType = (req.body?.type as string) || "invoice";
      const result = await analyzeDocument(req.file.buffer, req.file.originalname, docType);
      console.log(`[OCR Auto] ✓ Gemini succeeded, confidence=${result.confidence}`);
      const stored = await storedPromise;
      res.json({ ...result, ...(stored ?? {}) });
    } catch (e: unknown) {
      console.error("OCR Auto error:", e);
      const status = e instanceof Error && "status" in e ? (e as { status: number }).status : 500;
      const message = e instanceof Error ? e.message : "Erreur OCR";
      res.status(status).json({ message });
    }
  }));

  // ─── OCR BATCH (Mobile multi-file scan) ────────────────────────────────
  app.post("/api/ocr/batch", authenticate, upload.array("files", 10), ar(async (req, res) => {
    try {
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (files.length === 0) return res.status(400).json({ message: "Aucun fichier fourni" });
      const docType = (req.body?.type as string) || "invoice";

      const results = await Promise.all(
        files.map(async (file) => {
          try {
            const [r, stored] = await Promise.all([
              analyzeDocument(file.buffer, file.originalname, docType),
              saveOcrSourceToObjectStorage(file, req),
            ]);
            const dateStr = r.date || (r.dueDate ?? undefined);
            return {
              filename: file.originalname,
              category: r.suggestedCategory || r.type,
              vendor: r.supplierName,
              date: dateStr,
              amount: r.totalAmount ?? r.totalNet,
              type: r.type,
              documentNature: r.documentNature,
              confidence: r.confidence,
              invoiceNumber: r.invoiceNumber,
              totalNet: r.totalNet,
              taxAmount: r.taxAmount,
              taxRate: r.taxRate,
              currency: r.currency,
              paymentMethod: r.paymentMethod,
              supplierSiret: r.supplierSiret,
              supplierVatNumber: r.supplierVatNumber,
              lineItems: r.lineItems,
              warnings: r.warnings,
              objectPath: stored?.objectPath,
              attachmentName: stored?.attachmentName,
            };
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Erreur OCR";
            return { filename: file.originalname, error: message };
          }
        }),
      );
      res.json({ results });
    } catch (e: unknown) {
      console.error("OCR Batch error:", e);
      const status = e instanceof Error && "status" in e ? (e as { status: number }).status : 500;
      const message = e instanceof Error ? e.message : "Erreur OCR batch";
      res.status(status).json({ message });
    }
  }));

  // ─── OCR DOCUMENT SCANNING (MINDEE) [LEGACY] ────────────────────────────
  app.post("/api/ocr/mindee", authenticate, upload.single("file"), ar(async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Aucun fichier fourni" });
      const { scanInvoiceWithMindee } = await import("./services/mindee");
      const [result, stored] = await Promise.all([
        scanInvoiceWithMindee(req.file.buffer, req.file.originalname),
        saveOcrSourceToObjectStorage(req.file, req),
      ]);
      res.json({ ...result, ...(stored ?? {}) });
    } catch (e: unknown) {
      console.error("Mindee OCR error:", e);
      const message = e instanceof Error ? e.message : "Erreur Mindee";
      res.status(500).json({ message });
    }
  }));

  // ─── OCR: CREATE DOCUMENT FROM SCAN ──────────────────────────────────────
  app.post("/api/ocr/create-document", authenticate, ar(async (req, res) => {
    try {
      const { type, ocr } = req.body as { type: string; ocr: Record<string, any> };
      if (!type || !ocr) return res.status(400).json({ message: "type et ocr requis" });

      const aId = await appIdOrFallback(req);
      const uid = req.user!.id;

      // Parse amounts (euros, floats)
      const ht  = parseFloat(ocr.totalNet)    || 0;
      const tva = parseFloat(ocr.taxAmount)   || 0;
      const ttc = parseFloat(ocr.totalAmount) || (ht + tva) || 0;
      const dateISO    = ocr.date    ? new Date(ocr.date).toISOString()    : new Date().toISOString();
      const dueDateISO = ocr.dueDate ? new Date(ocr.dueDate).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString();
      const ref = [
        ocr.invoiceNumber ? `Réf: ${ocr.invoiceNumber}` : "",
        ocr.supplierVatNumber ? `TVA: ${ocr.supplierVatNumber}` : "",
      ].filter(Boolean).join(" | ");

      let document: any;
      let journal: string;
      let journalLines: { accountCode: string; accountLabel: string; debit: string; credit: string }[] = [];

      if (type === "expense") {
        document = await storage.createExpense({
          description: ocr.supplierName
            ? `${ocr.supplierName}${ocr.invoiceNumber ? ` – ${ocr.invoiceNumber}` : ""}`
            : "Dépense OCR",
          amount: ht.toFixed(2),
          taxAmount: tva.toFixed(2),
          total: ttc.toFixed(2),
          category: ocr.suggestedCategory ?? "Autre",
          date: new Date(dateISO),
          dueDate: ocr.dueDate ? new Date(dueDateISO) : null,
          status: "unpaid",
          paymentMethod: ocr.paymentMethod ?? null,
          supplierName: ocr.supplierName ?? null,
          supplierId: null,
          userId: uid,
          applicationId: aId,
          notes: ref || null,
        });
        journal = "purchases";
        journalLines = [
          { accountCode: "607000", accountLabel: "Achats",            debit: ht.toFixed(2),  credit: "0.00" },
          { accountCode: "445660", accountLabel: "TVA déductible",    debit: tva.toFixed(2), credit: "0.00" },
          { accountCode: "401000", accountLabel: "Fournisseurs",      debit: "0.00",         credit: ttc.toFixed(2) },
        ];

      } else if (type === "supplier_invoice") {
        document = await storage.createSupplierInvoice({
          number: ocr.invoiceNumber ?? `FF-${Date.now().toString().slice(-6)}`,
          supplierId: null,
          supplierName: ocr.supplierName ?? "Fournisseur OCR",
          supplierEmail: ocr.supplierEmail ?? null,
          supplierPhone: ocr.supplierPhone ?? null,
          supplierAddress: ocr.supplierAddress ?? null,
          status: "pending",
          subtotal: ht.toFixed(2),
          taxRate: ocr.taxRate != null ? Number(ocr.taxRate).toFixed(2) : "20.00",
          taxAmount: tva.toFixed(2),
          total: ttc.toFixed(2),
          currency: "EUR",
          issuedDate: new Date(dateISO),
          dueDate: new Date(dueDateISO),
          notes: ref || null,
          linkedServices: null,
          applicationId: aId,
        });
        journal = "purchases";
        journalLines = [
          { accountCode: "607000", accountLabel: "Achats",            debit: ht.toFixed(2),  credit: "0.00" },
          { accountCode: "445660", accountLabel: "TVA déductible",    debit: tva.toFixed(2), credit: "0.00" },
          { accountCode: "401000", accountLabel: "Fournisseurs",      debit: "0.00",         credit: ttc.toFixed(2) },
        ];

      } else if (type === "invoice") {
        document = await storage.createInvoice({
          number: ocr.invoiceNumber ?? `F-${Date.now().toString().slice(-6)}`,
          clientName: ocr.customerName ?? ocr.supplierName ?? "Client OCR",
          clientEmail: ocr.customerEmail ?? null,
          clientAddress: ocr.customerAddress ?? null,
          status: "draft",
          subtotal: ht.toFixed(2),
          taxRate: ocr.taxRate != null ? Number(ocr.taxRate).toFixed(2) : "20.00",
          taxAmount: tva.toFixed(2),
          total: ttc.toFixed(2),
          currency: "EUR",
          issuedDate: new Date(dateISO),
          dueDate: new Date(dueDateISO),
          notes: ref || null,
          applicationId: aId,
        });
        journal = "sales";
        journalLines = [
          { accountCode: "411000", accountLabel: "Clients",           debit: ttc.toFixed(2), credit: "0.00" },
          { accountCode: "706000", accountLabel: "Prestations serv.", debit: "0.00",         credit: ht.toFixed(2) },
          { accountCode: "445710", accountLabel: "TVA collectée",     debit: "0.00",         credit: tva.toFixed(2) },
        ];

      } else if (type === "credit_note") {
        document = await storage.createCreditNote({
          number: ocr.invoiceNumber ?? `AV-${Date.now().toString().slice(-6)}`,
          clientName: ocr.customerName ?? ocr.supplierName ?? "Client OCR",
          reason: ref || "Avoir OCR",
          amount: ht.toFixed(2),
          taxAmount: tva.toFixed(2),
          total: ttc.toFixed(2),
          currency: "EUR",
          date: new Date(dateISO),
          status: "issued",
          invoiceId: null,
          applicationId: aId,
        });
        journal = "purchases";
        journalLines = [
          { accountCode: "401000", accountLabel: "Fournisseurs",      debit: ttc.toFixed(2), credit: "0.00" },
          { accountCode: "607000", accountLabel: "Achats",            debit: "0.00",         credit: ht.toFixed(2) },
          { accountCode: "445660", accountLabel: "TVA déductible",    debit: "0.00",         credit: tva.toFixed(2) },
        ];
      } else {
        return res.status(400).json({ message: `Type invalide: ${type}` });
      }

      // Create accounting entry if amounts are meaningful
      if (ttc > 0 && journalLines.length > 0) {
        try {
          await storage.createAccountingEntry(
            {
              entryNumber: `OCR-${Date.now()}`,
              label: `[OCR] ${ocr.supplierName ?? ocr.customerName ?? "Document"} – ${ttc.toFixed(2)} €`,
              journal,
              date: new Date(dateISO),
              validated: false,
              applicationId: aId,
            } as any,
            journalLines as any,
          );
        } catch (e) {
          console.warn("[OCR create-document] Accounting entry skipped:", e);
        }
      }

      res.status(201).json({ type, document });
    } catch (e: any) {
      console.error("[OCR create-document]", e);
      res.status(500).json({ message: e?.message ?? "Erreur création document" });
    }
  }));

  // ─── EXPENSE FROM INVOICE ──────────────────────────────────────────────
  app.post("/api/expenses/from-invoice/:id", authenticate, ar(async (req, res) => {
    try {
      const inv = await storage.getSupplierInvoice(+req.params.id);
      if (!inv) return res.status(404).json({ message: "Facture fournisseur non trouvée" });
      const expense = await storage.createExpense({
        description: `Facture ${inv.number} - ${inv.supplierName}`,
        amount: inv.subtotal as string,
        taxAmount: inv.taxAmount as string,
        total: inv.total as string,
        category: "Fournisseurs",
        date: new Date(inv.issuedDate),
        dueDate: inv.dueDate ? new Date(inv.dueDate) : null,
        status: inv.status === "paid" ? "paid" : "unpaid",
        paymentMethod: null,
        supplierId: inv.supplierId,
        supplierName: inv.supplierName,
        userId: req.user!.id,
        applicationId: appId(req),
        notes: `Créée depuis la facture fournisseur #${inv.number}`,
      });
      res.status(201).json(expense);
    } catch (e: any) { errH(e, res); }
  }));

  app.post("/api/expenses/from-client-invoice/:id", authenticate, ar(async (req, res) => {
    try {
      const inv = await storage.getInvoice(+req.params.id);
      if (!inv) return res.status(404).json({ message: "Facture non trouvée" });
      const items = await storage.getInvoiceItems(inv.id);
      const expense = await storage.createExpense({
        description: `Facture client ${inv.number} - ${inv.clientName}`,
        amount: inv.subtotal as string,
        taxAmount: inv.taxAmount as string,
        total: inv.total as string,
        category: "Clients",
        date: new Date(inv.issuedDate),
        dueDate: inv.dueDate ? new Date(inv.dueDate) : null,
        status: inv.status === "paid" ? "paid" : "unpaid",
        paymentMethod: null,
        supplierName: inv.clientName,
        userId: req.user!.id,
        applicationId: appId(req),
        notes: `Créée depuis la facture client #${inv.number}${items.length > 0 ? ` (${items.length} article(s))` : ""}`,
      });
      res.status(201).json(expense);
    } catch (e: any) { errH(e, res); }
  }));

  // ─── APPOINTMENTS (Agenda externe avec tarification) ──────────────────────
  app.get("/api/appointments", authenticate, ar(async (req, res) => {
    const aid = appId(req);
    const list = await storage.getAppointments(aid);
    const now = new Date();
    // Auto mark overdue: pending past startDate
    const enriched = list.map(a => {
      if (a.status === "pending" && a.startDate && new Date(a.startDate) < now) {
        return { ...a, status: "overdue" };
      }
      return a;
    });
    res.json(enriched);
  }));

  app.post("/api/appointments", authenticate, ar(async (req, res) => {
    const aid = appId(req);
    const input = insertAppointmentSchema.parse({ ...req.body, applicationId: aid });
    const created = await storage.createAppointment(input);
    res.status(201).json(created);
  }));

  app.patch("/api/appointments/:id", authenticate, ar(async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getAppointment(id);
    if (!existing) return res.status(404).json({ message: "Rendez-vous introuvable" });
    if (existing.applicationId !== appId(req) && !isSuperOrRoot(req.user!.role))
      return res.status(403).json({ message: "Accès refusé" });
    const updates = insertAppointmentSchema.partial().parse(req.body);
    // SECURITY: prevent tenant-boundary bypass — applicationId is immutable post-creation
    delete (updates as any).applicationId;
    // Auto-set paidAt when transitioning to paid
    if (updates.status === "paid" && existing.status !== "paid" && !updates.paidAt) {
      (updates as any).paidAt = new Date();
    }
    const updated = await storage.updateAppointment(id, updates);
    res.json(updated);
  }));

  app.delete("/api/appointments/:id", authenticate, ar(async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getAppointment(id);
    if (!existing) return res.status(404).json({ message: "Rendez-vous introuvable" });
    if (existing.applicationId !== appId(req) && !isSuperOrRoot(req.user!.role))
      return res.status(403).json({ message: "Accès refusé" });
    await storage.deleteAppointment(id);
    res.json({ message: "Supprimé" });
  }));

  // iCal import — accepts either a URL { url } or raw iCal text { ics }
  app.post("/api/appointments/import", authenticate, ar(async (req, res) => {
    const aid = appId(req);
    const { url, ics, defaultDirection, defaultAmount } = z.object({
      url: z.string().url().optional(),
      ics: z.string().optional(),
      defaultDirection: z.enum(["income", "expense"]).optional(),
      defaultAmount: z.union([z.string(), z.number()]).optional(),
    }).parse(req.body);

    let raw = ics;
    if (!raw && url) {
      // ── SSRF protection ──────────────────────────────────────────────
      let parsed: URL;
      try { parsed = new URL(url); } catch { return res.status(400).json({ message: "URL invalide" }); }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return res.status(400).json({ message: "Seules les URL http(s) sont autorisées" });
      }
      // Resolve hostname & block private/loopback/link-local addresses
      try {
        const dns = await import("node:dns/promises");
        const addrs = await dns.lookup(parsed.hostname, { all: true });
        const isPrivate = (ip: string) => {
          if (ip === "::1" || ip === "127.0.0.1" || ip.startsWith("127.")) return true;
          if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
          if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
          if (ip.startsWith("169.254.")) return true; // link-local / metadata
          if (ip.toLowerCase().startsWith("fc") || ip.toLowerCase().startsWith("fd")) return true; // unique-local IPv6
          if (ip.toLowerCase().startsWith("fe80:")) return true; // link-local IPv6
          return false;
        };
        if (addrs.some(a => isPrivate(a.address))) {
          return res.status(400).json({ message: "URL interne/privée non autorisée" });
        }
      } catch (e: any) {
        return res.status(400).json({ message: `Résolution DNS impossible: ${e.message}` });
      }
      const ctrl = new AbortController();
      const tmo = setTimeout(() => ctrl.abort(), 10000);
      try {
        const r = await fetch(parsed.toString(), {
          headers: { "User-Agent": "Budget-by-MyTools/1.0", "Accept": "text/calendar, text/plain" },
          signal: ctrl.signal,
          redirect: "error", // disallow redirects (could bypass SSRF check)
        });
        clearTimeout(tmo);
        if (!r.ok) return res.status(400).json({ message: `Échec téléchargement iCal (HTTP ${r.status})` });
        // Cap response size at 5 MB
        const buf = await r.arrayBuffer();
        if (buf.byteLength > 5 * 1024 * 1024) return res.status(400).json({ message: "Calendrier iCal trop volumineux (>5 Mo)" });
        raw = new TextDecoder("utf-8").decode(buf);
      } catch (e: any) {
        clearTimeout(tmo);
        return res.status(400).json({ message: `URL iCal inaccessible: ${e.message}` });
      }
    }
    if (!raw) return res.status(400).json({ message: "Fournir 'url' ou 'ics' (contenu iCal)." });

    const events = parseICal(raw);
    if (events.length === 0) return res.status(400).json({ message: "Aucun événement VEVENT trouvé." });

    let created = 0, updated = 0;
    for (const ev of events) {
      const existing = ev.uid ? await storage.getAppointmentByExternalUid(aid, ev.uid) : undefined;
      const payload: any = {
        applicationId: aid,
        title: ev.summary || "Rendez-vous",
        description: ev.description || null,
        location: ev.location || null,
        startDate: ev.start,
        endDate: ev.end || null,
        source: "ical",
        externalUid: ev.uid || null,
        direction: defaultDirection || "income",
        status: "pending",
      };
      if (defaultAmount != null) payload.amount = String(defaultAmount);
      if (existing) {
        await storage.updateAppointment(existing.id, {
          title: payload.title,
          description: payload.description,
          location: payload.location,
          startDate: payload.startDate,
          endDate: payload.endDate,
        });
        updated++;
      } else {
        await storage.createAppointment(payload);
        created++;
      }
    }
    res.json({ created, updated, total: events.length });
  }));

  // ─── AGENDA / CALENDAR ─────────────────────────────────────────────────
  app.get("/api/agenda", authenticate, ar(async (req, res) => {
    const aid = appId(req);
    const [invoicesList, supplierInvList, expList, svcList, payList, apptList] = await Promise.all([
      storage.getInvoices(aid),
      storage.getSupplierInvoices(aid),
      storage.getExpenses(aid),
      storage.getServices(aid),
      storage.getPayments(aid),
      storage.getAppointments(aid),
    ]);

    const events: any[] = [];

    invoicesList.forEach(inv => {
      if (inv.dueDate) {
        events.push({
          id: `inv-${inv.id}`,
          title: `Facture ${inv.number} - ${inv.clientName}`,
          date: inv.dueDate,
          type: "invoice",
          amount: parseFloat(inv.total as any),
          status: inv.status,
          entityId: inv.id,
        });
      }
    });

    supplierInvList.forEach(inv => {
      if (inv.dueDate) {
        events.push({
          id: `sinv-${inv.id}`,
          title: `Facture fourn. ${inv.number} - ${inv.supplierName}`,
          date: inv.dueDate,
          type: "supplier_invoice",
          amount: parseFloat(inv.total as any),
          status: inv.status,
          entityId: inv.id,
        });
      }
    });

    expList.forEach(exp => {
      if (exp.dueDate) {
        events.push({
          id: `exp-${exp.id}`,
          title: `Dépense: ${exp.description}`,
          date: exp.dueDate,
          type: "expense",
          amount: parseFloat(exp.total as any),
          status: exp.status,
          entityId: exp.id,
        });
      }
    });

    svcList.filter(s => s.status === "active").forEach(svc => {
      events.push({
        id: `svc-${svc.id}`,
        title: `Abonnement: ${svc.name}`,
        date: svc.nextBillingDate,
        type: "service",
        amount: parseFloat(svc.cost as any),
        status: "active",
        entityId: svc.id,
      });
    });

    payList.forEach(pay => {
      events.push({
        id: `pay-${pay.id}`,
        title: `Paiement: ${pay.reference}`,
        date: pay.date,
        type: "payment",
        amount: parseFloat(pay.amount as any),
        status: pay.status,
        direction: pay.direction,
        entityId: pay.id,
      });
    });

    apptList.forEach(ap => {
      const status = ap.status === "pending" && new Date(ap.startDate) < new Date() ? "overdue" : ap.status;
      events.push({
        id: `appt-${ap.id}`,
        title: ap.title,
        date: ap.startDate,
        type: "appointment",
        amount: ap.amount ? parseFloat(ap.amount as any) : 0,
        status,
        direction: ap.direction === "income" ? "inbound" : "outbound",
        entityId: ap.id,
      });
    });

    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    res.json(events);
  }));

  // ─── ADVANCED ANALYTICS ────────────────────────────────────────────────
  app.get("/api/analytics/advanced", authenticate, ar(async (req, res) => {
    const allApps = await storage.getApplications();
    const isSuper = isSuperOrRoot(req.user!.role);
    const targetApps = isSuper ? allApps : allApps.filter(a => a.id === req.user!.applicationId);

    const perApp: any[] = [];
    let globalRevenue = 0, globalExpenses = 0, globalServices = 0;
    const globalExpByMonth: Record<string, number> = {};
    const globalRevByMonth: Record<string, number> = {};
    const globalExpByCat: Record<string, number> = {};
    const now = new Date();

    for (const app of targetApps) {
      const [invList, expList, svcList, payList] = await Promise.all([
        storage.getInvoices(app.id),
        storage.getExpenses(app.id),
        storage.getServices(app.id),
        storage.getPayments(app.id),
      ]);

      const revenue = invList.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.total as any), 0);
      const totalExp = expList.reduce((s, e) => s + parseFloat(e.total as any), 0);
      const activeServices = svcList.filter(s => s.status === "active").length;
      const monthlySvcCost = svcList.filter(s => s.status === "active").reduce((s, svc) => {
        const c = parseFloat(svc.cost as any);
        return s + (svc.billingType === "yearly" ? c / 12 : c);
      }, 0);

      globalRevenue += revenue;
      globalExpenses += totalExp;
      globalServices += activeServices;

      const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
      const expByMonth: Record<string, number> = {};
      const revByMonth: Record<string, number> = {};

      expList.forEach(e => {
        const d = new Date(e.date!);
        if (d.getFullYear() === now.getFullYear()) {
          const key = months[d.getMonth()];
          expByMonth[key] = (expByMonth[key] || 0) + parseFloat(e.total as any);
          globalExpByMonth[key] = (globalExpByMonth[key] || 0) + parseFloat(e.total as any);
        }
        globalExpByCat[e.category] = (globalExpByCat[e.category] || 0) + parseFloat(e.total as any);
      });

      invList.filter(i => i.status === "paid").forEach(i => {
        const d = new Date(i.issuedDate);
        if (d.getFullYear() === now.getFullYear()) {
          const key = months[d.getMonth()];
          revByMonth[key] = (revByMonth[key] || 0) + parseFloat(i.total as any);
          globalRevByMonth[key] = (globalRevByMonth[key] || 0) + parseFloat(i.total as any);
        }
      });

      perApp.push({
        appId: app.id,
        appName: app.name,
        revenue,
        expenses: totalExp,
        profit: revenue - totalExp,
        activeServices,
        monthlySvcCost,
        invoiceCount: invList.length,
        expenseCount: expList.length,
        paymentCount: payList.length,
        expensesByMonth: months.map(m => ({ month: m, amount: expByMonth[m] || 0 })),
        revenueByMonth: months.map(m => ({ month: m, amount: revByMonth[m] || 0 })),
      });
    }

    const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

    res.json({
      global: {
        totalRevenue: globalRevenue,
        totalExpenses: globalExpenses,
        profit: globalRevenue - globalExpenses,
        activeServices: globalServices,
        appCount: targetApps.length,
        expensesByMonth: months.map(m => ({ month: m, amount: globalExpByMonth[m] || 0 })),
        revenueByMonth: months.map(m => ({ month: m, amount: globalRevByMonth[m] || 0 })),
        revenueVsExpenses: months.map(m => ({ month: m, revenue: globalRevByMonth[m] || 0, expenses: globalExpByMonth[m] || 0 })),
        expensesByCategory: Object.entries(globalExpByCat).map(([category, amount]) => ({ category, amount })),
      },
      perApp,
    });
  }));

  // Import transactions from CSV/JSON/XLS
  app.post("/api/banking/accounts/:id/import-csv", authenticate, ar(async (req, res) => {
    const accountId = parseInt(req.params.id);
    const { transactions } = req.body;
    const results = [];

    const categorize = (desc: string, amount: number) => {
      const d = desc.toLowerCase();
      if (amount > 0) return "Entrée d'argent";
      if (d.includes("loyer") || d.includes("rent")) return "Loyer";
      if (d.includes("edf") || d.includes("electricite") || d.includes("engie")) return "Énergie";
      if (d.includes("salaire") || d.includes("payroll") || d.includes("virement recu")) return "Salaires/Virements";
      if (d.includes("stripe") || d.includes("client") || d.includes("facture")) return "Ventes";
      if (d.includes("restaurant") || d.includes("dejeuner") || d.includes("snack")) return "Repas";
      if (d.includes("carburant") || d.includes("essence") || d.includes("peage")) return "Transport";
      return "Dépense Divers";
    };

    for (const tx of transactions) {
      const amountCents = Math.round(tx.amount * 100);
      const vatRateVal = tx.vatRate != null ? parseFloat(String(tx.vatRate)) : null;
      let vatAmountCents: number | null = null;
      let netAmountCents: number | null = null;
      if (vatRateVal && vatRateVal > 0 && amountCents !== 0) {
        const divisor = 1 + vatRateVal / 100;
        netAmountCents = Math.round(amountCents / divisor);
        vatAmountCents = amountCents - netAmountCents;
      }
      const result = await storage.upsertBankTransaction({
        bankAccountId: accountId,
        stripeTransactionId: `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        amount: amountCents,
        netAmount: netAmountCents,
        vatRate: vatRateVal != null ? String(vatRateVal) : null,
        vatAmount: vatAmountCents,
        currency: "EUR",
        description: tx.description,
        status: "posted",
        transactedAt: new Date(tx.date),
        importSource: "file",
        category: categorize(tx.description, amountCents),
        applicationId: appId(req),
      });
      results.push(result);
    }
    res.json(results);
  }));

  // Helper : récupère la transaction + vérifie que l'utilisateur a accès
  // via bankAccount.applicationId (SUPER/ROOT bypassent).
  const requireOwnedTransaction = async (req: any, txId: number) => {
    const tx = await storage.getBankTransaction(txId);
    if (!tx) return { error: 404 as const };
    if (isSuperOrRoot(req.user!.role)) return { tx };
    const accountId = (tx as any).bankAccountId;
    const account = accountId ? await storage.getBankAccount(accountId) : null;
    if (!account || account.applicationId !== appId(req)) {
      return { error: 403 as const };
    }
    return { tx };
  };

  // Champs autorisés en PATCH (anti tamper) : exclut applicationId, id, etc.
  const PATCH_TX_ALLOWED = new Set([
    "vatRate", "vatAmount", "netAmount", "validated", "validatedAt",
    "attachmentPath", "attachmentName", "category", "description", "notes",
  ]);

  // PATCH transaction (update vatRate, vatAmount, attachmentPath…)
  app.patch("/api/banking/transactions/:id", authenticate, ar(async (req, res) => {
    const txId = parseInt(req.params.id);
    const guard = await requireOwnedTransaction(req, txId);
    if (guard.error === 404) return res.status(404).json({ error: "Transaction introuvable" });
    if (guard.error === 403) return res.status(403).json({ error: "Accès interdit" });
    const safe: any = {};
    for (const k of Object.keys(req.body || {})) {
      if (PATCH_TX_ALLOWED.has(k)) safe[k] = req.body[k];
    }
    const updated = await storage.updateBankTransaction(txId, safe);
    res.json(updated);
  }));

  // Lier pièce jointe (objectPath retourné après upload presigned)
  app.post("/api/banking/transactions/:id/attachment", authenticate, ar(async (req, res) => {
    const txId = parseInt(req.params.id);
    const guard = await requireOwnedTransaction(req, txId);
    if (guard.error === 404) return res.status(404).json({ error: "Transaction introuvable" });
    if (guard.error === 403) return res.status(403).json({ error: "Accès interdit" });
    const { objectPath, attachmentName } = req.body;
    const v = validateUploadedPath(objectPath, req);
    if (!v.ok) return res.status(v.status).json({ error: v.msg });
    const updated = await storage.updateBankTransaction(txId, {
      attachmentPath: objectPath,
      attachmentName: attachmentName || objectPath.split("/").pop(),
    });
    res.json(updated);
  }));

  // ─── PIÈCES JOINTES GÉNÉRIQUES (DEFAULT_OBJECT_STORAGE_ID) ─────────────
  // Toutes les ressources métier acceptent une pièce jointe via 3 étapes :
  //   1) POST /api/uploads/request-url → presigned URL + objectPath
  //   2) PUT (client) directement sur Google Cloud Storage
  //   3) POST /api/<resource>/:id/attachment {objectPath, attachmentName}
  // Vérifie que `objectPath` est valide ET appartient au tenant courant.
  // Les uploads sont namespaced sous /objects/uploads/app-<appId>/<uuid> par
  // /api/uploads/request-url et l'OCR ; un chemin hors préfixe est rejeté.
  // SUPER/ROOT peuvent attacher n'importe quel chemin (admin tooling).
  const validateUploadedPath = (
    objectPath: any,
    req: any,
  ): { ok: true } | { ok: false; status: number; msg: string } => {
    if (!objectPath || typeof objectPath !== "string" || !objectPath.startsWith("/objects/")) {
      return { ok: false, status: 400, msg: "objectPath /objects/... requis" };
    }
    if (isSuperOrRoot(req.user!.role)) return { ok: true };
    const aid = appId(req);
    if (aid == null) return { ok: false, status: 403, msg: "Tenant non identifié" };
    const expectedPrefix = `/objects/uploads/app-${aid}/`;
    if (!objectPath.startsWith(expectedPrefix)) {
      return { ok: false, status: 403, msg: "Pièce jointe d'un autre tenant" };
    }
    return { ok: true };
  };

  const linkAttachment = (
    fetcher: (id: number) => Promise<any>,
    updater: (id: number, patch: any) => Promise<any>,
  ) => ar(async (req: any, res: any) => {
    const id = parseInt(req.params.id);
    const row = await fetcher(id);
    if (!row) return res.status(404).json({ error: "Ressource introuvable" });
    if (!isSuperOrRoot(req.user!.role) && row.applicationId !== appId(req)) {
      return res.status(403).json({ error: "Accès interdit" });
    }
    const { objectPath, attachmentName } = req.body;
    const v = validateUploadedPath(objectPath, req);
    if (!v.ok) return res.status(v.status).json({ error: v.msg });
    const updated = await updater(id, {
      attachmentPath: objectPath,
      attachmentName: attachmentName || objectPath.split("/").pop(),
    });
    res.json(updated);
  });

  app.post("/api/expenses/:id/attachment", authenticate,
    linkAttachment((id) => storage.getExpense(id), (id, p) => storage.updateExpense(id, p)));
  app.post("/api/invoices/:id/attachment", authenticate,
    linkAttachment((id) => storage.getInvoice(id), (id, p) => storage.updateInvoice(id, p)));
  app.post("/api/supplier-invoices/:id/attachment", authenticate,
    linkAttachment((id) => storage.getSupplierInvoice(id), (id, p) => storage.updateSupplierInvoice(id, p)));
  app.post("/api/appointments/:id/attachment", authenticate,
    linkAttachment((id) => storage.getAppointment(id), (id, p) => storage.updateAppointment(id, p)));

  // Validate transaction → écritures comptables avec TVA
  app.post("/api/banking/transactions/:id/validate", authenticate, requireRole(["ADMIN", "SUPER_ADMIN", "ROOT_ADMIN"]), ar(async (req, res) => {
    const txId = parseInt(req.params.id);
    const tx = await storage.getBankTransaction(txId);
    if (!tx) return res.status(404).json({ error: "Transaction introuvable" });
    const aid = appId(req);
    if (tx.applicationId !== aid) return res.status(403).json({ error: "Accès interdit" });
    if (tx.validated) return res.status(400).json({ error: "Transaction déjà validée" });

    const amountTTC = Math.abs(tx.amount);
    const vatAmtCents = tx.vatAmount ? Math.abs(tx.vatAmount) : 0;
    const netAmtCents = tx.netAmount ? Math.abs(tx.netAmount) : (amountTTC - vatAmtCents);
    const isExpense = tx.amount < 0;
    const fmt = (c: number) => (c / 100).toFixed(2);

    const accs = await storage.getAccounts(aid);
    const bankAcc      = accs.find(a => a.code.startsWith("512"));
    const counterAcc   = isExpense ? accs.find(a => a.code.startsWith("401")) : accs.find(a => a.code.startsWith("411"));
    const chargeAcc    = accs.find(a => a.code.startsWith("606")) || accs.find(a => a.code.startsWith("6"));
    const prodAcc      = accs.find(a => a.code.startsWith("706")) || accs.find(a => a.code.startsWith("7"));

    const bankCode    = bankAcc?.code    || "512000"; const bankLabel    = bankAcc?.name    || "Banques";
    const counterCode = counterAcc?.code || (isExpense ? "401000" : "411000");
    const counterLabel= counterAcc?.name || (isExpense ? "Fournisseurs" : "Clients");
    const chargeCode  = chargeAcc?.code  || "606000"; const chargeLabel  = chargeAcc?.name  || "Achats divers";
    const prodCode    = prodAcc?.code    || "706000";  const prodLabel    = prodAcc?.name    || "Prestations";

    const entryNumber = `BAN-${Date.now()}`;
    const desc = `Rapprochement: ${tx.description || "Transaction bancaire"}`;
    const lines: any[] = [];

    if (vatAmtCents > 0) {
      if (isExpense) {
        lines.push(
          { accountCode: counterCode, accountLabel: counterLabel, description: desc, debit: "0.00",             credit: fmt(amountTTC) },
          { accountCode: chargeCode,  accountLabel: chargeLabel,  description: desc, debit: fmt(netAmtCents),   credit: "0.00" },
          { accountCode: "445660",    accountLabel: "TVA déductible", description: desc, debit: fmt(vatAmtCents), credit: "0.00" },
        );
      } else {
        lines.push(
          { accountCode: counterCode, accountLabel: counterLabel, description: desc, debit: fmt(amountTTC),   credit: "0.00" },
          { accountCode: prodCode,    accountLabel: prodLabel,    description: desc, debit: "0.00",           credit: fmt(netAmtCents) },
          { accountCode: "445710",    accountLabel: "TVA collectée", description: desc, debit: "0.00",        credit: fmt(vatAmtCents) },
        );
      }
    } else {
      if (isExpense) {
        lines.push(
          { accountCode: counterCode, accountLabel: counterLabel, description: desc, debit: "0.00",           credit: fmt(amountTTC) },
          { accountCode: bankCode,    accountLabel: bankLabel,    description: desc, debit: fmt(amountTTC),   credit: "0.00" },
        );
      } else {
        lines.push(
          { accountCode: bankCode,    accountLabel: bankLabel,    description: desc, debit: fmt(amountTTC),   credit: "0.00" },
          { accountCode: counterCode, accountLabel: counterLabel, description: desc, debit: "0.00",           credit: fmt(amountTTC) },
        );
      }
    }

    const entry = await storage.createAccountingEntry({
      date: tx.transactedAt || new Date(),
      entryNumber,
      description: desc,
      journal: "bank",
      sourceType: "payment",
      sourceId: String(txId),
      totalDebit: fmt(amountTTC),
      totalCredit: fmt(amountTTC),
      applicationId: aid,
    }, lines.map(l => ({ ...l, entryId: 0 })));

    await storage.updateBankTransaction(txId, { validated: true, accountingEntryId: entry.id });
    res.json({ entry, transaction: await storage.getBankTransaction(txId) });
  }));

  app.post("/api/banking/transactions/:id/to-accounting", authenticate, requireRole(["ADMIN", "SUPER_ADMIN", "ROOT_ADMIN"]), ar(async (req, res) => {
      const txId = parseInt(req.params.id);
      const tx = await storage.getBankTransaction(txId);
      if (!tx) return res.status(404).json({ error: "Transaction not found" });

      const aid = appId(req);
      if (tx.applicationId !== aid) return res.status(403).json({ error: "Accès interdit" });

      const amountMajor = Math.abs(tx.amount) / 100;
      const isExpense = tx.amount < 0;

      const accs = await storage.getAccounts(aid);
      const bankAcc = accs.find(a => a.code.startsWith("512"));
      const counterpartAcc = isExpense
        ? accs.find(a => a.code.startsWith("401"))
        : accs.find(a => a.code.startsWith("411"));

      const bankCode = bankAcc?.code || "512";
      const bankLabel = bankAcc?.name || "Banques";
      const counterCode = counterpartAcc?.code || (isExpense ? "401" : "411");
      const counterLabel = counterpartAcc?.name || (isExpense ? "Fournisseurs" : "Clients");

      const entryNumber = `BAN-${Date.now()}`;
      const description = `Rapprochement: ${tx.description || "Transaction bancaire"}`;

      const debitAmt = amountMajor.toFixed(2);
      const zeroAmt = "0.00";

      const entry = await storage.createAccountingEntry({
        date: tx.transactedAt || new Date(),
        entryNumber,
        description,
        journal: "bank",
        sourceType: "payment",
        sourceId: String(txId),
        totalDebit: debitAmt,
        totalCredit: debitAmt,
        applicationId: aid,
      }, [
        {
          entryId: 0,
          accountCode: bankCode,
          accountLabel: bankLabel,
          description,
          debit: isExpense ? zeroAmt : debitAmt,
          credit: isExpense ? debitAmt : zeroAmt,
        },
        {
          entryId: 0,
          accountCode: counterCode,
          accountLabel: counterLabel,
          description,
          debit: isExpense ? debitAmt : zeroAmt,
          credit: isExpense ? zeroAmt : debitAmt,
        }
      ]);

      res.json(entry);
    }));

  // ─── ACCOUNTING ENTRIES (Écritures) ──────────────────────────────────────
  app.get("/api/accounting/entries", authenticate, ar(async (req, res) => {
    const aid = appId(req);
    const { journal, validated, from, to } = req.query as Record<string, string>;
    const filters: any = {};
    if (journal) filters.journal = journal;
    if (validated !== undefined) filters.validated = validated === "true";
    if (from) filters.from = new Date(from);
    if (to) filters.to = new Date(to);
    const entries = await storage.getAccountingEntries(aid, filters);
    res.json(entries);
  }));

  app.get("/api/accounting/entries/:id", authenticate, ar(async (req, res) => {
    const entry = await storage.getAccountingEntry(+req.params.id);
    if (!entry) return res.status(404).json({ message: "Écriture non trouvée" });
    const lines = await storage.getAccountingLines(entry.id);
    res.json({ ...entry, lines });
  }));

  app.post("/api/accounting/entries", authenticate, requireRole(["ADMIN", "SUPER_ADMIN", "ROOT_ADMIN"]), ar(async (req, res) => {
    try {
      const { lines = [], ...entryData } = req.body;
      const entry = await storage.createAccountingEntry({ ...entryData, applicationId: appId(req) }, lines);
      res.status(201).json(entry);
    } catch (e: any) { errH(e, res); }
  }));

  app.patch("/api/accounting/entries/:id/validate", authenticate, requireRole(["ADMIN", "SUPER_ADMIN", "ROOT_ADMIN"]), ar(async (req, res) => {
    const entry = await storage.validateAccountingEntry(+req.params.id, req.user!.id);
    if (!entry) return res.status(404).json({ message: "Écriture non trouvée" });
    res.json(entry);
  }));

  app.delete("/api/accounting/entries/:id", authenticate, requireRole(["SUPER_ADMIN", "ROOT_ADMIN"]), ar(async (req, res) => {
    await storage.deleteAccountingEntry(+req.params.id);
    res.json({ success: true });
  }));

  // ─── ACCOUNTING TVA REPORT ────────────────────────────────────────────────
  app.get("/api/accounting/tva", authenticate, ar(async (req, res) => {
    const aid = appId(req);
    const year = parseInt((req.query.year as string) || String(new Date().getFullYear()));
    const quarter = parseInt((req.query.quarter as string) || "0");

    let from: Date, to: Date;
    if (quarter > 0) {
      const qm = (quarter - 1) * 3;
      from = new Date(year, qm, 1);
      to = new Date(year, qm + 3, 0, 23, 59, 59);
    } else {
      from = new Date(year, 0, 1);
      to = new Date(year, 11, 31, 23, 59, 59);
    }

    const [invoicesList, expensesList, supplierInvList, bankTransactions] = await Promise.all([
      storage.getInvoices(aid),
      storage.getExpenses(aid),
      storage.getSupplierInvoices(aid),
      storage.getBankTransactionsByApp(aid),
    ]);

    const inPeriod = (d: Date | string) => { const dt = new Date(d); return dt >= from && dt <= to; };

    const tvaCollectee = invoicesList
      .filter(i => i.status === "paid" && inPeriod(i.issuedDate))
      .reduce((s, i) => s + parseFloat(i.taxAmount as any || "0"), 0)
      + bankTransactions
        .filter(tx => tx.validated && tx.amount > 0 && tx.vatAmount && tx.transactedAt && inPeriod(tx.transactedAt))
        .reduce((s, tx) => s + Math.abs(tx.vatAmount ?? 0) / 100, 0);

    const tvaSalesBase = invoicesList
      .filter(i => i.status === "paid" && inPeriod(i.issuedDate))
      .reduce((s, i) => s + parseFloat(i.subtotal as any || "0"), 0)
      + bankTransactions
        .filter(tx => tx.validated && tx.amount > 0 && tx.netAmount && tx.transactedAt && inPeriod(tx.transactedAt))
        .reduce((s, tx) => s + Math.abs(tx.netAmount ?? 0) / 100, 0);

    const tvaDeductible = [
      ...expensesList.filter(e => inPeriod(e.date!)).map(e => parseFloat(e.taxAmount as any || "0")),
      ...supplierInvList.filter(i => inPeriod(i.issuedDate)).map(i => parseFloat(i.taxAmount as any || "0")),
      ...bankTransactions
        .filter(tx => tx.validated && tx.amount < 0 && tx.vatAmount && tx.transactedAt && inPeriod(tx.transactedAt))
        .map(tx => Math.abs(tx.vatAmount ?? 0) / 100),
    ].reduce((s, n) => s + n, 0);

    const tvaExpenseBase = [
      ...expensesList.filter(e => inPeriod(e.date!)).map(e => parseFloat(e.amount as any || "0")),
      ...supplierInvList.filter(i => inPeriod(i.issuedDate)).map(i => parseFloat(i.subtotal as any || "0")),
      ...bankTransactions
        .filter(tx => tx.validated && tx.amount < 0 && tx.netAmount && tx.transactedAt && inPeriod(tx.transactedAt))
        .map(tx => Math.abs(tx.netAmount ?? 0) / 100),
    ].reduce((s, n) => s + n, 0);

    const tvaNet = tvaCollectee - tvaDeductible;

    const byMonth: Record<string, { collectee: number; deductible: number; base: number }> = {};
    const monthNames = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
    invoicesList.filter(i => i.status === "paid" && inPeriod(i.issuedDate)).forEach(i => {
      const m = monthNames[new Date(i.issuedDate).getMonth()];
      if (!byMonth[m]) byMonth[m] = { collectee: 0, deductible: 0, base: 0 };
      byMonth[m].collectee += parseFloat(i.taxAmount as any || "0");
      byMonth[m].base += parseFloat(i.subtotal as any || "0");
    });
    expensesList.filter(e => inPeriod(e.date!)).forEach(e => {
      const m = monthNames[new Date(e.date!).getMonth()];
      if (!byMonth[m]) byMonth[m] = { collectee: 0, deductible: 0, base: 0 };
      byMonth[m].deductible += parseFloat(e.taxAmount as any || "0");
    });

    res.json({
      period: { year, quarter, from, to },
      tvaCollectee,
      tvaSalesBase,
      tvaDeductible,
      tvaExpenseBase,
      tvaNet,
      status: tvaNet > 0 ? "à_payer" : "crédit",
      byMonth: Object.entries(byMonth).map(([month, v]) => ({ month, ...v, net: v.collectee - v.deductible })),
    });
  }));

  // ─── ACCOUNTING P&L REPORT ────────────────────────────────────────────────
  app.get("/api/accounting/pnl", authenticate, ar(async (req, res) => {
    const aid = appId(req);
    const year = parseInt((req.query.year as string) || String(new Date().getFullYear()));
    const from = new Date(year, 0, 1);
    const to = new Date(year, 11, 31, 23, 59, 59);
    const inPeriod = (d: Date | string) => { const dt = new Date(d); return dt >= from && dt <= to; };
    const monthNames = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

    const [invoicesList, expensesList, supplierInvList, bankTransactions] = await Promise.all([
      storage.getInvoices(aid),
      storage.getExpenses(aid),
      storage.getSupplierInvoices(aid),
      storage.getBankTransactionsByApp(aid),
    ]);

    const paidInvoices = invoicesList.filter(i => i.status === "paid" && inPeriod(i.issuedDate));
    const revenue = paidInvoices.reduce((s, i) => s + parseFloat(i.subtotal as any || "0"), 0)
      + bankTransactions
        .filter(tx => tx.validated && tx.amount > 0 && tx.netAmount && tx.transactedAt && inPeriod(tx.transactedAt))
        .reduce((s, tx) => s + Math.abs(tx.netAmount ?? 0) / 100, 0);
    const revenueTotal = paidInvoices.reduce((s, i) => s + parseFloat(i.total as any || "0"), 0)
      + bankTransactions
        .filter(tx => tx.validated && tx.amount > 0 && tx.transactedAt && inPeriod(tx.transactedAt))
        .reduce((s, tx) => s + Math.abs(tx.amount) / 100, 0);

    const expenses_ = expensesList.filter(e => inPeriod(e.date!));
    const supplierInv_ = supplierInvList.filter(i => inPeriod(i.issuedDate));
    const bankExpenses = bankTransactions
      .filter(tx => tx.validated && tx.amount < 0 && tx.netAmount && tx.transactedAt && inPeriod(tx.transactedAt))
      .reduce((s, tx) => s + Math.abs(tx.netAmount ?? 0) / 100, 0);
    const totalExpenses = expenses_.reduce((s, e) => s + parseFloat(e.amount as any || "0"), 0)
      + supplierInv_.reduce((s, i) => s + parseFloat(i.subtotal as any || "0"), 0)
      + bankExpenses;

    const grossProfit = revenue - totalExpenses;
    const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    const byMonth = monthNames.map((m, idx) => {
      const mInvoices = paidInvoices.filter(i => new Date(i.issuedDate).getMonth() === idx);
      const mExpenses = expenses_.filter(e => new Date(e.date!).getMonth() === idx);
      const mSI = supplierInv_.filter(i => new Date(i.issuedDate).getMonth() === idx);
      const mRev = mInvoices.reduce((s, i) => s + parseFloat(i.subtotal as any || "0"), 0);
      const mExp = mExpenses.reduce((s, e) => s + parseFloat(e.amount as any || "0"), 0)
        + mSI.reduce((s, i) => s + parseFloat(i.subtotal as any || "0"), 0);
      return { month: m, revenue: mRev, expenses: mExp, profit: mRev - mExp };
    });

    const expensesByCategory: Record<string, number> = {};
    expenses_.forEach(e => { expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + parseFloat(e.amount as any || "0"); });

    res.json({
      year,
      revenue,
      revenueTotal,
      totalExpenses,
      grossProfit,
      margin,
      byMonth,
      expensesByCategory: Object.entries(expensesByCategory).map(([cat, amt]) => ({ category: cat, amount: amt })),
    });
  }));

  // ─── CASH FLOW REPORT ─────────────────────────────────────────────────────
  app.get("/api/accounting/cashflow", authenticate, ar(async (req, res) => {
    const aid = appId(req);
    const year = parseInt((req.query.year as string) || String(new Date().getFullYear()));
    const monthNames = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

    const [invoicesList, expensesList, paymentsList] = await Promise.all([
      storage.getInvoices(aid),
      storage.getExpenses(aid),
      storage.getPayments(aid),
    ]);

    const byMonth = monthNames.map((m, idx) => {
      const inbound = paymentsList
        .filter(p => p.direction === "inbound" && new Date(p.date).getFullYear() === year && new Date(p.date).getMonth() === idx)
        .reduce((s, p) => s + parseFloat(p.amount as any), 0);
      const outbound = paymentsList
        .filter(p => p.direction === "outbound" && new Date(p.date).getFullYear() === year && new Date(p.date).getMonth() === idx)
        .reduce((s, p) => s + parseFloat(p.amount as any), 0);
      return { month: m, inbound, outbound, net: inbound - outbound };
    });

    const totalInbound = byMonth.reduce((s, m) => s + m.inbound, 0);
    const totalOutbound = byMonth.reduce((s, m) => s + m.outbound, 0);

    res.json({ year, byMonth, totalInbound, totalOutbound, netCashFlow: totalInbound - totalOutbound });
  }));

  // ─── FEC EXPORT ───────────────────────────────────────────────────────────
  app.get("/api/accounting/fec", authenticate, requireRole(["ADMIN", "SUPER_ADMIN", "ROOT_ADMIN"]), ar(async (req, res) => {
    const aid = appId(req);
    const year = parseInt((req.query.year as string) || String(new Date().getFullYear()));
    const from = new Date(year, 0, 1);
    const to = new Date(year, 11, 31, 23, 59, 59);
    const inPeriod = (d: Date | string) => { const dt = new Date(d); return dt >= from && dt <= to; };
    const fmtDate = (d: Date | string) => { const dt = new Date(d); return `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,"0")}${String(dt.getDate()).padStart(2,"0")}`; };
    const fmtAmt = (n: number | string) => parseFloat(n as string).toFixed(2).replace(".", ",");

    const [invoicesList, expensesList] = await Promise.all([
      storage.getInvoices(aid),
      storage.getExpenses(aid),
    ]);

    const lines: string[] = [];
    const header = "JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompAuxNum|CompAuxLib|PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise";
    lines.push(header);

    let ecrNum = 1;
    const addLine = (journal: string, journalLib: string, date: Date | string, compteNum: string, compteLib: string, auxNum: string, auxLib: string, ref: string, label: string, debit: number, credit: number) => {
      lines.push([
        journal, journalLib, String(ecrNum).padStart(8,"0"), fmtDate(date),
        compteNum, compteLib, auxNum, auxLib,
        ref, fmtDate(date), label,
        fmtAmt(debit), fmtAmt(credit),
        "","","","","",
      ].join("|"));
    };

    invoicesList.filter(i => inPeriod(i.issuedDate)).forEach(inv => {
      const total = parseFloat(inv.total as any);
      const tax = parseFloat(inv.taxAmount as any || "0");
      const sub = parseFloat(inv.subtotal as any || "0");
      addLine("VTE","Ventes",inv.issuedDate,"411000","Clients","","",inv.number,`Facture ${inv.number} - ${inv.clientName}`,total,0);
      addLine("VTE","Ventes",inv.issuedDate,"706000","Prestations de services","","",inv.number,`Facture ${inv.number} - ${inv.clientName}`,0,sub);
      if (tax > 0) addLine("VTE","Ventes",inv.issuedDate,"445710","TVA collectée","","",inv.number,`TVA Facture ${inv.number}`,0,tax);
      ecrNum++;
    });

    expensesList.filter(e => inPeriod(e.date!)).forEach(exp => {
      const total = parseFloat(exp.total as any);
      const tax = parseFloat(exp.taxAmount as any || "0");
      const amount = parseFloat(exp.amount as any || "0");
      addLine("ACH","Achats",exp.date!,"606100","Achats","","",String(exp.id),exp.description,amount,0);
      if (tax > 0) addLine("ACH","Achats",exp.date!,"445660","TVA déductible","","",String(exp.id),`TVA ${exp.description}`,tax,0);
      addLine("ACH","Achats",exp.date!,"401000","Fournisseurs","","",String(exp.id),exp.description,0,total);
      ecrNum++;
    });

    const filename = `FEC_${year}.txt`;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(lines.join("\n"));
  }));

  // ─── CREDIT NOTE ITEMS ────────────────────────────────────────────────────
  app.get("/api/credit-notes/:id/items", authenticate, ar(async (req, res) => {
    const items = await storage.getCreditNoteItems(+req.params.id);
    res.json(items);
  }));

  app.post("/api/credit-notes/:id/items", authenticate, ar(async (req, res) => {
    try {
      const item = await storage.createCreditNoteItem({ ...req.body, creditNoteId: +req.params.id });
      res.status(201).json(item);
    } catch (e: any) { errH(e, res); }
  }));

  // ─── API GATEWAY ──────────────────────────────────────────────────────────
  setupApiGateway(app);
  setupApiAdmin(app, authenticate, requireRole);

  // ─── OBJECT STORAGE (presigned uploads + serve) ─────────────────────────
  // ─── OBJECT STORAGE — routes sécurisées (override registerObjectStorageRoutes) ─
  // /api/uploads/request-url et GET /objects/* sont protégés par auth + tenant.
  {
    const { ObjectStorageService, ObjectNotFoundError } =
      await import("./replit_integrations/object_storage/objectStorage");
    const { db } = await import("./db");
    const { bankTransactions, bankAccounts, expenses, invoices, supplierInvoices, appointments } =
      await import("./shared/schema");
    const { eq } = await import("drizzle-orm");
    const svc = new ObjectStorageService();

    // Génère un presigned URL d'upload (auth obligatoire, taille bornée).
    app.post("/api/uploads/request-url", authenticate, ar(async (req: any, res: any) => {
      const { name, size, contentType } = req.body ?? {};
      if (!name || typeof name !== "string") return res.status(400).json({ error: "name requis" });
      const MAX = 25 * 1024 * 1024; // 25 Mo
      if (typeof size === "number" && size > MAX) {
        return res.status(413).json({ error: `Fichier > ${MAX / 1024 / 1024} Mo` });
      }
      const aid = appId(req);
      if (aid == null && !isSuperOrRoot(req.user!.role)) {
        return res.status(403).json({ error: "Tenant non identifié (X-App-Id requis)" });
      }
      const { url: uploadURL, objectPath } = await svc.getObjectEntityUploadURL(aid);
      res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
    }));

    // Vérifie que l'utilisateur courant a accès à ce path via une de ses ressources.
    const userOwnsAttachment = async (path: string, userAppId: number): Promise<boolean> => {
      const checks = await Promise.all([
        db.select({ a: bankTransactions.id, app: bankAccounts.applicationId })
          .from(bankTransactions)
          .leftJoin(bankAccounts, eq(bankTransactions.bankAccountId, bankAccounts.id))
          .where(eq(bankTransactions.attachmentPath, path)),
        db.select({ app: expenses.applicationId }).from(expenses).where(eq(expenses.attachmentPath, path)),
        db.select({ app: invoices.applicationId }).from(invoices).where(eq(invoices.attachmentPath, path)),
        db.select({ app: supplierInvoices.applicationId }).from(supplierInvoices).where(eq(supplierInvoices.attachmentPath, path)),
        db.select({ app: appointments.applicationId }).from(appointments).where(eq(appointments.attachmentPath, path)),
      ]);
      for (const rows of checks) {
        for (const r of rows as any[]) {
          if (r.app === userAppId) return true;
        }
      }
      return false;
    };

    // Sert un objet : auth + ACL tenant. SUPER/ROOT bypassent.
    app.get(/^\/objects\/(.+)$/, authenticate, ar(async (req: any, res: any) => {
      try {
        if (!isSuperOrRoot(req.user!.role)) {
          const allowed = await userOwnsAttachment(req.path, appId(req));
          if (!allowed) return res.status(403).json({ error: "Accès interdit" });
        }
        const objectFile = await svc.getObjectEntityFile(req.path);
        await svc.downloadObject(objectFile, res);
      } catch (error) {
        if (error instanceof ObjectNotFoundError) {
          return res.status(404).json({ error: "Fichier introuvable" });
        }
        console.error("Erreur lecture objet:", error);
        return res.status(500).json({ error: "Erreur lecture fichier" });
      }
    }));
  }

  return httpServer;
}

export async function seedDatabase() {
  const existingApps = await storage.getApplications();
  if (existingApps.length === 0) {
    const myJantes = await storage.createApplication({ name: "MyJantes", description: "Gestion comptable & budget" });
    const saPass = await hashPassword("superadmin");
    await storage.createUser({ name: "Super Admin", email: "rbelmahi90@gmail.com", password: saPass, role: "SUPER_ADMIN", applicationId: myJantes.id });
    const adPass = await hashPassword("admin123");
    await storage.createUser({ name: "Admin MyJantes", email: "contact@myjantes.com", password: adPass, role: "ADMIN", applicationId: myJantes.id });

    const infraServices = [
      { name: "Plaid",               provider: "Plaid Inc.",          cost: "50.00", notes: "Open Banking — connexion bancaire | Variable : 0,30 € par transaction" },
      { name: "Twilio",              provider: "Twilio Inc.",          cost: "20.00", notes: "Notifications SMS | Variable : 0,05 € par SMS envoyé" },
      { name: "Firebase",            provider: "Google Firebase",      cost: "25.00", notes: "Auth + Firestore + Hosting | Variable : selon usage réel (Firestore reads/writes, bande passante)" },
      { name: "Mindee",              provider: "Mindee SAS",           cost: "30.00", notes: "OCR factures & reçus | Variable : 0,10 € par document analysé" },
      { name: "Gemini",              provider: "Google DeepMind",      cost: "40.00", notes: "Analyse financière IA | Variable : 0,02 € par requête d'analyse" },
      { name: "IA Conceptor",        provider: "IA Conceptor",         cost: "50.00", notes: "Génération automatisée de contenu | Variable : selon volume de génération" },
      { name: "Comptabilité Express",provider: "Comptabilité Express", cost: "20.00", notes: "Export comptable & rapports | Pas de coût variable" },
      { name: "Media Storage",       provider: "Cloud Storage",        cost: "15.00", notes: "Stockage fichiers & justificatifs | Variable : 0,01 € par Mo stocké" },
    ];

    for (const s of infraServices) {
      await storage.createService({
        name: s.name,
        provider: s.provider,
        category: "Infrastructure",
        billingType: "monthly",
        cost: s.cost,
        currency: "EUR",
        nextBillingDate: new Date(Date.now() + 30 * 86400000),
        status: "active",
        isGlobal: false,
        applicationId: myJantes.id,
        notes: s.notes,
      });
      await storage.createExpense({
        description: `Abonnement ${s.name}`,
        amount: s.cost,
        taxAmount: "0",
        total: s.cost,
        category: "Infrastructure",
        date: new Date(),
        status: "approved",
        supplierName: s.provider,
        applicationId: myJantes.id,
        notes: s.notes,
      });
    }

    const accountsSeed = [
      { code: "101", name: "Capital social", type: "equity", category: "Capitaux propres" },
      { code: "106", name: "Réserves", type: "equity", category: "Capitaux propres" },
      { code: "120", name: "Résultat de l'exercice", type: "equity", category: "Capitaux propres" },
      { code: "401", name: "Fournisseurs", type: "liability", category: "Dettes" },
      { code: "404", name: "Fournisseurs d'immobilisations", type: "liability", category: "Dettes" },
      { code: "411", name: "Clients", type: "asset", category: "Créances" },
      { code: "421", name: "Personnel — rémunérations dues", type: "liability", category: "Dettes sociales" },
      { code: "431", name: "Sécurité sociale", type: "liability", category: "Dettes sociales" },
      { code: "445", name: "TVA à décaisser", type: "liability", category: "Dettes fiscales" },
      { code: "447", name: "Autres impôts et taxes", type: "liability", category: "Dettes fiscales" },
      { code: "512", name: "Banques", type: "asset", category: "Trésorerie" },
      { code: "530", name: "Caisse", type: "asset", category: "Trésorerie" },
      { code: "601", name: "Achats de marchandises", type: "expense", category: "Charges d'exploitation" },
      { code: "606", name: "Achats non stockés (fournitures)", type: "expense", category: "Charges d'exploitation" },
      { code: "611", name: "Sous-traitance générale", type: "expense", category: "Charges d'exploitation" },
      { code: "613", name: "Locations", type: "expense", category: "Charges d'exploitation" },
      { code: "616", name: "Assurances", type: "expense", category: "Charges d'exploitation" },
      { code: "622", name: "Rémunérations d'intermédiaires", type: "expense", category: "Charges d'exploitation" },
      { code: "626", name: "Frais postaux et télécommunications", type: "expense", category: "Charges d'exploitation" },
      { code: "627", name: "Services bancaires", type: "expense", category: "Charges d'exploitation" },
      { code: "628", name: "Abonnements informatiques & SaaS", type: "expense", category: "Charges d'exploitation" },
      { code: "635", name: "Impôts et taxes", type: "expense", category: "Charges d'exploitation" },
      { code: "641", name: "Rémunérations du personnel", type: "expense", category: "Charges de personnel" },
      { code: "645", name: "Charges de sécurité sociale", type: "expense", category: "Charges de personnel" },
      { code: "681", name: "Dotations aux amortissements", type: "expense", category: "Dotations" },
      { code: "706", name: "Prestations de services", type: "revenue", category: "Produits d'exploitation" },
      { code: "707", name: "Ventes de marchandises", type: "revenue", category: "Produits d'exploitation" },
      { code: "708", name: "Produits des activités annexes", type: "revenue", category: "Produits d'exploitation" },
      { code: "757", name: "Subventions d'exploitation", type: "revenue", category: "Produits d'exploitation" },
      { code: "764", name: "Revenus des valeurs mobilières", type: "revenue", category: "Produits financiers" },
    ];
    for (const acc of accountsSeed) {
      await storage.createAccount({ ...acc, balance: "0", applicationId: myJantes.id });
    }

    const defaultCategories = [
      { name: "Infrastructure", icon: "server", color: "#6366f1" },
      { name: "Voyage", icon: "plane", color: "#06b6d4" },
      { name: "Logiciels", icon: "laptop", color: "#8b5cf6" },
      { name: "Bureau", icon: "building", color: "#f59e0b" },
      { name: "Marketing", icon: "megaphone", color: "#ec4899" },
      { name: "Personnel", icon: "users", color: "#10b981" },
      { name: "Sous-traitance", icon: "handshake", color: "#f97316" },
      { name: "Fournisseurs", icon: "truck", color: "#3b82f6" },
      { name: "Clients", icon: "user-check", color: "#14b8a6" },
      { name: "Autre", icon: "circle", color: "#6b7280" },
    ];
    for (const cat of defaultCategories) {
      await storage.createExpenseCategory({ ...cat, applicationId: myJantes.id });
    }
  }
}

// ─── USER MIGRATIONS ───────────────────────────────────────────────────────────
// Runs at every startup to ensure specific accounts have the correct role/password.
export async function migrateUsers() {
  try {
    const pwd = await hashPassword("000000");

    // 1. rbelmahi90@gmail.com → ROOT_ADMIN
    const rootUser = await storage.getUserByEmail("rbelmahi90@gmail.com");
    if (rootUser) {
      await storage.updateUser(rootUser.id, { role: "ROOT_ADMIN", password: pwd });
      console.log("[Migration] rbelmahi90@gmail.com set to ROOT_ADMIN");
    }

    // 2. contact@myjantes.com → ROOT_ADMIN
    const adminUser = await storage.getUserByEmail("contact@myjantes.com");
    if (adminUser) {
      await storage.updateUser(adminUser.id, { role: "ROOT_ADMIN", password: pwd });
      console.log("[Migration] contact@myjantes.com set to ROOT_ADMIN");
    }
  } catch (err) {
    console.error("[Migration] migrateUsers error:", err);
  }
}
