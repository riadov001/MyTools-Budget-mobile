/**
 * Accounting domain schema for MyTools-Budget.
 *
 * --------------------------------------------------------------------------
 * IMPORTANT — zero-regression design
 * --------------------------------------------------------------------------
 * The legacy schema in `artifacts/api-server/src/shared/schema.ts` already
 * defines `public.accounts`, `public.invoices`, `public.payments`, etc.
 *
 * To guarantee that introducing this new accounting model NEVER conflicts
 * with the existing tables (data, FKs, indexes), every entity declared in
 * this file lives in a dedicated Postgres schema namespace called
 * `accounting`. Physically the tables are `accounting.accounts`,
 * `accounting.transactions`, `accounting.invoices`, `accounting.bills` and
 * `accounting.payments` — completely isolated from the `public` schema
 * where the legacy tables live.
 *
 * The TypeScript export names follow the user spec exactly (`accounts`,
 * `transactions`, `invoices`, `bills`, `payments`, plus the Zod schemas).
 * If both schemas need to be imported in the same module, alias one side:
 *
 *   import { accounts as legacyAccounts } from "@shared/schema";
 *   import { accounts as accountingAccounts } from "@mytools/shared/schemas/accounting";
 *
 * Drizzle migration (Étape 3) will generate `CREATE SCHEMA accounting`
 * on first push.
 * --------------------------------------------------------------------------
 */

