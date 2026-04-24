import { db } from "./db";
import {
  users, applications, services, reminderSettings, auditLogs,
  accounts, clients, suppliers, invoices, invoiceItems, supplierInvoices,
  creditNotes, creditNoteItems, expenses, payments, journalEntries, userApplications, plaidItems,
  expenseCategories, passwordResetTokens, bankAccounts,
  accountingEntries, accountingLines,
  type User, type InsertUser,
  type Application, type InsertApplication,
  type Service, type InsertService,
  type ReminderSettings, type InsertReminderSettings,
  type AuditLog, type InsertAuditLog,
  type Account, type InsertAccount,
  type Client, type InsertClient,
  type Supplier, type InsertSupplier,
  type Invoice, type InsertInvoice,
  type InvoiceItem, type InsertInvoiceItem,
  type SupplierInvoice, type InsertSupplierInvoice,
  type CreditNote, type InsertCreditNote,
  type CreditNoteItem, type InsertCreditNoteItem,
  type Expense, type InsertExpense,
  type Payment, type InsertPayment,
  type JournalEntry, type InsertJournalEntry,
  type UserApplication,
  type PlaidItem, type InsertPlaidItem,
  type ExpenseCategory, type InsertExpenseCategory,
  type PasswordResetToken, type BankAccount, type InsertBankAccount,
  type BankTransaction, type InsertBankTransaction,
  type AccountingEntry, type InsertAccountingEntry,
  type AccountingLine, type InsertAccountingLine,
  bankTransactions,
} from "@shared/schema";
import { eq, and, desc, sql, gt, gte, lte } from "drizzle-orm";

export interface IStorage {
  getBankTransaction(id: number): Promise<BankTransaction | undefined>;
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByApp(appId: number): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;
  deleteUser(id: number): Promise<void>;

  // User ↔ Application links (multi-tenant admin)
  getUserApplications(userId: number): Promise<UserApplication[]>;
  addUserApplication(userId: number, applicationId: number): Promise<UserApplication>;
  removeUserApplication(userId: number, applicationId: number): Promise<void>;

  // Applications
  getApplications(): Promise<Application[]>;
  getApplication(id: number): Promise<Application | undefined>;
  createApplication(app: InsertApplication): Promise<Application>;
  updateApplication(id: number, app: Partial<InsertApplication>): Promise<Application>;

