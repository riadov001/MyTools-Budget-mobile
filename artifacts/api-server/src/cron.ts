import cron from "node-cron";
import { storage } from "./storage";
import { db } from "./db";
import { services, supplierInvoices } from "@shared/schema";
import { and, gte, lte, eq, not } from "drizzle-orm";
import {
  sendUpcomingPaymentAlert,
  sendSupplierInvoiceDueReminder,
  MYJANTES_EMAIL,
  SUPERADMIN_EMAIL,
} from "./email";

export function setupCron() {
  // Run daily at 08:00 AM
  cron.schedule("0 8 * * *", async () => {
    try {
      console.log("[Cron] Running daily billing reminder check...");

      if (!process.env.RESEND_API_KEY) {
        console.log("[Cron] RESEND_API_KEY not set — skipping email sending");
        return;
      }

      // ── 1. Abonnements SaaS — 48h avant next billing date ──────────────────
      const now = new Date();
      const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const upcomingServices = await db
        .select()
        .from(services)
        .where(
          and(
            eq(services.status, "active"),
            gte(services.nextBillingDate, in24h),
            lte(services.nextBillingDate, in48h),
          )
        );

      if (upcomingServices.length > 0) {
        const serviceList = upcomingServices.map(s => {
          const nextDate = new Date(s.nextBillingDate);
          const hoursUntil = Math.ceil((nextDate.getTime() - now.getTime()) / 3600000);
          return {
            name: s.name,
            cost: s.cost as string,
            currency: s.currency,
            daysUntil: Math.max(0, Math.ceil(hoursUntil / 24)),
            nextBillingDate: nextDate.toLocaleDateString("fr-FR"),
          };
        });

        try {
          await sendUpcomingPaymentAlert({
            to: MYJANTES_EMAIL,
            userName: "Équipe MyJantes",
            services: serviceList,
            cc: [SUPERADMIN_EMAIL],
          });
          console.log(`[Cron] Reminder SaaS sent to ${MYJANTES_EMAIL} (CC: ${SUPERADMIN_EMAIL}) — ${upcomingServices.length} service(s)`);
        } catch (err) {
          console.error("[Cron] Failed to send SaaS reminder:", err);
        }
      }

      // ── 2. Factures fournisseurs — rappel 48h avant échéance ───────────────
      const supplierInvoicesRaw = await db
        .select()
        .from(supplierInvoices)
        .where(
          and(
            not(eq(supplierInvoices.status, "paid")),
            not(eq(supplierInvoices.status, "cancelled")),
            gte(supplierInvoices.dueDate, in24h),
            lte(supplierInvoices.dueDate, in48h),
          )
        );

      for (const inv of supplierInvoicesRaw) {
        const dueDate = new Date(inv.dueDate);
        const hoursUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / 3600000);
        try {
          await sendSupplierInvoiceDueReminder({
            invoiceNumber: inv.number,
            supplierName: inv.supplierName,
            total: inv.total as string,
            currency: inv.currency,
            dueDate: dueDate.toLocaleDateString("fr-FR"),
            hoursUntilDue,
          });
          console.log(`[Cron] Due reminder sent for supplier invoice ${inv.number}`);
        } catch (err) {
          console.error(`[Cron] Failed to send reminder for ${inv.number}:`, err);
        }
      }

    } catch (error) {
      console.error("[Cron] Job error:", error);
    }
  });

  console.log("[Cron] Daily reminder job scheduled (08:00 AM)");
}