import {
  pgSchema,
  uuid,
  timestamp,
  numeric,
  text,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { z } from "zod";

// ===========================================================================
// SCHEMA NAMESPACE
// ===========================================================================
export const accountingSchema = pgSchema("accounting");

// ===========================================================================
// ENUMS
// ===========================================================================
export const transactionTypeEnum = accountingSchema.enum("transaction_type", [
  "income",
  "expense",
  "transfer",
]);

export const invoiceStatusEnum = accountingSchema.enum("invoice_status", [
  "draft",
  "sent",
  "partial",
  "paid",
  "overdue",
  "cancelled",
]);

// TVA marocaine (taux légaux : 0%, 7%, 10%, 14%, 20%)
export const tvaRateEnum = accountingSchema.enum("tva_rate", [
  "0",
  "7",
  "10",
  "14",
  "20",
]);

export const paymentMethodEnum = accountingSchema.enum("payment_method", [
  "cash",
  "bank_transfer",
  "card",
  "cheque",
  "paypal",
  "other",
]);

// ===========================================================================
// TABLES
// ===========================================================================

// Comptes bancaires / caisse / carte
export const accounts = accountingSchema.table("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // bank | cash | card (kept as free-form text per spec; can be tightened to enum later)
  type: text("type").notNull(),
  balance: numeric("balance", { precision: 12, scale: 2 }).default("0"),
  currency: text("currency").default("MAD"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Transactions — cœur de la compta. Remplace progressivement `expenses` (legacy).
export const transactions = accountingSchema.table(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: transactionTypeEnum("type").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    dateOperation: timestamp("date_operation").notNull(),
    dateValeur: timestamp("date_valeur"),
    accountId: uuid("account_id").references(() => accounts.id),
    category: text("category").notNull(),
    subCategory: text("sub_category"),
    tags: text("tags").array(),
    description: text("description"),
    notes: text("notes"),
    tvaRate: tvaRateEnum("tva_rate").default("20"),
    tvaAmount: numeric("tva_amount", { precision: 12, scale: 2 }),
    reconciled: boolean("reconciled").default(false),
    attachmentIds: uuid("attachment_ids").array(),
    reference: text("reference"),
    projectId: uuid("project_id"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    // Prefixed to avoid collisions with any other "date_idx" in the public schema
    dateIdx: index("accounting_transactions_date_idx").on(table.dateOperation),
    accountIdx: index("accounting_transactions_account_idx").on(table.accountId),
    typeIdx: index("accounting_transactions_type_idx").on(table.type),
  }),
);

// Item structure embedded in invoices / bills (jsonb)
export type AccountingLineItem = {
  description: string;
  qty: number;
  unitPrice: string;
  tvaRate: string;
};

// Factures clients
export const invoices = accountingSchema.table("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: text("number").unique().notNull(),
  clientName: text("client_name").notNull(),
  dateEmission: timestamp("date_emission").notNull(),
  dateEcheance: timestamp("date_echeance").notNull(),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  totalHT: numeric("total_ht", { precision: 12, scale: 2 }).notNull(),
  totalTTC: numeric("total_ttc", { precision: 12, scale: 2 }).notNull(),
  items: jsonb("items").$type<AccountingLineItem[]>().notNull(),
  notes: text("notes"),
  attachmentIds: uuid("attachment_ids").array(),
  transactionId: uuid("transaction_id").references(() => transactions.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Factures fournisseurs — même structure que `invoices` mais pour le passif fournisseur
export const bills = accountingSchema.table("bills", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: text("number").unique().notNull(),
  supplierName: text("supplier_name").notNull(),
  dateEmission: timestamp("date_emission").notNull(),
  dateEcheance: timestamp("date_echeance").notNull(),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  totalHT: numeric("total_ht", { precision: 12, scale: 2 }).notNull(),
  totalTTC: numeric("total_ttc", { precision: 12, scale: 2 }).notNull(),
  items: jsonb("items").$type<AccountingLineItem[]>().notNull(),
  notes: text("notes"),
  attachmentIds: uuid("attachment_ids").array(),
  transactionId: uuid("transaction_id").references(() => transactions.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Paiements (partiels ou totaux) liés à une transaction et/ou une facture/bill
export const payments = accountingSchema.table("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: timestamp("date").notNull(),
  method: paymentMethodEnum("method").notNull(),
  reference: text("reference"),
  notes: text("notes"),
  transactionId: uuid("transaction_id").references(() => transactions.id),
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  billId: uuid("bill_id").references(() => bills.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ===========================================================================
// RELATIONS
// ===========================================================================

export const accountsRelations = relations(accounts, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  payments: many(payments),
  invoice: one(invoices, {
    fields: [transactions.id],
    references: [invoices.transactionId],
  }),
  bill: one(bills, {
    fields: [transactions.id],
    references: [bills.transactionId],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  transaction: one(transactions, {
    fields: [invoices.transactionId],
    references: [transactions.id],
  }),
  payments: many(payments),
}));

export const billsRelations = relations(bills, ({ one, many }) => ({
  transaction: one(transactions, {
    fields: [bills.transactionId],
    references: [transactions.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  transaction: one(transactions, {
    fields: [payments.transactionId],
    references: [transactions.id],
  }),
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
  bill: one(bills, {
    fields: [payments.billId],
    references: [bills.id],
  }),
}));

// ===========================================================================
// TYPES (inferred from drizzle table definitions)
// ===========================================================================

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

// ===========================================================================
// ZOD SCHEMAS
// ===========================================================================

const lineItemSchema = z.object({
  description: z.string().min(1),
  qty: z.number().positive(),
  unitPrice: z.string(),
  tvaRate: z.string(),
});

const tvaRateValues = ["0", "7", "10", "14", "20"] as const;
const transactionTypeValues = ["income", "expense", "transfer"] as const;
const invoiceStatusValues = [
  "draft",
  "sent",
  "partial",
  "paid",
  "overdue",
  "cancelled",
] as const;
const paymentMethodValues = [
  "cash",
  "bank_transfer",
  "card",
  "cheque",
  "paypal",
  "other",
] as const;

export const AccountSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  balance: z.string().optional(),
  currency: z.string().optional(),
});
export type AccountInput = z.infer<typeof AccountSchema>;

export const TransactionSchema = z.object({
  type: z.enum(transactionTypeValues),
  amount: z.string(),
  dateOperation: z.coerce.date(),
  dateValeur: z.coerce.date().optional(),
  accountId: z.string().uuid().optional(),
  category: z.string().min(1),
  subCategory: z.string().optional(),
  tags: z.array(z.string()).optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  tvaRate: z.enum(tvaRateValues).optional(),
  tvaAmount: z.string().optional(),
  reconciled: z.boolean().optional(),
  attachmentIds: z.array(z.string().uuid()).optional(),
  reference: z.string().optional(),
  projectId: z.string().uuid().optional(),
});
export type TransactionInput = z.infer<typeof TransactionSchema>;

export const InvoiceSchema = z.object({
  number: z.string().min(1),
  clientName: z.string().min(1),
  dateEmission: z.coerce.date(),
  dateEcheance: z.coerce.date(),
  status: z.enum(invoiceStatusValues).optional(),
  totalHT: z.string(),
  totalTTC: z.string(),
  items: z.array(lineItemSchema).min(1),
  notes: z.string().optional(),
  attachmentIds: z.array(z.string().uuid()).optional(),
  transactionId: z.string().uuid().optional(),
});
export type InvoiceInput = z.infer<typeof InvoiceSchema>;

export const BillSchema = z.object({
  number: z.string().min(1),
  supplierName: z.string().min(1),
  dateEmission: z.coerce.date(),
  dateEcheance: z.coerce.date(),
  status: z.enum(invoiceStatusValues).optional(),
  totalHT: z.string(),
  totalTTC: z.string(),
  items: z.array(lineItemSchema).min(1),
  notes: z.string().optional(),
  attachmentIds: z.array(z.string().uuid()).optional(),
  transactionId: z.string().uuid().optional(),
});
export type BillInput = z.infer<typeof BillSchema>;

export const PaymentSchema = z.object({
  amount: z.string(),
  date: z.coerce.date(),
  method: z.enum(paymentMethodValues),
  reference: z.string().optional(),
  notes: z.string().optional(),
  transactionId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  billId: z.string().uuid().optional(),
});
export type PaymentInput = z.infer<typeof PaymentSchema>;
