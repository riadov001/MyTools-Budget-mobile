# Spécification technique — Module OpenBanking & Comptabilité

> Document de référence pour reproduire l'intégralité du module comptabilité et OpenBanking sur un nouveau projet Replit via agent.

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Variables d'environnement requises](#2-variables-denvironnement-requises)
3. [Schéma de base de données](#3-schéma-de-base-de-données)
4. [Services backend](#4-services-backend)
5. [Routes API](#5-routes-api)
6. [Logique métier automatisée](#6-logique-métier-automatisée)
7. [Pages frontend](#7-pages-frontend)
8. [Composants frontend](#8-composants-frontend)
9. [Export FEC (Conformité française)](#9-export-fec-conformité-française)
10. [Rapport TVA](#10-rapport-tva)
11. [Plan comptable utilisé](#11-plan-comptable-utilisé)
12. [Contrôle d'accès](#12-contrôle-daccès)

---

## 1. Vue d'ensemble

Le module comprend deux grandes parties :

### Comptabilité (accès `superadmin` et `root`)
- **Écritures comptables** : Journal en partie double (sales, purchases, bank, cash, misc)
- **Dépenses** : Saisie des charges avec catégories, numérotation automatique
- **Avoirs** : Avoirs liés aux factures, avec lignes détaillées
- **Rapports** : TVA, Compte de résultat (P&L), Cash Flow, Bilan mensuel
- **Export FEC** : Fichier des Écritures Comptables (norme DGFiP française)
- **E-Invoicing** : Vérification conformité Factur-X / norme 2026
- **Scanner OCR** : Reconnaissance de documents pour créer dépenses/avoirs

### OpenBanking (3 intégrations)
- **Bridge API** : Agrégateur bancaire multi-banques France/Europe
- **Stripe Financial Connections** : Connexion bancaire via Stripe
- **Plaid** : Connexion bancaire via Plaid

---

## 2. Variables d'environnement requises

Configurer via les Secrets Replit :

```
# Bridge API (banque agrégateur)
BRIDGE_CLIENT_ID=votre_client_id
BRIDGE_CLIENT_SECRET=votre_client_secret

# Stripe (pour payments ET Financial Connections)
STRIPE_SECRET_KEY_PROD=sk_live_...
STRIPE_PUBLISHABLE_KEY_PROD=pk_live_...
# OU en développement :
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Plaid
PLAID_CLIENT_ID=votre_client_id
PLAID_SECRET=votre_secret
PLAID_ENV=sandbox   # ou "development" ou "production"

# Email (pour envoi dossier comptable)
RESEND_API_KEY=re_...
```

---

## 3. Schéma de base de données

Ajouter dans `shared/schema.ts` après les tables existantes.

### 3.1 Catégories de dépenses

```typescript
export const expenseCategories = pgTable("expense_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  garageId: varchar("garage_id").references(() => garages.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 20 }),
  description: text("description"),
  defaultTaxRate: decimal("default_tax_rate", { precision: 5, scale: 2 }).default("20.00"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### 3.2 Dépenses

```typescript
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  garageId: varchar("garage_id").references(() => garages.id, { onDelete: 'cascade' }),
  categoryId: varchar("category_id").references(() => expenseCategories.id, { onDelete: 'set null' }),
  expenseNumber: varchar("expense_number", { length: 50 }).notNull().unique(),
  vendor: varchar("vendor", { length: 255 }).notNull(),
  description: text("description"),
  date: timestamp("date").notNull(),
  amountHT: decimal("amount_ht", { precision: 10, scale: 2 }).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull().default("20.00"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  amountTTC: decimal("amount_ttc", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", {
    enum: ["cash", "wire_transfer", "card", "check", "direct_debit"]
  }).notNull().default("wire_transfer"),
  status: varchar("status", {
    enum: ["pending", "paid", "cancelled"]
  }).notNull().default("paid"),
  attachmentPath: varchar("attachment_path", { length: 500 }),
  attachmentName: varchar("attachment_name", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### 3.3 Avoirs (Credit Notes)

```typescript
export const creditNotes = pgTable("credit_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  garageId: varchar("garage_id").references(() => garages.id, { onDelete: 'cascade' }),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  creditNoteNumber: varchar("credit_note_number", { length: 50 }).notNull().unique(),
  reason: text("reason").notNull(),
  totalHT: decimal("total_ht", { precision: 10, scale: 2 }).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull().default("20.00"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull(),
  totalTTC: decimal("total_ttc", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", {
    enum: ["draft", "issued", "refunded", "cancelled"]
  }).notNull().default("draft"),
  issuedAt: timestamp("issued_at"),
  refundedAt: timestamp("refunded_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const creditNoteItems = pgTable("credit_note_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  creditNoteId: varchar("credit_note_id").notNull().references(() => creditNotes.id, { onDelete: 'cascade' }),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPriceHT: decimal("unit_price_ht", { precision: 10, scale: 2 }).notNull(),
  totalHT: decimal("total_ht", { precision: 10, scale: 2 }).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull(),
  totalTTC: decimal("total_ttc", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### 3.4 Écritures comptables

```typescript
export const accountingEntries = pgTable("accounting_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  garageId: varchar("garage_id").references(() => garages.id, { onDelete: 'cascade' }),
  entryNumber: varchar("entry_number", { length: 50 }).notNull().unique(),
  date: timestamp("date").notNull(),
  journal: varchar("journal", {
    enum: ["sales", "purchases", "bank", "cash", "misc"]
  }).notNull(),
  sourceType: varchar("source_type", {
    enum: ["invoice", "expense", "credit_note", "payment", "manual"]
  }).notNull(),
  sourceId: varchar("source_id"),
  description: text("description").notNull(),
  totalDebit: decimal("total_debit", { precision: 10, scale: 2 }).notNull().default("0"),
  totalCredit: decimal("total_credit", { precision: 10, scale: 2 }).notNull().default("0"),
  isValidated: boolean("is_validated").notNull().default(false),
  validatedAt: timestamp("validated_at"),
  validatedBy: varchar("validated_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const accountingLines = pgTable("accounting_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entryId: varchar("entry_id").notNull().references(() => accountingEntries.id, { onDelete: 'cascade' }),
  accountCode: varchar("account_code", { length: 20 }).notNull(),
  accountLabel: varchar("account_label", { length: 255 }).notNull(),
  description: text("description"),
  debit: decimal("debit", { precision: 10, scale: 2 }).notNull().default("0"),
  credit: decimal("credit", { precision: 10, scale: 2 }).notNull().default("0"),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### 3.5 Export FEC

```typescript
export const fecExports = pgTable("fec_exports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  garageId: varchar("garage_id").references(() => garages.id, { onDelete: 'cascade' }),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  entryCount: integer("entry_count").notNull().default(0),
  totalDebit: decimal("total_debit", { precision: 12, scale: 2 }).notNull().default("0"),
  totalCredit: decimal("total_credit", { precision: 12, scale: 2 }).notNull().default("0"),
  fileName: varchar("file_name", { length: 255 }),
  filePath: varchar("file_path", { length: 500 }),
  generatedBy: varchar("generated_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### 3.6 Compteurs de numérotation

```typescript
export const creditNoteCounters = pgTable("credit_note_counters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  year: integer("year").notNull(),
  currentNumber: integer("current_number").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const expenseCounters = pgTable("expense_counters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  year: integer("year").notNull(),
  currentNumber: integer("current_number").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### 3.7 Numérotation des écritures

La numérotation des écritures (`EC-YYYY-XXXXXX`) est gérée via une fonction `storage.getNextEntryNumber(year)` qui incrémente un compteur en base par année.

Format : `EC-2026-000001`

---

## 4. Services backend

### 4.1 `server/bridgeService.ts`

Service d'agrégation bancaire via l'API Bridge (https://api.bridgeapi.io).

**Constants** :
```typescript
const BRIDGE_API = "https://api.bridgeapi.io";
const BRIDGE_VERSION = "2025-01-15";
const BRIDGE_USER_FILE = path.join(process.cwd(), ".bridge_user.json");
const BRIDGE_TOKEN_CACHE_FILE = path.join(process.cwd(), ".bridge_token_cache.json");
```

**Headers requis** :
```typescript
{
  "Bridge-Version": "2025-01-15",
  "Client-Id": process.env.BRIDGE_CLIENT_ID,
  "Client-Secret": process.env.BRIDGE_CLIENT_SECRET,
  "Content-Type": "application/json"
}
```

**Fonctions exportées** :
- `isBridgeConfigured()` → boolean, vérifie si les clés sont présentes
- `getOrCreateBridgeUser(email)` → crée/charge un utilisateur Bridge et persiste son UUID dans `.bridge_user.json`
- `getAccessToken(email)` → authentifie l'utilisateur et gère un cache de token dans `.bridge_token_cache.json` (invalide 60s avant expiration)
- `createConnectSession(email, returnUrl)` → génère une URL hébergée pour que l'utilisateur connecte sa banque
- `listItems(email)` → liste les banques connectées (items)
- `deleteItem(email, itemId)` → déconnecte une banque
- `listAccounts(email)` → liste tous les comptes bancaires avec soldes et IBANs
- `listTransactions(email, accountId, limit)` → retourne les transactions d'un compte (par défaut 200)
- `formatAmount(amount, currency)` → formatte en EUR

**Authentification Bridge** :
1. Créer un utilisateur Bridge avec `POST /v2/users` et un `external_user_id` = email MD5
2. Authentifier avec `POST /v2/users/{uuid}/token` → retourne `access_token`
3. Utiliser le token dans le header `Authorization: Bearer {token}` pour les appels suivants

### 4.2 `server/stripeFinancialService.ts`

Service de connexion bancaire via Stripe Financial Connections.

**Fichiers de persistance** :
- `.stripe_financial_accounts.json` : liste des IDs de comptes liés
- `.stripe_fc_customer.json` : ID client Stripe utilisé pour Financial Connections

**Fonctions exportées** :
- `createFinancialSession(returnUrl)` → crée une session Financial Connections et retourne `client_secret`
- `retrieveSession(sessionId)` → récupère une session et extrait les IDs de comptes
- `listLinkedAccounts()` → retourne les détails de tous les comptes persistés
- `refreshBalance(accountId)` → déclenche un rafraîchissement du solde
- `listTransactions(accountId)` → liste les transactions d'un compte

**Initialisation Stripe** :
```typescript
const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY_PROD || process.env.STRIPE_SECRET_KEY,
  { apiVersion: "2025-01-27.acacia" }
);
```

**Session Financial Connections** :
```typescript
const session = await stripe.financialConnections.sessions.create({
  account_holder: { type: "customer", customer: customerId },
  permissions: ["balances", "transactions", "ownership"],
  filters: { countries: ["FR"] },
  return_url: returnUrl,
});
```

### 4.3 `server/plaidService.ts`

Service de connexion bancaire via Plaid.

**Initialisation** :
```typescript
const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || "development"],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      }
    }
  })
);
```

**Fonctions exportées** :
- `isPlaidConfigured()` → boolean
- `createLinkToken(userId)` → crée un Link Token pour le widget Plaid
- `exchangePublicToken(publicToken)` → échange le token public contre un access token permanent
- `getAccounts(accessToken)` → liste les comptes avec soldes

---

## 5. Routes API

Toutes les routes sont protégées par `isAuthenticated` + `isAdmin`.

### 5.1 Dépenses

```
GET    /api/admin/expense-categories          Liste catégories
POST   /api/admin/expense-categories          Créer catégorie
PATCH  /api/admin/expense-categories/:id      Modifier catégorie
DELETE /api/admin/expense-categories/:id      Supprimer catégorie

GET    /api/admin/expenses                    Liste dépenses
GET    /api/admin/expenses/:id                Détail dépense
POST   /api/admin/expenses                    Créer dépense (+ écriture comptable auto)
PATCH  /api/admin/expenses/:id                Modifier dépense
DELETE /api/admin/expenses/:id                Supprimer dépense
```

**Logique `POST /api/admin/expenses`** :
- Valide `vendor` (obligatoire), `date`, `amountHT` > 0
- Calcule automatiquement `taxAmount = amountHT * taxRate / 100` et `amountTTC = amountHT + taxAmount`
- Génère `expenseNumber` au format `DEP-YYYY-XXXXXX` via `storage.getNextExpenseNumber(year)`
- Appelle `createAccountingEntryForExpense()` pour créer l'écriture comptable en partie double

### 5.2 Avoirs

```
GET    /api/admin/credit-notes                Liste avoirs
GET    /api/admin/credit-notes/:id            Détail avoir
POST   /api/admin/credit-notes                Créer avoir (+ écriture comptable auto)
PATCH  /api/admin/credit-notes/:id            Modifier avoir
```

**Logique `POST /api/admin/credit-notes`** :
- Accepte un tableau `items` pour les lignes de l'avoir
- Génère `creditNoteNumber` via `storage.getNextCreditNoteNumber(year)`
- Appelle `createAccountingEntryForCreditNote()` pour l'écriture

### 5.3 Écritures comptables

```
GET    /api/admin/accounting/entries          Liste écritures (filtres: journal, startDate, endDate)
GET    /api/admin/accounting/entries/:id      Détail écriture + ses lignes
POST   /api/admin/accounting/entries          Créer écriture manuelle
PATCH  /api/admin/accounting/entries/:id/validate   Valider une écriture
POST   /api/admin/accounting/entries/bulk-validate  Valider plusieurs (body: {ids: string[]})
POST   /api/admin/accounting/entries/bulk-delete    Supprimer plusieurs (body: {ids: string[]})
POST   /api/admin/accounting/entries/bulk-email     Envoyer par email (body: {ids, email, startDate, endDate})
```

### 5.4 Rapports et exports

```
GET    /api/admin/accounting/tva-report        Rapport TVA (params: startDate, endDate)
GET    /api/admin/accounting/profit-loss       Compte de résultat (params: startDate, endDate)
GET    /api/admin/accounting/cash-flow         Cash flow mensuel (params: startDate, endDate)
POST   /api/admin/accounting/fec-export        Générer fichier FEC (body: {startDate, endDate})
GET    /api/admin/accounting/fec-exports       Historique des exports FEC
GET    /api/admin/accounting/dossier-validation Statut de validation du dossier comptable
POST   /api/admin/accounting/dossier-export    Export complet du dossier comptable
POST   /api/admin/accounting/dossier-email     Envoyer résumé par email (body: {email, startDate, endDate})
POST   /api/admin/accounting/backfill-invoices  Créer rétrospectivement les écritures des factures payées
GET    /api/admin/accounting/e-invoicing/compliance  Vérifier conformité Factur-X
```

### 5.5 Bridge OpenBanking

```
GET    /api/bridge/status                      Statut de configuration Bridge
POST   /api/bridge/connect-session             Créer session de connexion bancaire
                                               body: { email, returnUrl }
GET    /api/bridge/items                       Liste des banques connectées (params: email)
POST   /api/bridge/items/:itemId/refresh       Rafraîchir un item bancaire (body: { email })
DELETE /api/bridge/items/:itemId               Déconnecter une banque (body: { email })
GET    /api/bridge/accounts                    Liste des comptes (params: email)
GET    /api/bridge/accounts/:accountId/transactions  Transactions d'un compte (params: email, limit)
GET    /api/bridge/dashboard                   Dashboard consolidé (items + comptes + solde total)
POST   /api/bridge/sync-to-accounting          Importer transactions → écritures comptables
                                               body: { email, accountIds?, dateFrom?, dateTo? }
POST   /api/bridge/preview-sync                Prévisualiser transactions sans importer
                                               body: { email, accountIds?, dateFrom?, dateTo? }
```

**Logique de sync Bridge → Comptabilité** :
- Vérifie les doublons via `sourceId LIKE 'bridge_%'`
- Crée une écriture journal `"bank"`, sourceType `"manual"`
- Pour chaque transaction :
  - Montant **positif** (entrée) : DR 512100 Banque / CR 471000 Compte d'attente
  - Montant **négatif** (sortie) : DR 471000 Compte d'attente / CR 512100 Banque

### 5.6 Stripe Financial Connections

```
POST   /api/stripe-financial/create-session           Créer session de connexion
                                                       body: { returnUrl }
POST   /api/stripe-financial/retrieve-session          Récupérer session et sauvegarder comptes
                                                       body: { sessionId }
GET    /api/stripe-financial/accounts                  Liste des comptes liés
POST   /api/stripe-financial/refresh-balance/:accountId  Rafraîchir solde
GET    /api/stripe-financial/transactions/:accountId   Transactions d'un compte
DELETE /api/stripe-financial/accounts/:accountId       Supprimer compte lié
GET    /api/stripe-financial/status                    Statut de configuration Stripe
```

### 5.7 Plaid

```
POST   /api/plaid/create-link-token       Créer link token (body: { userId })
POST   /api/plaid/exchange-token          Échanger token public (body: { publicToken })
GET    /api/plaid/accounts                Liste des comptes (params: accessToken)
GET    /api/plaid/balances                Soldes des comptes
```

### 5.8 Import Bunq

```
POST   /api/import-bunq                   Importer relevé Bunq (body: { base64, filename })
GET    /api/import-bunq/stats             Statistiques d'import
```

---

## 6. Logique métier automatisée

### 6.1 Écriture comptable automatique à la création d'une dépense

Fonction `createAccountingEntryForExpense(expense, user)` appelée dans `POST /api/admin/expenses` :

```typescript
// Plan comptable pour les dépenses
// Compte de charge selon catégorie (606xxx) ↔ TVA déductible (445660) ↔ Fournisseur (401000)

const ht = parseFloat(expense.amountHT);
const tva = parseFloat(expense.taxAmount);
const ttc = parseFloat(expense.amountTTC);

// Ligne 1 : Charge HT → DR 606100 Achats / CR 0
// Ligne 2 : TVA déductible → DR 445660 TVA déductible / CR 0  
// Ligne 3 : Fournisseur → DR 0 / CR 401000 Fournisseurs
```

### 6.2 Écriture comptable automatique à la création d'un avoir

Fonction `createAccountingEntryForCreditNote(creditNote, user)` :

```typescript
// Journal: sales (car avoir annule une vente)
// Ligne 1 : Annulation CA → DR 706000 Prestations de services / CR 0
// Ligne 2 : Annulation TVA → DR 445710 TVA collectée / CR 0
// Ligne 3 : Client → DR 0 / CR 411000 Clients
```

### 6.3 Écriture comptable automatique au paiement d'une facture

Déclenchée quand `status` passe à `"paid"` dans `PATCH /api/admin/invoices/:id` :

```typescript
// Journal: sales
// Variables :
const ht = parseFloat(invoice.priceExcludingTax);
const tva = parseFloat(invoice.taxAmount);
const ttc = parseFloat(invoice.amount);
const paymentMethod = invoice.paymentMethod;
const bankAccount = paymentMethod === "cash" ? "530000" : "512000";
const bankLabel = paymentMethod === "cash" ? "Caisse" : "Banque";

// Lignes générées :
// DR 411000 Clients - HT + TVA = TTC
// CR 706000 Prestations de services - HT
// CR 445710 TVA collectée - TVA
// DR {bankAccount} - TTC
// CR 411000 Clients - TTC
```

### 6.4 Backfill des factures historiques

Route `POST /api/admin/accounting/backfill-invoices` :
- Récupère toutes les factures avec `status = "paid"`
- Exclut celles qui ont déjà une écriture (`sourceId = invoice.id`)
- Crée une écriture comptable pour chacune

### 6.5 Numérotation automatique

Format des numéros :
- **Écritures** : `EC-2026-000001` (via `getNextEntryNumber(year)`)
- **Dépenses** : `DEP-2026-000001` (via `getNextExpenseNumber(year)`)
- **Avoirs** : `AV-2026-000001` (via `getNextCreditNoteNumber(year)`)

Chaque fonction incrémente un compteur dans la table `*_counters` correspondante, avec upsert par année.

---

## 7. Pages frontend

### 7.1 `client/src/pages/admin-accounting.tsx`

Page principale avec 8 onglets :

| Onglet | Clé | Contenu |
|--------|-----|---------|
| Vue d'ensemble | `overview` | KPIs : CA, Dépenses, Résultat net, Marge. Graphiques BarChart mensuel (recharts) |
| Analytics | `analytics` | Graphiques P&L et Cash Flow avec LineChart/AreaChart (recharts) |
| Journal | `journal` | Table des écritures avec filtres journal/période, actions bulk (valider, supprimer, email, export CSV) |
| TVA | `tva` | Rapport TVA collectée vs déductible avec détail par taux |
| FEC | `fec` | Générateur de fichier FEC + historique des exports |
| E-Invoicing | `einvoicing` | Vérificateur de conformité Factur-X pour les factures |
| Dossier | `dossier` | Validation du dossier comptable + envoi par email comptable |
| OpenBanking | `openbanking` | Intégration Bridge/Stripe Financial Connections/Plaid/Bunq |

**États principaux** :
```typescript
const [activeTab, setActiveTab] = useState<
  "overview" | "analytics" | "journal" | "tva" | "fec" | 
  "einvoicing" | "dossier" | "openbanking"
>("overview");
const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
const [journalFilter, setJournalFilter] = useState<string>("all");
const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
const [manualEntryDialog, setManualEntryDialog] = useState(false);
```

**Queries** :
```typescript
useQuery({ queryKey: ["/api/admin/accounting/profit-loss", {startDate, endDate}] })
useQuery({ queryKey: ["/api/admin/accounting/tva-report", {startDate, endDate}] })
useQuery({ queryKey: ["/api/admin/accounting/cash-flow", {startDate, endDate}] })
useQuery({ queryKey: ["/api/admin/accounting/entries", {startDate, endDate, journal}] })
useQuery({ queryKey: ["/api/admin/accounting/fec-exports"] })
useQuery({ queryKey: ["/api/admin/accounting/e-invoicing/compliance"] })
useQuery({ queryKey: ["/api/admin/accounting/dossier-validation"] })
```

**Accès** : Seuls `superadmin` et `root` (vérification `canAccessAccounting = isSuperAdmin || isRoot`)

### 7.2 `client/src/pages/admin-expenses.tsx`

Page de gestion des dépenses avec :
- Liste des dépenses avec filtres (catégorie, statut, période)
- Formulaire de création avec :
  - Sélection catégorie
  - Fournisseur, description, date
  - Montant HT, taux TVA (calcul auto TTC)
  - Mode de paiement
  - Upload de justificatif (facture/reçu)
- CRUD complet sur catégories de dépenses

### 7.3 `client/src/pages/admin-credit-notes.tsx`

Page de gestion des avoirs avec :
- Liste des avoirs liés aux factures
- Formulaire de création avec sélection facture + client
- Lignes d'avoir avec description, quantité, prix HT, taux TVA
- Calcul automatique TTC
- Transitions de statut : `draft → issued → refunded`

### 7.4 `client/src/pages/admin-bridge-banking.tsx`

Page de gestion Bridge OpenBanking avec :
- Statut de connexion Bridge
- Bouton de connexion bancaire (ouvre l'URL Bridge hébergée)
- Liste des banques connectées (items) avec refresh/déconnexion
- Liste des comptes avec soldes
- Tableau de transactions par compte
- Interface de synchronisation vers comptabilité :
  - Sélection de comptes à importer
  - Filtres de date
  - Prévisualisation avant import
  - Résultats (importées / ignorées / erreurs)
- Import Bunq CSV/PDF/ZIP (section `BunqImportSection`)

### 7.5 `client/src/pages/admin-stripe-banking.tsx`

Page de gestion Stripe Financial Connections avec :
- Statut de configuration Stripe
- Bouton de connexion (crée une session Financial Connections)
- Liste des comptes liés avec soldes
- Transactions par compte
- Suppression de compte

### 7.6 `client/src/pages/admin-bank-connection.tsx`

Page de gestion Plaid avec :
- Widget Plaid Link (intégration `react-plaid-link`)
- Liste des comptes découverts avec soldes courants/disponibles

---

## 8. Composants frontend

### 8.1 `client/src/components/OpenBankingPanel.tsx`

Composant réutilisable intégré dans l'onglet "OpenBanking" de la page comptabilité. Contient 4 sous-sections :

1. **Bridge** : Connexion multi-banque avec liste items/comptes/transactions + sync
2. **Stripe Financial Connections** : Connexion Stripe et liste des comptes
3. **Plaid** : Connexion Plaid et liste des comptes
4. **Bunq** : Import de relevés Bunq (`BunqImportSection`)

**Interfaces TypeScript** :
```typescript
interface BridgeAccount {
  id: number;
  name: string;
  balance: number;
  currency: string;
  iban?: string;
  status: string;
  type: string;
  bank_name?: string;
}

interface BridgeItem {
  id: number;
  status: number;
  bank_id: number;
  name?: string;
}

interface BridgeTx {
  id: number;
  amount: number;
  date: string;
  label: string;
  category_id?: number;
  is_future?: boolean;
}

interface BunqStats {
  total: number;
  lastImport?: string;
}

interface BunqImportResult {
  imported: number;
  skipped: number;
  errors?: string[];
}
```

---

## 9. Export FEC (Conformité française)

L'export FEC suit la norme DGFiP (Direction générale des Finances publiques).

**Format** : Fichier texte avec séparateur `|`, encodage UTF-8.

**Colonnes** (dans l'ordre) :
```
JournalCode | JournalLib | EcritureNum | EcritureDate | CompteNum | CompteLib | 
CompAuxNum | CompAuxLib | PieceRef | PieceDate | EcritureLib | Debit | Credit |
EcritureLet | DateLet | ValidDate | Montantdevise | Idevise
```

**Mapping** :
- `JournalCode` : journal de l'écriture (SALES, PURCHA, BANK, CASH, MISC)
- `EcritureNum` : `entry.entryNumber`
- `EcritureDate` : format `YYYYMMDD`
- `CompteNum` : `line.accountCode`
- `CompteLib` : `line.accountLabel`
- `Debit` / `Credit` : décimales avec virgule (ex: `120,00`)
- `ValidDate` : date si validée, vide sinon
- `Idevise` : toujours `EUR`

**Nom du fichier** : `FEC_YYYY-MM-DD_YYYY-MM-DD.txt`

---

## 10. Rapport TVA

Route `GET /api/admin/accounting/tva-report` calcule :

```typescript
// TVA collectée (ventes)
tvaCollected = sum(invoices.taxAmount)  // factures payées sur la période

// TVA déductible (achats)
tvaDeductible = sum(expenses.taxAmount)  // dépenses payées sur la période

// TVA sur avoirs
tvaCreditNotes = sum(creditNotes.taxAmount)  // avoirs émis/remboursés

// Net à payer
tvaNet = tvaCollected - tvaDeductible - tvaCreditNotes

// Détail par taux (ex: 20%, 10%, 5.5%)
tvaByRate = { "20.00": { collected, deductible, net }, ... }
```

**Réponse JSON** :
```typescript
{
  period: { startDate, endDate },
  salesHT: number,
  purchasesHT: number,
  tvaCollected: number,
  tvaDeductible: number,
  tvaCreditNotes: number,
  tvaNet: number,
  tvaByRate: Record<string, { collected: number; deductible: number; net: number }>,
  invoiceCount: number,
  expenseCount: number,
  creditNoteCount: number,
}
```

---

## 11. Plan comptable utilisé

Comptes PCG (Plan Comptable Général) français utilisés dans les écritures :

| Code | Libellé | Utilisation |
|------|---------|-------------|
| `411000` | Clients | Débit facture, Crédit encaissement |
| `401000` | Fournisseurs | Crédit dépense |
| `445660` | TVA déductible | Débit dépense |
| `445710` | TVA collectée | Crédit facture |
| `512000` | Banque compte courant | Débit encaissement (virement/carte) |
| `512100` | Banque compte courant (Bridge) | Utilisé pour sync OpenBanking |
| `530000` | Caisse | Débit encaissement espèces |
| `606100` | Achats non stockés matières premières | Débit dépense (défaut) |
| `706000` | Prestations de services | Crédit facture |
| `471000` | Compte d'attente - à régulariser | Contrepartie transactions Bridge |

---

## 12. Contrôle d'accès

### Rôles pouvant accéder au module comptabilité :
- `root` : accès total (Administration Système inclus)
- `superadmin` : accès comptabilité + app, pas Administration Système
- `admin` : **pas** d'accès à la comptabilité (caché dans sidebar, route protégée)
- `employe` : **pas** d'accès à la comptabilité

### Middleware backend :
```typescript
// isAdmin = root | superadmin | admin | employe
// isSuperAdmin = root | superadmin
// isRoot = root seulement

// Toutes les routes comptabilité/OpenBanking utilisent : isAuthenticated, isAdmin
// Le filtrage multi-tenant (garageId) ne s'applique pas aux root/superadmin :
const garageId = (req.user?.role === "superadmin" || req.user?.role === "root") 
  ? undefined 
  : req.user?.garageId;
```

### Vérification frontend :
```typescript
// Dans useAuth.ts :
const isRoot = user?.role === "root";
const isSuperAdmin = user?.role === "superadmin" || isRoot;

// Dans admin-accounting.tsx :
const canAccessAccounting = isSuperAdmin || isRoot;
if (!canAccessAccounting) return <AccessDenied />;
```

### Sidebar :
```typescript
// Groupe Comptabilité :
{ label: "Comptabilité", superadminOnly: true }  // visible superadmin + root

// Groupe Administration Système :
{ label: "Administration Système", rootOnly: true }  // visible root seulement
```

---

## Dépendances npm à installer

```bash
# Bridge : aucune (fetch natif)

# Stripe Financial Connections
npm install stripe

# Plaid
npm install plaid react-plaid-link

# Graphiques
npm install recharts

# Email (dossier comptable)
npm install resend

# OCR Scanner (optionnel)
npm install tesseract.js
```

---

## Fichiers persistés en local (hors DB)

Ces fichiers sont créés à la racine du projet et persistent les données entre redémarrages :

| Fichier | Contenu |
|---------|---------|
| `.bridge_user.json` | UUID et external_user_id Bridge |
| `.bridge_token_cache.json` | Token d'accès Bridge avec expiration |
| `.stripe_financial_accounts.json` | IDs des comptes Stripe liés |
| `.stripe_fc_customer.json` | ID client Stripe Financial Connections |

---

## Ordre d'implémentation recommandé pour l'agent

1. **Schéma DB** : Ajouter toutes les tables dans `shared/schema.ts` + `npm run db:push`
2. **Storage** : Implémenter CRUD dans `server/storage.ts` pour chaque table
3. **Services** : Créer `server/bridgeService.ts`, `server/stripeFinancialService.ts`, `server/plaidService.ts`
4. **Routes** : Ajouter toutes les routes dans `server/routes.ts`
5. **Logique auto** : Implémenter `createAccountingEntryForExpense/CreditNote` et le hook sur paiement facture
6. **Pages** : Créer les 5 pages frontend dans `client/src/pages/`
7. **Composant OpenBankingPanel** : Créer `client/src/components/OpenBankingPanel.tsx`
8. **Sidebar** : Ajouter les entrées de menu avec `superadminOnly: true`
9. **Variables d'env** : Configurer toutes les clés dans les Secrets Replit
10. **Test backfill** : Appeler `POST /api/admin/accounting/backfill-invoices` pour les données existantes
