import cron from "node-cron";
import { storage } from "./storage";
import { db } from "./db";
import { services, supplierInvoices, expenses, invoices, invoiceItems } from "@shared/schema";
import { and, gte, lte, eq, not, isNotNull, or, isNull, lt, sql } from "drizzle-orm";
import {
  sendUpcomingPaymentAlert,
  sendSupplierInvoiceDueReminder,
  MYJANTES_EMAIL,
  SUPERADMIN_EMAIL,
} from "./email";

/**
 * Last day of the month for a given (year, monthIdx 0-11).
 */
function lastDayOfMonth(year: number, monthIdx: number): number {
  return new Date(year, monthIdx + 1, 0).getDate();
}

/**
 * Compute the next occurrence date based on a frequency + interval.
 * Calendar-stable: when adding months/years, anchor day is preserved
 * by clamping to the target month's last day if needed (Jan 31 + 1 month = Feb 28/29,
 * not March 3 like JS's native setMonth would produce).
 */
export function computeNextOccurrence(from: Date, frequency: string | null, interval: number): Date {
  const i = Math.max(1, interval || 1);
  const next = new Date(from.getTime());
  switch (frequency) {
    case "daily":
      next.setUTCDate(next.getUTCDate() + i);
      break;
    case "weekly":
      next.setUTCDate(next.getUTCDate() + 7 * i);
      break;
    case "monthly": {
      const anchor = from.getUTCDate();
      const targetMonth = from.getUTCMonth() + i;
      const targetYear = from.getUTCFullYear() + Math.floor(targetMonth / 12);
      const monthIdx = ((targetMonth % 12) + 12) % 12;
      const day = Math.min(anchor, lastDayOfMonth(targetYear, monthIdx));
      next.setUTCFullYear(targetYear, monthIdx, day);
      break;
    }
    case "yearly": {
      const anchor = from.getUTCDate();
      const monthIdx = from.getUTCMonth();
      const targetYear = from.getUTCFullYear() + i;
      const day = Math.min(anchor, lastDayOfMonth(targetYear, monthIdx));
      next.setUTCFullYear(targetYear, monthIdx, day);
      break;
    }
    default:
      // unknown frequency → +1 month default
      return computeNextOccurrence(from, "monthly", 1);
  }
  return next;
}

/**
 * Recurrence job — runs hourly. Idempotent via atomic claim:
 * we bump `nextOccurrenceDate` BEFORE creating the child copy,
 * so a concurrent run (or crash-restart) cannot pick the same row twice.
 * If child creation later fails, we log and continue (the next cycle
 * will pick up the next occurrence). A future improvement could record
 * a uniqueness key (parentId, originalDate) for retry safety.
 */