  // Services
  getServices(appId?: number, isGlobal?: boolean): Promise<Service[]>;
  getService(id: number): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, service: Partial<InsertService>): Promise<Service>;
  deleteService(id: number): Promise<void>;

  // Reminders
  getReminderSettings(appId: number): Promise<ReminderSettings | undefined>;
  upsertReminderSettings(appId: number, settings: Partial<InsertReminderSettings>): Promise<ReminderSettings>;
  getAllReminderSettings(): Promise<ReminderSettings[]>;

  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  // Accounts (Plan Comptable)
  getAccounts(appId: number): Promise<Account[]>;
  getAccount(id: number): Promise<Account | undefined>;
  createAccount(account: InsertAccount): Promise<Account>;
  updateAccount(id: number, account: Partial<InsertAccount>): Promise<Account>;
  deleteAccount(id: number): Promise<void>;

  // Clients
  getClients(appId: number): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>): Promise<Client>;
  deleteClient(id: number): Promise<void>;

  // Suppliers
  getSuppliers(appId: number): Promise<Supplier[]>;
  getSupplier(id: number): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier>;
  deleteSupplier(id: number): Promise<void>;

  // Invoices
  getInvoices(appId: number): Promise<Invoice[]>;
  getInvoice(id: number): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice>;
  deleteInvoice(id: number): Promise<void>;

  // Invoice Items
  getInvoiceItems(invoiceId: number): Promise<InvoiceItem[]>;
  createInvoiceItem(item: InsertInvoiceItem): Promise<InvoiceItem>;
  deleteInvoiceItems(invoiceId: number): Promise<void>;

  // Supplier Invoices
  getSupplierInvoices(appId: number): Promise<SupplierInvoice[]>;
  getSupplierInvoice(id: number): Promise<SupplierInvoice | undefined>;
  createSupplierInvoice(inv: InsertSupplierInvoice): Promise<SupplierInvoice>;
  updateSupplierInvoice(id: number, inv: Partial<InsertSupplierInvoice>): Promise<SupplierInvoice>;
  deleteSupplierInvoice(id: number): Promise<void>;

  // Credit Notes
  getCreditNotes(appId: number): Promise<CreditNote[]>;
  getCreditNote(id: number): Promise<CreditNote | undefined>;
  createCreditNote(note: InsertCreditNote): Promise<CreditNote>;
  updateCreditNote(id: number, note: Partial<InsertCreditNote>): Promise<CreditNote>;
  deleteCreditNote(id: number): Promise<void>;

  // Expenses
  getExpenses(appId: number): Promise<Expense[]>;
  getExpense(id: number): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: number, expense: Partial<InsertExpense>): Promise<Expense>;
  deleteExpense(id: number): Promise<void>;

  // Payments
  getPayments(appId: number): Promise<Payment[]>;
  getPayment(id: number): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: number, payment: Partial<InsertPayment>): Promise<Payment>;
  deletePayment(id: number): Promise<void>;

  // Journal Entries
  getJournalEntries(appId: number): Promise<JournalEntry[]>;
  getJournalEntry(id: number): Promise<JournalEntry | undefined>;
  createJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry>;
  updateJournalEntry(id: number, entry: Partial<InsertJournalEntry>): Promise<JournalEntry>;
  deleteJournalEntry(id: number): Promise<void>;

  // Plaid Items (Open Banking)
  getPlaidItems(appId: number): Promise<PlaidItem[]>;
  getPlaidItem(id: number): Promise<PlaidItem | undefined>;
  createPlaidItem(item: InsertPlaidItem): Promise<PlaidItem>;
  deletePlaidItem(id: number): Promise<void>;

  // Expense Categories
  getExpenseCategories(appId: number): Promise<ExpenseCategory[]>;
  createExpenseCategory(cat: InsertExpenseCategory): Promise<ExpenseCategory>;
  deleteExpenseCategory(id: number): Promise<void>;

  // Password Reset
  createPasswordResetToken(email: string, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: number): Promise<void>;

  // Bank Accounts (Stripe Financial Connections)
  getBankAccounts(appId: number): Promise<BankAccount[]>;
  getBankAccount(id: number): Promise<BankAccount | undefined>;
  getBankAccountByStripeId(stripeId: string): Promise<BankAccount | undefined>;
  createBankAccount(account: InsertBankAccount): Promise<BankAccount>;
  updateBankAccount(id: number, updates: Partial<InsertBankAccount>): Promise<BankAccount>;
  deleteBankAccount(id: number): Promise<void>;

  // Bank Transactions
  getBankTransactions(bankAccountId: number): Promise<BankTransaction[]>;
  getBankTransactionsByApp(appId: number): Promise<BankTransaction[]>;
  upsertBankTransaction(tx: InsertBankTransaction): Promise<BankTransaction>;
  updateBankTransaction(id: number, updates: Partial<InsertBankTransaction>): Promise<BankTransaction>;
  deleteBankTransactionsByAccount(bankAccountId: number): Promise<void>;

  // Accounting Entries
  getAccountingEntries(applicationId?: number | null, filters?: { journal?: string; validated?: boolean; from?: Date; to?: Date }): Promise<AccountingEntry[]>;
  getAccountingEntry(id: number): Promise<AccountingEntry | undefined>;
  getAccountingLines(entryId: number): Promise<AccountingLine[]>;
  createAccountingEntry(data: InsertAccountingEntry, lines: InsertAccountingLine[]): Promise<AccountingEntry>;
  updateAccountingEntry(id: number, data: Partial<InsertAccountingEntry>): Promise<AccountingEntry | undefined>;
  validateAccountingEntry(id: number, userId: number): Promise<AccountingEntry | undefined>;
  deleteAccountingEntry(id: number): Promise<void>;

  // Credit Note Items
  getCreditNoteItems(creditNoteId: number): Promise<CreditNoteItem[]>;
  createCreditNoteItem(data: InsertCreditNoteItem): Promise<CreditNoteItem>;
  deleteCreditNoteItems(creditNoteId: number): Promise<void>;

  // Global stats for ROOT_ADMIN
  getGlobalStats(): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // ─── Users ────────────────────────────────────────────────────────────────
  async getUser(id: number) { const [u] = await db.select().from(users).where(eq(users.id, id)); return u; }
  async getUserByEmail(email: string) { const [u] = await db.select().from(users).where(eq(users.email, email)); return u; }
  async getUsersByApp(appId: number) { return db.select().from(users).where(eq(users.applicationId, appId)); }
  async createUser(user: InsertUser) { const [u] = await db.insert(users).values(user).returning(); return u; }
  async updateUser(id: number, updates: Partial<InsertUser>) { const [u] = await db.update(users).set(updates).where(eq(users.id, id)).returning(); return u; }
  async deleteUser(id: number) { await db.delete(users).where(eq(users.id, id)); }

  // ─── User ↔ Application links ─────────────────────────────────────────────
  async getUserApplications(userId: number) { return db.select().from(userApplications).where(eq(userApplications.userId, userId)); }
  async addUserApplication(userId: number, applicationId: number) {
    const existing = await db.select().from(userApplications).where(and(eq(userApplications.userId, userId), eq(userApplications.applicationId, applicationId)));
    if (existing.length > 0) return existing[0];
    const [r] = await db.insert(userApplications).values({ userId, applicationId }).returning();
    return r;
  }
  async removeUserApplication(userId: number, applicationId: number) {
    await db.delete(userApplications).where(and(eq(userApplications.userId, userId), eq(userApplications.applicationId, applicationId)));
  }

  // ─── Applications ─────────────────────────────────────────────────────────
  async getApplications() { return db.select().from(applications); }
  async getApplication(id: number) { const [a] = await db.select().from(applications).where(eq(applications.id, id)); return a; }
  async createApplication(app: InsertApplication) { const [a] = await db.insert(applications).values(app).returning(); return a; }
  async updateApplication(id: number, app: Partial<InsertApplication>) { const [a] = await db.update(applications).set(app).where(eq(applications.id, id)).returning(); return a; }

  // ─── Services ─────────────────────────────────────────────────────────────
  async getServices(appId?: number, isGlobal?: boolean) {
    let query = db.select().from(services).$dynamic();
    if (isGlobal !== undefined && appId !== undefined) query = query.where(and(eq(services.isGlobal, isGlobal), eq(services.applicationId, appId)));
    else if (isGlobal !== undefined) query = query.where(eq(services.isGlobal, isGlobal));
    else if (appId !== undefined) query = query.where(eq(services.applicationId, appId));
    return query;
  }
  async getService(id: number) { const [s] = await db.select().from(services).where(eq(services.id, id)); return s; }
  async createService(service: InsertService) { const [s] = await db.insert(services).values(service).returning(); return s; }
  async updateService(id: number, updates: Partial<InsertService>) { const [s] = await db.update(services).set(updates).where(eq(services.id, id)).returning(); return s; }
  async deleteService(id: number) { await db.delete(services).where(eq(services.id, id)); }

  // ─── Reminders ────────────────────────────────────────────────────────────
  async getReminderSettings(appId: number) { const [r] = await db.select().from(reminderSettings).where(eq(reminderSettings.applicationId, appId)); return r; }
  async upsertReminderSettings(appId: number, settings: Partial<InsertReminderSettings>) {
    const [existing] = await db.select().from(reminderSettings).where(eq(reminderSettings.applicationId, appId));
    if (existing) { const [u] = await db.update(reminderSettings).set(settings).where(eq(reminderSettings.applicationId, appId)).returning(); return u; }
    const [c] = await db.insert(reminderSettings).values({ ...settings, applicationId: appId } as InsertReminderSettings).returning(); return c;
  }
  async getAllReminderSettings() { return db.select().from(reminderSettings); }

  // ─── Audit ────────────────────────────────────────────────────────────────
  async createAuditLog(log: InsertAuditLog) { const [l] = await db.insert(auditLogs).values(log).returning(); return l; }

  // ─── Accounts ─────────────────────────────────────────────────────────────
  async getAccounts(appId: number) { return db.select().from(accounts).where(eq(accounts.applicationId, appId)).orderBy(accounts.code); }
  async getAccount(id: number) { const [a] = await db.select().from(accounts).where(eq(accounts.id, id)); return a; }
  async createAccount(account: InsertAccount) { const [a] = await db.insert(accounts).values(account).returning(); return a; }
  async updateAccount(id: number, account: Partial<InsertAccount>) { const [a] = await db.update(accounts).set(account).where(eq(accounts.id, id)).returning(); return a; }
  async deleteAccount(id: number) { await db.delete(accounts).where(eq(accounts.id, id)); }

  // ─── Clients ──────────────────────────────────────────────────────────────
  async getClients(appId: number) { return db.select().from(clients).where(eq(clients.applicationId, appId)).orderBy(clients.name); }
  async getClient(id: number) { const [c] = await db.select().from(clients).where(eq(clients.id, id)); return c; }
  async createClient(client: InsertClient) { const [c] = await db.insert(clients).values(client).returning(); return c; }
  async updateClient(id: number, client: Partial<InsertClient>) { const [c] = await db.update(clients).set(client).where(eq(clients.id, id)).returning(); return c; }
  async deleteClient(id: number) { await db.delete(clients).where(eq(clients.id, id)); }

  // ─── Suppliers ────────────────────────────────────────────────────────────
  async getSuppliers(appId: number) { return db.select().from(suppliers).where(eq(suppliers.applicationId, appId)).orderBy(suppliers.name); }
  async getSupplier(id: number) { const [s] = await db.select().from(suppliers).where(eq(suppliers.id, id)); return s; }
  async createSupplier(supplier: InsertSupplier) { const [s] = await db.insert(suppliers).values(supplier).returning(); return s; }
  async updateSupplier(id: number, supplier: Partial<InsertSupplier>) { const [s] = await db.update(suppliers).set(supplier).where(eq(suppliers.id, id)).returning(); return s; }
  async deleteSupplier(id: number) { await db.delete(suppliers).where(eq(suppliers.id, id)); }

  // ─── Invoices ─────────────────────────────────────────────────────────────
  async getInvoices(appId: number) { return db.select().from(invoices).where(eq(invoices.applicationId, appId)).orderBy(desc(invoices.createdAt)); }
  async getInvoice(id: number) { const [i] = await db.select().from(invoices).where(eq(invoices.id, id)); return i; }
  async createInvoice(invoice: InsertInvoice) { const [i] = await db.insert(invoices).values(invoice).returning(); return i; }
  async updateInvoice(id: number, invoice: Partial<InsertInvoice>) { const [i] = await db.update(invoices).set(invoice).where(eq(invoices.id, id)).returning(); return i; }
  async deleteInvoice(id: number) { await db.delete(invoices).where(eq(invoices.id, id)); }

  // ─── Invoice Items ────────────────────────────────────────────────────────
  async getInvoiceItems(invoiceId: number) { return db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId)); }
  async createInvoiceItem(item: InsertInvoiceItem) { const [i] = await db.insert(invoiceItems).values(item).returning(); return i; }
  async deleteInvoiceItems(invoiceId: number) { await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId)); }

  // ─── Supplier Invoices ────────────────────────────────────────────────────
  async getSupplierInvoices(appId: number) { return db.select().from(supplierInvoices).where(eq(supplierInvoices.applicationId, appId)).orderBy(desc(supplierInvoices.createdAt)); }
  async getSupplierInvoice(id: number) { const [i] = await db.select().from(supplierInvoices).where(eq(supplierInvoices.id, id)); return i; }
  async createSupplierInvoice(inv: InsertSupplierInvoice) { const [i] = await db.insert(supplierInvoices).values(inv).returning(); return i; }
  async updateSupplierInvoice(id: number, inv: Partial<InsertSupplierInvoice>) { const [i] = await db.update(supplierInvoices).set(inv).where(eq(supplierInvoices.id, id)).returning(); return i; }
  async deleteSupplierInvoice(id: number) { await db.delete(supplierInvoices).where(eq(supplierInvoices.id, id)); }

  // ─── Credit Notes ─────────────────────────────────────────────────────────
  async getCreditNotes(appId: number) { return db.select().from(creditNotes).where(eq(creditNotes.applicationId, appId)).orderBy(desc(creditNotes.createdAt)); }
  async getCreditNote(id: number) { const [c] = await db.select().from(creditNotes).where(eq(creditNotes.id, id)); return c; }
  async createCreditNote(note: InsertCreditNote) { const [c] = await db.insert(creditNotes).values(note).returning(); return c; }
  async updateCreditNote(id: number, note: Partial<InsertCreditNote>) { const [c] = await db.update(creditNotes).set(note).where(eq(creditNotes.id, id)).returning(); return c; }
  async deleteCreditNote(id: number) { await db.delete(creditNotes).where(eq(creditNotes.id, id)); }

  // ─── Expenses ─────────────────────────────────────────────────────────────
  async getExpenses(appId: number) { return db.select().from(expenses).where(eq(expenses.applicationId, appId)).orderBy(desc(expenses.createdAt)); }
  async getExpense(id: number) { const [e] = await db.select().from(expenses).where(eq(expenses.id, id)); return e; }
  async createExpense(expense: InsertExpense) { const [e] = await db.insert(expenses).values(expense).returning(); return e; }
  async updateExpense(id: number, expense: Partial<InsertExpense>) { const [e] = await db.update(expenses).set(expense).where(eq(expenses.id, id)).returning(); return e; }
  async deleteExpense(id: number) { await db.delete(expenses).where(eq(expenses.id, id)); }

  // ─── Payments ─────────────────────────────────────────────────────────────
  async getPayments(appId: number) { return db.select().from(payments).where(eq(payments.applicationId, appId)).orderBy(desc(payments.createdAt)); }
  async getPayment(id: number) { const [p] = await db.select().from(payments).where(eq(payments.id, id)); return p; }
  async createPayment(payment: InsertPayment) { const [p] = await db.insert(payments).values(payment).returning(); return p; }
  async updatePayment(id: number, payment: Partial<InsertPayment>) { const [p] = await db.update(payments).set(payment).where(eq(payments.id, id)).returning(); return p; }
  async deletePayment(id: number) { await db.delete(payments).where(eq(payments.id, id)); }

  // ─── Journal Entries ──────────────────────────────────────────────────────
  async getJournalEntries(appId: number) { return db.select().from(journalEntries).where(eq(journalEntries.applicationId, appId)).orderBy(desc(journalEntries.date)); }
  async getJournalEntry(id: number) { const [j] = await db.select().from(journalEntries).where(eq(journalEntries.id, id)); return j; }
  async createJournalEntry(entry: InsertJournalEntry) { const [j] = await db.insert(journalEntries).values(entry).returning(); return j; }
  async updateJournalEntry(id: number, entry: Partial<InsertJournalEntry>) { const [j] = await db.update(journalEntries).set(entry).where(eq(journalEntries.id, id)).returning(); return j; }
  async deleteJournalEntry(id: number) { await db.delete(journalEntries).where(eq(journalEntries.id, id)); }

  // ─── Plaid Items ──────────────────────────────────────────────────────────
  async getPlaidItems(appId: number) { return db.select().from(plaidItems).where(eq(plaidItems.applicationId, appId)).orderBy(desc(plaidItems.createdAt)); }
  async getPlaidItem(id: number) { const [p] = await db.select().from(plaidItems).where(eq(plaidItems.id, id)); return p; }
  async createPlaidItem(item: InsertPlaidItem) { const [p] = await db.insert(plaidItems).values(item).returning(); return p; }
  async deletePlaidItem(id: number) { await db.delete(plaidItems).where(eq(plaidItems.id, id)); }

  // ─── Expense Categories ──────────────────────────────────────────────────
  async getExpenseCategories(appId: number) { return db.select().from(expenseCategories).where(eq(expenseCategories.applicationId, appId)).orderBy(expenseCategories.name); }
  async createExpenseCategory(cat: InsertExpenseCategory) { const [c] = await db.insert(expenseCategories).values(cat).returning(); return c; }
  async deleteExpenseCategory(id: number) { await db.delete(expenseCategories).where(eq(expenseCategories.id, id)); }

  // ─── Password Reset ────────────────────────────────────────────────────────
  async createPasswordResetToken(email: string, token: string, expiresAt: Date) {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.email, email));
    const [r] = await db.insert(passwordResetTokens).values({ email, token, expiresAt, used: false }).returning();
    return r;
  }
  async getPasswordResetToken(token: string) {
    const [r] = await db.select().from(passwordResetTokens).where(and(eq(passwordResetTokens.token, token), eq(passwordResetTokens.used, false), gt(passwordResetTokens.expiresAt, new Date())));
    return r;
  }
  async markPasswordResetTokenUsed(id: number) { await db.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.id, id)); }

  // ─── Bank Accounts (Stripe Financial Connections) ─────────────────────────
  async getBankTransaction(id: number) { const [t] = await db.select().from(bankTransactions).where(eq(bankTransactions.id, id)); return t; }

  async getBankAccounts(appId: number) { return db.select().from(bankAccounts).where(eq(bankAccounts.applicationId, appId)).orderBy(desc(bankAccounts.createdAt)); }
  async getBankAccount(id: number) { const [b] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, id)); return b; }
  async getBankAccountByStripeId(stripeId: string) { const [b] = await db.select().from(bankAccounts).where(eq(bankAccounts.stripeAccountId, stripeId)); return b; }
  async createBankAccount(account: InsertBankAccount) { const [b] = await db.insert(bankAccounts).values(account).returning(); return b; }
  async updateBankAccount(id: number, updates: Partial<InsertBankAccount>) { const [b] = await db.update(bankAccounts).set(updates).where(eq(bankAccounts.id, id)).returning(); return b; }
  async deleteBankAccount(id: number) { await db.delete(bankAccounts).where(eq(bankAccounts.id, id)); }

  // ─── Bank Transactions ─────────────────────────────────────────────────────
  async getBankTransactions(bankAccountId: number) { return db.select().from(bankTransactions).where(eq(bankTransactions.bankAccountId, bankAccountId)).orderBy(desc(bankTransactions.transactedAt)); }
  async getBankTransactionsByApp(appId: number) { return db.select().from(bankTransactions).where(eq(bankTransactions.applicationId, appId)).orderBy(desc(bankTransactions.transactedAt)); }
  async upsertBankTransaction(tx: InsertBankTransaction) {
    const [result] = await db.insert(bankTransactions).values(tx)
      .onConflictDoUpdate({ target: bankTransactions.stripeTransactionId, set: { amount: tx.amount, status: tx.status, description: tx.description } })
      .returning();
    return result;
  }
  async updateBankTransaction(id: number, updates: Partial<InsertBankTransaction>) {
    const [result] = await db.update(bankTransactions).set(updates).where(eq(bankTransactions.id, id)).returning();
    return result;
  }
  async deleteBankTransactionsByAccount(bankAccountId: number) { await db.delete(bankTransactions).where(eq(bankTransactions.bankAccountId, bankAccountId)); }

  // ─── ACCOUNTING ENTRIES ────────────────────────────────────────────────────
  async getAccountingEntries(applicationId?: number | null, filters?: { journal?: string; validated?: boolean; from?: Date; to?: Date }) {
    const conds: any[] = [];
    if (applicationId) conds.push(eq(accountingEntries.applicationId, applicationId));
    if (filters?.journal) conds.push(eq(accountingEntries.journal, filters.journal));
    if (filters?.validated !== undefined) conds.push(eq(accountingEntries.isValidated, filters.validated));
    if (filters?.from) conds.push(gte(accountingEntries.date, filters.from));
    if (filters?.to) conds.push(lte(accountingEntries.date, filters.to));
    return db.select().from(accountingEntries).where(conds.length ? and(...conds) : undefined).orderBy(desc(accountingEntries.date));
  }
  async getAccountingEntry(id: number): Promise<AccountingEntry | undefined> {
    const [e] = await db.select().from(accountingEntries).where(eq(accountingEntries.id, id));
    return e;
  }
  async getAccountingLines(entryId: number): Promise<AccountingLine[]> {
    return db.select().from(accountingLines).where(eq(accountingLines.entryId, entryId));
  }
  async createAccountingEntry(data: InsertAccountingEntry, lines: InsertAccountingLine[]): Promise<AccountingEntry> {
    const [entry] = await db.insert(accountingEntries).values(data).returning();
    if (lines.length) {
      await db.insert(accountingLines).values(lines.map(l => ({ ...l, entryId: entry.id })));
    }
    return entry;
  }
  async updateAccountingEntry(id: number, data: Partial<InsertAccountingEntry>): Promise<AccountingEntry | undefined> {
    const [e] = await db.update(accountingEntries).set({ ...data, updatedAt: new Date() }).where(eq(accountingEntries.id, id)).returning();
    return e;
  }
  async validateAccountingEntry(id: number, userId: number): Promise<AccountingEntry | undefined> {
    const [e] = await db.update(accountingEntries).set({ isValidated: true, validatedAt: new Date(), validatedBy: userId, updatedAt: new Date() }).where(eq(accountingEntries.id, id)).returning();
    return e;
  }
  async deleteAccountingEntry(id: number): Promise<void> {
    await db.delete(accountingEntries).where(eq(accountingEntries.id, id));
  }

  // ─── CREDIT NOTE ITEMS ─────────────────────────────────────────────────────
  async getCreditNoteItems(creditNoteId: number): Promise<CreditNoteItem[]> {
    return db.select().from(creditNoteItems).where(eq(creditNoteItems.creditNoteId, creditNoteId));
  }
  async createCreditNoteItem(data: InsertCreditNoteItem): Promise<CreditNoteItem> {
    const [item] = await db.insert(creditNoteItems).values(data).returning();
    return item;
  }
  async deleteCreditNoteItems(creditNoteId: number): Promise<void> {
    await db.delete(creditNoteItems).where(eq(creditNoteItems.creditNoteId, creditNoteId));
  }

  // ─── Global Stats (ROOT_ADMIN) ─────────────────────────────────────────────
  async getGlobalStats() {
    const [apps] = await db.select({ count: sql<number>`count(*)` }).from(applications);
    const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [totalRevenue] = await db.select({ sum: sql<string>`coalesce(sum(total),0)` }).from(invoices).where(eq(invoices.status, "paid"));
    const [totalExpenses] = await db.select({ sum: sql<string>`coalesce(sum(total),0)` }).from(expenses);
    const allApps = await db.select().from(applications);
    const appsStats = await Promise.all(allApps.map(async (app) => {
      const [rev] = await db.select({ sum: sql<string>`coalesce(sum(total),0)` }).from(invoices).where(and(eq(invoices.applicationId, app.id), eq(invoices.status, "paid")));
      const [exp] = await db.select({ sum: sql<string>`coalesce(sum(total),0)` }).from(expenses).where(eq(expenses.applicationId, app.id));
      const [expCount] = await db.select({ count: sql<number>`count(*)` }).from(expenses).where(eq(expenses.applicationId, app.id));
      const [invCount] = await db.select({ count: sql<number>`count(*)` }).from(invoices).where(eq(invoices.applicationId, app.id));
      const [userCnt] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.applicationId, app.id));
      return { app, revenue: parseFloat(rev.sum), expenses: parseFloat(exp.sum), expenseCount: Number(expCount.count), invoiceCount: Number(invCount.count), userCount: Number(userCnt.count) };
    }));
    const recentExpenses = await db.select().from(expenses).orderBy(desc(expenses.createdAt)).limit(10);
    const recentInvoices = await db.select().from(invoices).orderBy(desc(invoices.createdAt)).limit(10);
    return {
      totalApps: Number(apps.count),
      totalUsers: Number(userCount.count),
      totalRevenue: parseFloat(totalRevenue.sum),
      totalExpenses: parseFloat(totalExpenses.sum),
      appsStats,
      recentExpenses,
      recentInvoices,
    };
  }
}

export const storage = new DatabaseStorage();
