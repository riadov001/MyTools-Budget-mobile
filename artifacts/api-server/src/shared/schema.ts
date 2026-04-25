import { pgTable, text, serial, integer, boolean, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── APPLICATIONS (Multi-tenant) ─────────────────────────────────────────────
export const applications = pgTable("applications", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  siret: text("siret"),
  address: text("address"),
  email: text("email"),
  phone: text("phone"),
  currency: text("currency").notNull().default("EUR"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── USERS ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("USER"), // SUPER_ADMIN | ADMIN | USER
  applicationId: integer("application_id").references(() => applications.id),
  language: text("language").notNull().default("fr"),
  consentCguAt: timestamp("consent_cgu_at"),
  consentPrivacyAt: timestamp("consent_privacy_at"),
  consentCookiesAt: timestamp("consent_cookies_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── CHART OF ACCOUNTS (Plan Comptable) ──────────────────────────────────────
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // asset | liability | equity | revenue | expense
  category: text("category"), // e.g. "Immobilisations", "Trésorerie", "Charges"
  balance: numeric("balance", { precision: 15, scale: 2 }).notNull().default("0"),
  applicationId: integer("application_id").references(() => applications.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [index("accounts_app_idx").on(t.applicationId)]);

// ─── CLIENTS ─────────────────────────────────────────────────────────────────
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  siret: text("siret"),
  vatNumber: text("vat_number"),
  applicationId: integer("application_id").references(() => applications.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── SUPPLIERS (Fournisseurs) ─────────────────────────────────────────────────
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  siret: text("siret"),
  vatNumber: text("vat_number"),
  applicationId: integer("application_id").references(() => applications.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── INVOICES (Factures Client) ───────────────────────────────────────────────
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  number: text("number").notNull(),
  clientId: integer("client_id").references(() => clients.id),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email"),
  clientAddress: text("client_address"),
  status: text("status").notNull().default("draft"), // draft | sent | paid | overdue | cancelled
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull().default("0"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("20"),
  taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 15, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("EUR"),
  issuedDate: timestamp("issued_date").notNull().defaultNow(),
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  notes: text("notes"),
  applicationId: integer("application_id").references(() => applications.id),
  // ─── Recurrence ────────────────────────────────────────────────────────────
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurrenceFrequency: text("recurrence_frequency"), // daily | weekly | monthly | yearly
  recurrenceInterval: integer("recurrence_interval").notNull().default(1),
  recurrenceEndDate: timestamp("recurrence_end_date"),
  recurrenceParentId: integer("recurrence_parent_id"),
  nextOccurrenceDate: timestamp("next_occurrence_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── INVOICE ITEMS ────────────────────────────────────────────────────────────
export const invoiceItems = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 15, scale: 2 }).notNull().default("0"),
});

// ─── SUPPLIER INVOICES (Factures Fournisseur) ──────────────────────────────────
export const supplierInvoices = pgTable("supplier_invoices", {
  id: serial("id").primaryKey(),
  number: text("number").notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  supplierName: text("supplier_name").notNull(),
  supplierEmail: text("supplier_email"),
  supplierPhone: text("supplier_phone"),
  supplierAddress: text("supplier_address"),
  linkedServices: text("linked_services"), // JSON array of service names/ids for PDF
  status: text("status").notNull().default("pending"), // pending | approved | paid | cancelled
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull().default("0"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("20"),
  taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 15, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("EUR"),
  issuedDate: timestamp("issued_date").notNull().defaultNow(),
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  notes: text("notes"),
  applicationId: integer("application_id").references(() => applications.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── CREDIT NOTES (Avoirs) ────────────────────────────────────────────────────
export const creditNotes = pgTable("credit_notes", {
  id: serial("id").primaryKey(),
  number: text("number").notNull(),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  clientId: integer("client_id").references(() => clients.id),
  clientName: text("client_name").notNull(),
  reason: text("reason").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 15, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("EUR"),
  date: timestamp("date").notNull().defaultNow(),
  status: text("status").notNull().default("issued"), // issued | applied | cancelled
  applicationId: integer("application_id").references(() => applications.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const creditNoteItems = pgTable("credit_note_items", {
  id: serial("id").primaryKey(),
  creditNoteId: integer("credit_note_id").references(() => creditNotes.id, { onDelete: "cascade" }).notNull(),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 15, scale: 2 }).notNull().default("0"),
});

// ─── EXPENSES (Dépenses) ──────────────────────────────────────────────────────
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 15, scale: 2 }).notNull(),
  category: text("category").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  dueDate: timestamp("due_date"),
  status: text("status").notNull().default("unpaid"), // paid | unpaid | overdue | pending | approved | rejected | reimbursed
  paymentMethod: text("payment_method"), // carte | virement | especes | cheque | prelevement | autre
  supplierId: integer("supplier_id").references(() => suppliers.id),
  supplierName: text("supplier_name"),
  userId: integer("user_id").references(() => users.id),
  applicationId: integer("application_id").references(() => applications.id),
  attachmentPath: text("attachment_path"),
  attachmentName: text("attachment_name"),
  notes: text("notes"),
  // ─── Recurrence ────────────────────────────────────────────────────────────
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurrenceFrequency: text("recurrence_frequency"), // daily | weekly | monthly | yearly
  recurrenceInterval: integer("recurrence_interval").notNull().default(1),
  recurrenceEndDate: timestamp("recurrence_end_date"),
  recurrenceParentId: integer("recurrence_parent_id"),
  nextOccurrenceDate: timestamp("next_occurrence_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── PAYMENTS (Paiements) ─────────────────────────────────────────────────────
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  reference: text("reference").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("EUR"),
  date: timestamp("date").notNull().defaultNow(),
  method: text("method").notNull(), // bank_transfer | card | cash | check | direct_debit
  direction: text("direction").notNull().default("inbound"), // inbound | outbound
  entityType: text("entity_type"), // invoice | supplier_invoice | expense | service
  entityId: integer("entity_id"),
  entityLabel: text("entity_label"),
  status: text("status").notNull().default("completed"), // pending | completed | failed | refunded
  notes: text("notes"),
  applicationId: integer("application_id").references(() => applications.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── JOURNAL ENTRIES (Écritures Comptables) ───────────────────────────────────
export const accountingEntries = pgTable("accounting_entries", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").references(() => applications.id),
  entryNumber: text("entry_number").notNull().unique(),
  date: timestamp("date").notNull(),
  journal: text("journal").notNull(), // sales | purchases | bank | cash | misc
  sourceType: text("source_type").notNull(), // invoice | expense | credit_note | payment | manual
  sourceId: text("source_id"),
  description: text("description").notNull(),
  totalDebit: numeric("total_debit", { precision: 15, scale: 2 }).notNull().default("0"),
  totalCredit: numeric("total_credit", { precision: 15, scale: 2 }).notNull().default("0"),
  isValidated: boolean("is_validated").notNull().default(false),
  validatedAt: timestamp("validated_at"),
  validatedBy: integer("validated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const accountingLines = pgTable("accounting_lines", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").references(() => accountingEntries.id, { onDelete: "cascade" }).notNull(),
  accountCode: text("account_code").notNull(),
  accountLabel: text("account_label").notNull(),
  description: text("description"),
  debit: numeric("debit", { precision: 15, scale: 2 }).notNull().default("0"),
  credit: numeric("credit", { precision: 15, scale: 2 }).notNull().default("0"),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }),
  vatAmount: numeric("vat_amount", { precision: 15, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const journalEntries = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  date: timestamp("date").notNull().defaultNow(),
  reference: text("reference").notNull(),
  description: text("description").notNull(),
  debitAccountId: integer("debit_account_id").references(() => accounts.id),
  creditAccountId: integer("credit_account_id").references(() => accounts.id),
  debitAccountCode: text("debit_account_code").notNull(),
  creditAccountCode: text("credit_account_code").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  entityType: text("entity_type"), // invoice | payment | expense | manual
  entityId: integer("entity_id"),
  applicationId: integer("application_id").references(() => applications.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── SERVICES (SaaS Subscriptions) ───────────────────────────────────────────
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  category: text("category").notNull(),
  billingType: text("billing_type").notNull(),
  cost: numeric("cost", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  nextBillingDate: timestamp("next_billing_date").notNull(),
  status: text("status").notNull().default("active"),
  isGlobal: boolean("is_global").notNull().default(false),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  applicationId: integer("application_id").references(() => applications.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── USER → APPLICATION LINKS (Admin multi-tenant) ───────────────────────────
export const userApplications = pgTable("user_applications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  applicationId: integer("application_id").references(() => applications.id, { onDelete: "cascade" }).notNull(),
});

// ─── REMINDER SETTINGS ────────────────────────────────────────────────────────
export const reminderSettings = pgTable("reminder_settings", {
  id: serial("id").primaryKey(),
  daysBefore: integer("days_before").notNull().default(7),
  enabled: boolean("enabled").notNull().default(true),
  emailSender: text("email_sender").notNull(),
  applicationId: integer("application_id").references(() => applications.id).unique(),
});

// ─── PLAID ITEMS (Open Banking) ───────────────────────────────────────────────
export const plaidItems = pgTable("plaid_items", {
  id: serial("id").primaryKey(),
  itemId: text("item_id").notNull(),
  accessToken: text("access_token").notNull(),
  institutionId: text("institution_id"),
  institutionName: text("institution_name"),
  applicationId: integer("application_id").references(() => applications.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── EXPENSE CATEGORIES (Dynamic) ────────────────────────────────────────────
export const expenseCategories = pgTable("expense_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon"),
  color: text("color"),
  applicationId: integer("application_id").references(() => applications.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── AUDIT LOGS ───────────────────────────────────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  userId: integer("user_id").references(() => users.id),
  entity: text("entity").notNull(),
  entityId: integer("entity_id").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

// ─── RELATIONS ────────────────────────────────────────────────────────────────
export const applicationsRelations = relations(applications, ({ many, one }) => ({
  users: many(users),
  services: many(services),
  reminderSettings: one(reminderSettings),
  accounts: many(accounts),
  clients: many(clients),
  suppliers: many(suppliers),
  invoices: many(invoices),
  expenses: many(expenses),
  payments: many(payments),
  journalEntries: many(journalEntries),
}));

export const invoicesRelations = relations(invoices, ({ many, one }) => ({
  items: many(invoiceItems),
  creditNotes: many(creditNotes),
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
}));

// ─── API GATEWAY ─────────────────────────────────────────────────────────────
export const apiPlans = pgTable("api_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  requestsPerDay: integer("requests_per_day").notNull().default(1000),
  requestsPerMonth: integer("requests_per_month").notNull().default(30000),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  features: text("features"), // JSON array
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const apiClients = pgTable("api_clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  companyName: text("company_name"),
  planId: integer("plan_id").references(() => apiPlans.id),
  status: text("status").notNull().default("active"), // active | suspended | pending
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => apiClients.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(), // shown: sk_test_xxxxxxxx
  environment: text("environment").notNull().default("test"), // test | prod
  lastUsedAt: timestamp("last_used_at"),
  requestCount: integer("request_count").notNull().default(0),
  status: text("status").notNull().default("active"), // active | revoked
  createdAt: timestamp("created_at").defaultNow(),
});

export const apiUsage = pgTable("api_usage", {
  id: serial("id").primaryKey(),
  apiKeyId: integer("api_key_id").references(() => apiKeys.id).notNull(),
  clientId: integer("client_id").references(() => apiClients.id).notNull(),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  statusCode: integer("status_code").notNull(),
  responseTimeMs: integer("response_time_ms"),
  environment: text("environment").notNull().default("test"),
  timestamp: timestamp("timestamp").defaultNow(),
}, (t) => [index("api_usage_client_idx").on(t.clientId), index("api_usage_ts_idx").on(t.timestamp)]);

// ─── INSERT SCHEMAS ───────────────────────────────────────────────────────────
export const insertAccountingEntrySchema = createInsertSchema(accountingEntries).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  date: z.coerce.date(),
  validatedAt: z.coerce.date().optional().nullable(),
});
export const insertAccountingLineSchema = createInsertSchema(accountingLines).omit({ id: true, createdAt: true });
export const insertCreditNoteItemSchema = createInsertSchema(creditNoteItems).omit({ id: true });

export const insertUserApplicationSchema = createInsertSchema(userApplications).omit({ id: true });
export const insertApplicationSchema = createInsertSchema(applications).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true, createdAt: true }).extend({
  nextBillingDate: z.coerce.date(),
});
export const insertReminderSettingsSchema = createInsertSchema(reminderSettings).omit({ id: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, timestamp: true });
export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true, createdAt: true });
export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true, createdAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true }).extend({
  issuedDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  paidDate: z.coerce.date().optional().nullable(),
  recurrenceEndDate: z.coerce.date().optional().nullable(),
  nextOccurrenceDate: z.coerce.date().optional().nullable(),
});
export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({ id: true });
export const insertSupplierInvoiceSchema = createInsertSchema(supplierInvoices).omit({ id: true, createdAt: true }).extend({
  issuedDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  paidDate: z.coerce.date().optional().nullable(),
});
export const insertCreditNoteSchema = createInsertSchema(creditNotes).omit({ id: true, createdAt: true }).extend({
  date: z.coerce.date(),
});
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true }).extend({
  date: z.coerce.date(),
  dueDate: z.coerce.date().optional().nullable(),
  recurrenceEndDate: z.coerce.date().optional().nullable(),
  nextOccurrenceDate: z.coerce.date().optional().nullable(),
});
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true }).extend({
  date: z.coerce.date(),
});
export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({ id: true, createdAt: true }).extend({
  date: z.coerce.date(),
});
export const insertPlaidItemSchema = createInsertSchema(plaidItems).omit({ id: true, createdAt: true });
export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).omit({ id: true, createdAt: true });

// ─── TYPES ────────────────────────────────────────────────────────────────────
export type UserApplication = typeof userApplications.$inferSelect;
export type InsertUserApplication = typeof insertUserApplicationSchema._type;
export type Application = typeof applications.$inferSelect;
export type User = typeof users.$inferSelect;
export type Service = typeof services.$inferSelect;
export type ReminderSettings = typeof reminderSettings.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type SupplierInvoice = typeof supplierInvoices.$inferSelect;
export type CreditNote = typeof creditNotes.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type PlaidItem = typeof plaidItems.$inferSelect;
export type InsertPlaidItem = typeof insertPlaidItemSchema._type;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type InsertExpenseCategory = typeof insertExpenseCategorySchema._type;

export type InsertApplication = typeof insertApplicationSchema._type;
export type InsertUser = typeof insertUserSchema._type;
export type InsertService = typeof insertServiceSchema._type;
export type InsertReminderSettings = typeof insertReminderSettingsSchema._type;
export type InsertAuditLog = typeof insertAuditLogSchema._type;
export type InsertAccount = typeof insertAccountSchema._type;
export type InsertClient = typeof insertClientSchema._type;
export type InsertSupplier = typeof insertSupplierSchema._type;
export type InsertInvoice = typeof insertInvoiceSchema._type;
export type InsertInvoiceItem = typeof insertInvoiceItemSchema._type;
export type InsertSupplierInvoice = typeof insertSupplierInvoiceSchema._type;
export type InsertCreditNote = typeof insertCreditNoteSchema._type;
export type InsertExpense = typeof insertExpenseSchema._type;
export type InsertPayment = typeof insertPaymentSchema._type;
export type InsertJournalEntry = typeof insertJournalEntrySchema._type;

export type AccountingEntry = typeof accountingEntries.$inferSelect;
export type AccountingLine = typeof accountingLines.$inferSelect;
export type CreditNoteItem = typeof creditNoteItems.$inferSelect;
export type InsertAccountingEntry = typeof insertAccountingEntrySchema._type;
export type InsertAccountingLine = typeof insertAccountingLineSchema._type;
export type InsertCreditNoteItem = typeof insertCreditNoteItemSchema._type;

export const insertApiPlanSchema = createInsertSchema(apiPlans).omit({ id: true, createdAt: true });
export const insertApiClientSchema = createInsertSchema(apiClients).omit({ id: true, createdAt: true });
export const insertApiKeySchema = createInsertSchema(apiKeys).omit({ id: true, createdAt: true, lastUsedAt: true, requestCount: true });
export const insertApiUsageSchema = createInsertSchema(apiUsage).omit({ id: true, timestamp: true });

export type ApiPlan = typeof apiPlans.$inferSelect;
export type ApiClient = typeof apiClients.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type ApiUsage = typeof apiUsage.$inferSelect;
export type InsertApiPlan = typeof insertApiPlanSchema._type;
export type InsertApiClient = typeof insertApiClientSchema._type;
export type InsertApiKey = typeof insertApiKeySchema._type;

// ─── PASSWORD RESET TOKENS ───────────────────────────────────────────────────
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── BANK ACCOUNTS (Stripe Financial Connections) ────────────────────────────
export const bankAccounts = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  stripeAccountId: text("stripe_account_id").notNull().unique(),
  institutionName: text("institution_name"),
  displayName: text("display_name"),
  last4: text("last4"),
  currency: text("currency").default("EUR"),
  status: text("status").default("active"),
  balance: integer("balance"),
  balanceUpdatedAt: timestamp("balance_updated_at"),
  stripeCustomerId: text("stripe_customer_id"),
  applicationId: integer("application_id").references(() => applications.id),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bankTransactions = pgTable("bank_transactions", {
  id: serial("id").primaryKey(),
  bankAccountId: integer("bank_account_id").references(() => bankAccounts.id),
  stripeTransactionId: text("stripe_transaction_id").notNull().unique(),
  amount: integer("amount").notNull(),         // TTC en centimes
  netAmount: integer("net_amount"),            // HT en centimes
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }),   // ex: 20.00, 10.00, 5.50, 2.10
  vatAmount: integer("vat_amount"),            // TVA en centimes
  importSource: text("import_source"),         // "stripe", "bridge", "csv", "pdf"
  currency: text("currency").default("EUR"),
  description: text("description"),
  transactedAt: timestamp("transacted_at"),
  status: text("status").default("posted"),
  category: text("category"),
  attachmentPath: text("attachment_path"),     // chemin fichier upload
  attachmentName: text("attachment_name"),     // nom original
  validated: boolean("validated").default(false),
  accountingEntryId: integer("accounting_entry_id"),
  applicationId: integer("application_id").references(() => applications.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({ id: true, createdAt: true });
export const insertBankAccountSchema = createInsertSchema(bankAccounts).omit({ id: true, createdAt: true });
export const insertBankTransactionSchema = createInsertSchema(bankTransactions).omit({ id: true, createdAt: true });
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type BankAccount = typeof bankAccounts.$inferSelect;
export type InsertBankAccount = typeof insertBankAccountSchema._type;
export type BankTransaction = typeof bankTransactions.$inferSelect;
export type InsertBankTransaction = typeof insertBankTransactionSchema._type;

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  applicationId: z.coerce.number().optional(),
});