async function runRecurrenceJob() {
  const now = new Date();

  // ── Recurring expenses ──────────────────────────────────────────────────────
  // Atomically claim due rows by bumping nextOccurrenceDate to a sentinel far future,
  // then we re-compute the proper next date after generating the child.
  // (Postgres-row-level locking via FOR UPDATE SKIP LOCKED is implicit per-row
  //  on UPDATE...RETURNING; concurrent jobs simply won't see the claimed row.)
  const dueExpenses = await db
    .select()
    .from(expenses)
    .where(
      and(
        eq(expenses.isRecurring, true),
        isNotNull(expenses.nextOccurrenceDate),
        lte(expenses.nextOccurrenceDate, now),
        or(isNull(expenses.recurrenceEndDate), gte(expenses.recurrenceEndDate, now)),
      ),
    );

  for (const tpl of dueExpenses) {
    const occurrenceDate = new Date(tpl.nextOccurrenceDate!);
    const next = computeNextOccurrence(
      occurrenceDate,
      tpl.recurrenceFrequency,
      tpl.recurrenceInterval,
    );

    // ── ATOMIC CLAIM: only this run will succeed for a given (id, occurrenceDate)
    const claim = await db
      .update(expenses)
      .set({ nextOccurrenceDate: next })
      .where(and(eq(expenses.id, tpl.id), eq(expenses.nextOccurrenceDate, occurrenceDate)))
      .returning({ id: expenses.id });

    if (claim.length === 0) {
      // Another worker already claimed/bumped this template — skip
      continue;
    }

    try {
      // Preserve due-date offset relative to the original date (like invoices)
      let childDueDate: Date | null = null;
      if (tpl.dueDate) {
        const offsetMs = new Date(tpl.dueDate).getTime() - new Date(tpl.date).getTime();
        childDueDate = new Date(occurrenceDate.getTime() + offsetMs);
      }

      await storage.createExpense({
        description: tpl.description,
        amount: tpl.amount as unknown as string,
        taxAmount: tpl.taxAmount as unknown as string,
        total: tpl.total as unknown as string,
        category: tpl.category,
        date: occurrenceDate,
        dueDate: childDueDate,
        status: "unpaid",
        paymentMethod: tpl.paymentMethod,
        supplierId: tpl.supplierId,
        supplierName: tpl.supplierName,
        userId: tpl.userId,
        applicationId: tpl.applicationId,
        notes: tpl.notes,
        attachmentPath: null,
        attachmentName: null,
        isRecurring: false,
        recurrenceFrequency: null,
        recurrenceInterval: 1,
        recurrenceEndDate: null,
        recurrenceParentId: tpl.id,
        nextOccurrenceDate: null,
        updatedAt: now,
      } as never);
      console.log(`[Cron] Recurring expense #${tpl.id} → child generated for ${occurrenceDate.toISOString()}, next=${next.toISOString()}`);
    } catch (err) {
      console.error(`[Cron] Failed to generate recurring expense #${tpl.id} for ${occurrenceDate.toISOString()}:`, err);
    }
  }

  // ── Recurring invoices ──────────────────────────────────────────────────────
  const dueInvoices = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.isRecurring, true),
        isNotNull(invoices.nextOccurrenceDate),
        lte(invoices.nextOccurrenceDate, now),
        or(isNull(invoices.recurrenceEndDate), gte(invoices.recurrenceEndDate, now)),
      ),
    );

  for (const tpl of dueInvoices) {
    const occurrenceDate = new Date(tpl.nextOccurrenceDate!);
    const next = computeNextOccurrence(occurrenceDate, tpl.recurrenceFrequency, tpl.recurrenceInterval);

    // ── ATOMIC CLAIM
    const claim = await db
      .update(invoices)
      .set({ nextOccurrenceDate: next })
      .where(and(eq(invoices.id, tpl.id), eq(invoices.nextOccurrenceDate, occurrenceDate)))
      .returning({ id: invoices.id });

    if (claim.length === 0) continue;

    try {
      const newNumber = `${tpl.number}-${occurrenceDate.toISOString().slice(0, 7).replace("-", "")}`;
      const dueOffsetMs = new Date(tpl.dueDate).getTime() - new Date(tpl.issuedDate).getTime();
      const childDue = new Date(occurrenceDate.getTime() + Math.max(0, dueOffsetMs));

      const child = await storage.createInvoice({
        number: newNumber,
        clientId: tpl.clientId,
        clientName: tpl.clientName,
        clientEmail: tpl.clientEmail,
        clientAddress: tpl.clientAddress,
        status: "draft",
        subtotal: tpl.subtotal as unknown as string,
        taxRate: tpl.taxRate as unknown as string,
        taxAmount: tpl.taxAmount as unknown as string,
        total: tpl.total as unknown as string,
        currency: tpl.currency,
        issuedDate: occurrenceDate,
        dueDate: childDue,
        paidDate: null,
        notes: tpl.notes,
        applicationId: tpl.applicationId,
        isRecurring: false,
        recurrenceFrequency: null,
        recurrenceInterval: 1,
        recurrenceEndDate: null,
        recurrenceParentId: tpl.id,
        nextOccurrenceDate: null,
      } as never);

      // Copy line items
      const tplItems = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, tpl.id));
      for (const it of tplItems) {
        await storage.createInvoiceItem({
          invoiceId: child.id,
          description: it.description,
          quantity: it.quantity as unknown as string,
          unitPrice: it.unitPrice as unknown as string,
          total: it.total as unknown as string,
        } as never);
      }

      console.log(`[Cron] Recurring invoice #${tpl.id} → child #${child.id} (${occurrenceDate.toISOString()}), next=${next.toISOString()}`);
    } catch (err) {
      console.error(`[Cron] Failed to generate recurring invoice #${tpl.id} for ${occurrenceDate.toISOString()}:`, err);
    }
  }
}

export function setupCron() {
  // ── Recurrence check — every hour ─────────────────────────────────────────
  cron.schedule("0 * * * *", async () => {
    try {
      console.log("[Cron] Running hourly recurrence job...");
      await runRecurrenceJob();
    } catch (error) {
      console.error("[Cron] Recurrence job error:", error);
    }
  });

  // ── Daily reminder check at 08:00 AM ──────────────────────────────────────
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

  // Avoid unused-import warnings for `lt`/`sql` (kept for future use)
  void lt; void sql;

  console.log("[Cron] Recurrence job scheduled (hourly), reminder job scheduled (08:00 AM)");
}
