import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, FileText, ShoppingCart, CreditCard, RotateCcw,
  Receipt, BookOpen, List, Users, Settings, Building2,
  Wallet, Package, KeyRound, Calendar, BarChart3,
  Landmark, ShieldAlert, Calculator, ScanLine, HelpCircle,
  Compass, GraduationCap,
} from "lucide-react";

export type Lang = "fr" | "en";
export type LocalizedString = { fr: string; en: string };

export type ModuleGroup =
  | "overview"
  | "sales"
  | "purchases"
  | "treasury"
  | "accounting"
  | "admin"
  | "help";

export type ModuleEntry = {
  route: string;
  group: ModuleGroup;
  icon: LucideIcon;
  title: LocalizedString;
  tagline: LocalizedString;
  description: LocalizedString;
  features: LocalizedString[];
  howTo: LocalizedString[];
  roles?: ("USER" | "ADMIN" | "SUPER_ADMIN" | "ROOT_ADMIN")[];
  isNew?: boolean;
};

export type GroupMeta = {
  id: ModuleGroup;
  label: LocalizedString;
  description: LocalizedString;
  collapsible: boolean;
  order: number;
};

export const GROUPS: GroupMeta[] = [
  {
    id: "overview",
    label: { fr: "Vue générale", en: "Overview" },
    description: {
      fr: "Pilotage global de votre activité — tableau de bord, indicateurs clés et planning.",
      en: "Global business overview — dashboard, key metrics and planning.",
    },
    collapsible: false,
    order: 1,
  },
  {
    id: "sales",
    label: { fr: "Ventes", en: "Sales" },
    description: {
      fr: "Tout ce qui concerne vos clients : facturation, encaissements et avoirs.",
      en: "Everything client-side: invoicing, collections and credit notes.",
    },
    collapsible: true,
    order: 2,
  },
  {
    id: "purchases",
    label: { fr: "Achats", en: "Purchases" },
    description: {
      fr: "Gestion de vos dépenses et factures fournisseurs avec scan OCR intelligent.",
      en: "Expense and supplier invoice management with AI-powered OCR scanning.",
    },
    collapsible: true,
    order: 3,
  },
  {
    id: "treasury",
    label: { fr: "Trésorerie", en: "Treasury" },
    description: {
      fr: "Suivi des paiements, abonnements SaaS et connexion bancaire en temps réel.",
      en: "Payments tracking, SaaS subscriptions and real-time banking connection.",
    },
    collapsible: true,
    order: 4,
  },
  {
    id: "accounting",
    label: { fr: "Comptabilité", en: "Accounting" },
    description: {
      fr: "Comptabilité partie double, journal des écritures, plan comptable et obligations fiscales.",
      en: "Double-entry accounting, journal entries, chart of accounts and tax obligations.",
    },
    collapsible: true,
    order: 5,
  },
  {
    id: "admin",
    label: { fr: "Administration", en: "Administration" },
    description: {
      fr: "Configuration, utilisateurs, applications et accès API.",
      en: "Configuration, users, applications and API access.",
    },
    collapsible: true,
    order: 6,
  },
  {
    id: "help",
    label: { fr: "Aide & Support", en: "Help & Support" },
    description: {
      fr: "Centre d'aide interactif, visite guidée et documentation des modules.",
      en: "Interactive help center, guided tour and module documentation.",
    },
    collapsible: false,
    order: 7,
  },
];

export const MODULES: ModuleEntry[] = [
  // ========== OVERVIEW ==========
  {
    route: "/",
    group: "overview",
    icon: LayoutDashboard,
    title: { fr: "Tableau de Bord", en: "Dashboard" },
    tagline: {
      fr: "Vue d'ensemble en temps réel de votre activité.",
      en: "Real-time overview of your business.",
    },
    description: {
      fr: "Le tableau de bord agrège vos KPIs financiers : chiffre d'affaires, dépenses, trésorerie disponible, factures en attente. C'est votre point d'entrée quotidien.",
      en: "The dashboard aggregates your financial KPIs: revenue, expenses, available cash, pending invoices. Your daily entry point.",
    },
    features: [
      { fr: "Indicateurs clés (CA, dépenses, marge)", en: "Key indicators (revenue, expenses, margin)" },
      { fr: "Graphiques d'évolution mensuelle", en: "Monthly evolution charts" },
      { fr: "Prochains paiements à venir", en: "Upcoming payments" },
      { fr: "Alertes et notifications", en: "Alerts and notifications" },
    ],
    howTo: [
      { fr: "Sélectionnez la période en haut à droite (mois, trimestre, année).", en: "Pick the period in the top right (month, quarter, year)." },
      { fr: "Cliquez sur un widget pour accéder au détail.", en: "Click a widget to drill down." },
      { fr: "Utilisez le sélecteur d'application si vous gérez plusieurs entreprises.", en: "Use the application picker if you manage multiple businesses." },
    ],
  },
  {
    route: "/analytics",
    group: "overview",
    icon: BarChart3,
    title: { fr: "Analyses avancées", en: "Advanced Analytics" },
    tagline: {
      fr: "Rapports détaillés, tendances et projections.",
      en: "Detailed reports, trends and projections.",
    },
    description: {
      fr: "Allez plus loin que le dashboard : croisez vos données par catégorie, client, fournisseur, période. Idéal pour préparer une réunion ou une revue annuelle.",
      en: "Go beyond the dashboard: cross-reference your data by category, client, supplier, period. Ideal for board meetings or yearly reviews.",
    },
    features: [
      { fr: "Top clients & top fournisseurs", en: "Top clients & top suppliers" },
      { fr: "Répartition des dépenses par catégorie", en: "Expense breakdown by category" },
      { fr: "Comparaisons année-sur-année", en: "Year-over-year comparisons" },
      { fr: "Export PDF & Excel", en: "PDF & Excel export" },
    ],
    howTo: [
      { fr: "Choisissez le type d'analyse dans les onglets.", en: "Pick the analysis type in the tabs." },
      { fr: "Filtrez par période, client ou catégorie.", en: "Filter by period, client or category." },
      { fr: "Cliquez sur \"Exporter\" pour télécharger le rapport.", en: "Click \"Export\" to download the report." },
    ],
  },
  {
    route: "/agenda",
    group: "overview",
    icon: Calendar,
    title: { fr: "Agenda", en: "Agenda" },
    tagline: {
      fr: "Planning unifié : rendez-vous, échéances et abonnements.",
      en: "Unified planning: appointments, deadlines and subscriptions.",
    },
    description: {
      fr: "Visualisez tous vos événements financiers et professionnels au même endroit : prélèvements SaaS, échéances de factures, rendez-vous clients, rappels.",
      en: "All your financial and business events in one place: SaaS charges, invoice deadlines, client appointments, reminders.",
    },
    features: [
      { fr: "Vue mois / semaine / jour", en: "Month / week / day views" },
      { fr: "Création rapide d'un rendez-vous", en: "Quick appointment creation" },
      { fr: "Rappels automatiques par email", en: "Automatic email reminders" },
      { fr: "Synchronisation des échéances de factures", en: "Invoice deadlines sync" },
    ],
    howTo: [
      { fr: "Cliquez sur une date pour créer un événement.", en: "Click a date to create an event." },
      { fr: "Filtrez par type d'événement (facture, rendez-vous, abonnement).", en: "Filter by event type (invoice, appointment, subscription)." },
    ],
  },

  // ========== SALES ==========
  {
    route: "/invoices",
    group: "sales",
    icon: FileText,
    title: { fr: "Factures clients", en: "Client Invoices" },
    tagline: {
      fr: "Créez, envoyez et suivez vos factures de vente.",
      en: "Create, send and track your sales invoices.",
    },
    description: {
      fr: "Module complet de facturation : création de devis convertis en factures, envoi par email, suivi des paiements, relances automatiques. Conforme aux obligations légales (TVA, mentions obligatoires).",
      en: "Full invoicing module: quotes converted to invoices, email sending, payment tracking, automatic reminders. Compliant with legal requirements (VAT, required mentions).",
    },
    features: [
      { fr: "Devis et factures professionnels", en: "Professional quotes and invoices" },
      { fr: "Calcul automatique de TVA (Maroc : 0/7/10/14/20%)", en: "Automatic VAT calculation (Morocco: 0/7/10/14/20%)" },
      { fr: "Envoi par email avec PDF joint", en: "Email sending with PDF attachment" },
      { fr: "Suivi des paiements (payée, partielle, en retard)", en: "Payment tracking (paid, partial, overdue)" },
      { fr: "Relances automatiques", en: "Automatic reminders" },
    ],
    howTo: [
      { fr: "Cliquez sur \"Nouvelle facture\".", en: "Click \"New invoice\"." },
      { fr: "Sélectionnez un client (ou créez-en un).", en: "Pick a client (or create one)." },
      { fr: "Ajoutez les lignes de produits/services avec leur TVA.", en: "Add product/service lines with their VAT." },
      { fr: "Validez puis cliquez sur \"Envoyer\" pour transmettre au client.", en: "Validate then click \"Send\" to deliver to the client." },
    ],
  },
  {
    route: "/credit-notes",
    group: "sales",
    icon: RotateCcw,
    title: { fr: "Avoirs", en: "Credit Notes" },
    tagline: {
      fr: "Gérez les remboursements et corrections de factures.",
      en: "Manage refunds and invoice corrections.",
    },
    description: {
      fr: "Émettez des avoirs en cas d'erreur, de remboursement ou de remise commerciale. L'avoir est lié à la facture d'origine et impacte automatiquement votre comptabilité.",
      en: "Issue credit notes for errors, refunds or commercial discounts. Credit notes are linked to the original invoice and automatically impact your accounting.",
    },
    features: [
      { fr: "Création depuis une facture existante", en: "Creation from an existing invoice" },
      { fr: "Avoir total ou partiel", en: "Total or partial credit note" },
      { fr: "Justification obligatoire", en: "Mandatory justification" },
      { fr: "Impact comptable automatique", en: "Automatic accounting impact" },
    ],
    howTo: [
      { fr: "Ouvrez la facture concernée puis cliquez sur \"Créer un avoir\".", en: "Open the invoice then click \"Create credit note\"." },
      { fr: "Choisissez avoir total ou partiel.", en: "Choose total or partial credit note." },
      { fr: "Indiquez le motif et validez.", en: "State the reason and confirm." },
    ],
  },
  {
    route: "/clients",
    group: "sales",
    icon: Users,
    title: { fr: "Clients", en: "Clients" },
    tagline: {
      fr: "Carnet d'adresses et historique commercial.",
      en: "Address book and commercial history.",
    },
    description: {
      fr: "Centralisez vos clients : coordonnées, conditions de paiement, historique des factures, encours, statistiques. Base de données enrichie automatiquement à chaque facture.",
      en: "Centralize your clients: contact info, payment terms, invoice history, outstanding balance, statistics. Database auto-enriched with each invoice.",
    },
    features: [
      { fr: "Fiche client complète (SIRET, TVA, RIB)", en: "Complete client card (registration, VAT, bank)" },
      { fr: "Historique des factures et paiements", en: "Invoice and payment history" },
      { fr: "Encours en temps réel", en: "Real-time outstanding balance" },
      { fr: "Conditions de paiement personnalisées", en: "Custom payment terms" },
    ],
    howTo: [
      { fr: "Cliquez sur \"Nouveau client\" et remplissez la fiche.", en: "Click \"New client\" and fill in the card." },
      { fr: "Cliquez sur un client pour voir son historique complet.", en: "Click a client to see their full history." },
    ],
  },

  // ========== PURCHASES ==========
  {
    route: "/supplier-invoices",
    group: "purchases",
    icon: ShoppingCart,
    title: { fr: "Factures fournisseurs", en: "Supplier Invoices" },
    tagline: {
      fr: "Saisie et suivi des factures reçues.",
      en: "Capture and track received invoices.",
    },
    description: {
      fr: "Enregistrez les factures reçues de vos fournisseurs, joignez le PDF original, suivez les échéances de paiement et générez les écritures comptables automatiquement.",
      en: "Record invoices received from your suppliers, attach the original PDF, track payment deadlines and auto-generate accounting entries.",
    },
    features: [
      { fr: "Saisie manuelle ou import OCR", en: "Manual entry or OCR import" },
      { fr: "Pièce jointe PDF/image obligatoire", en: "Mandatory PDF/image attachment" },
      { fr: "Échéancier de paiement", en: "Payment schedule" },
      { fr: "Validation hiérarchique", en: "Hierarchical approval" },
    ],
    howTo: [
      { fr: "Pour gagner du temps, utilisez \"Scan OCR\" qui extrait les données automatiquement.", en: "To save time, use \"OCR Scan\" which extracts data automatically." },
      { fr: "Vérifiez les montants extraits puis validez.", en: "Verify extracted amounts then validate." },
    ],
  },
  {
    route: "/expenses",
    group: "purchases",
    icon: Receipt,
    title: { fr: "Dépenses", en: "Expenses" },
    tagline: {
      fr: "Notes de frais et petits achats du quotidien.",
      en: "Expense reports and daily small purchases.",
    },
    description: {
      fr: "Saisissez vos tickets de caisse, notes de frais et achats divers. Catégorisation automatique, justificatifs photo, remboursement collaborateur.",
      en: "Capture receipts, expense reports and miscellaneous purchases. Auto-categorization, photo receipts, employee reimbursement.",
    },
    features: [
      { fr: "Photo du justificatif depuis mobile", en: "Receipt photo from mobile" },
      { fr: "Catégories personnalisables", en: "Customizable categories" },
      { fr: "Calcul de TVA récupérable", en: "Recoverable VAT calculation" },
      { fr: "Workflow de validation", en: "Approval workflow" },
    ],
    howTo: [
      { fr: "Cliquez sur \"Nouvelle dépense\" puis joignez le justificatif.", en: "Click \"New expense\" then attach the receipt." },
      { fr: "Renseignez catégorie, montant et TVA.", en: "Fill in category, amount and VAT." },
    ],
  },
  {
    route: "/ocr-scan",
    group: "purchases",
    icon: ScanLine,
    title: { fr: "Scan OCR", en: "OCR Scan" },
    tagline: {
      fr: "Numérisation intelligente de vos factures par IA.",
      en: "AI-powered invoice scanning.",
    },
    description: {
      fr: "Prenez en photo une facture papier ou importez un PDF : l'IA extrait automatiquement le fournisseur, la date, le montant HT/TVA/TTC et propose la catégorie comptable. Compatible Gemini et Mindee.",
      en: "Photograph a paper invoice or import a PDF: AI auto-extracts supplier, date, amount excl./incl. VAT and suggests the accounting category. Compatible with Gemini and Mindee.",
    },
    features: [
      { fr: "Extraction automatique des champs clés", en: "Automatic extraction of key fields" },
      { fr: "Reconnaissance multi-langues", en: "Multi-language recognition" },
      { fr: "Création directe d'une dépense ou facture fournisseur", en: "Direct creation of an expense or supplier invoice" },
      { fr: "Stockage sécurisé du document original", en: "Secure storage of the original document" },
    ],
    howTo: [
      { fr: "Glissez-déposez un PDF ou cliquez pour prendre une photo.", en: "Drag-drop a PDF or click to take a photo." },
      { fr: "Vérifiez les données extraites par l'IA.", en: "Verify the AI-extracted data." },
      { fr: "Validez pour créer la dépense ou facture associée.", en: "Confirm to create the linked expense or invoice." },
    ],
  },
  {
    route: "/suppliers",
    group: "purchases",
    icon: Package,
    title: { fr: "Fournisseurs", en: "Suppliers" },
    tagline: {
      fr: "Annuaire et conditions négociées.",
      en: "Directory and negotiated terms.",
    },
    description: {
      fr: "Gérez votre base fournisseurs : coordonnées, RIB pour virements, délais de paiement négociés, historique des achats.",
      en: "Manage your supplier database: contacts, bank details for transfers, negotiated payment terms, purchase history.",
    },
    features: [
      { fr: "RIB et coordonnées bancaires", en: "Bank account details" },
      { fr: "Délais de paiement négociés", en: "Negotiated payment terms" },
      { fr: "Historique d'achats", en: "Purchase history" },
      { fr: "Évaluation et notes internes", en: "Rating and internal notes" },
    ],
    howTo: [
      { fr: "Créez la fiche fournisseur avant la première facture.", en: "Create the supplier card before the first invoice." },
    ],
  },

  // ========== TREASURY ==========
  {
    route: "/payments",
    group: "treasury",
    icon: CreditCard,
    title: { fr: "Paiements", en: "Payments" },
    tagline: {
      fr: "Encaissements et décaissements.",
      en: "Incoming and outgoing payments.",
    },
    description: {
      fr: "Enregistrez tous vos mouvements financiers : virements reçus, prélèvements, espèces, chèques. Lettrage automatique avec les factures correspondantes.",
      en: "Record all your financial movements: received transfers, debits, cash, checks. Automatic matching with corresponding invoices.",
    },
    features: [
      { fr: "Multi-modes (virement, CB, espèces, chèque)", en: "Multi-method (transfer, card, cash, check)" },
      { fr: "Lettrage automatique facture/paiement", en: "Automatic invoice/payment matching" },
      { fr: "Rapprochement bancaire", en: "Bank reconciliation" },
      { fr: "Export comptable", en: "Accounting export" },
    ],
    howTo: [
      { fr: "À la réception d'un virement, cliquez sur \"Nouveau paiement\".", en: "When you receive a transfer, click \"New payment\"." },
      { fr: "Sélectionnez la facture à lettrer.", en: "Pick the invoice to match." },
    ],
  },
  {
    route: "/services",
    group: "treasury",
    icon: Wallet,
    title: { fr: "Abonnements SaaS", en: "SaaS Subscriptions" },
    tagline: {
      fr: "Pilotage de vos abonnements logiciels récurrents.",
      en: "Monitor your recurring software subscriptions.",
    },
    description: {
      fr: "Centralisez tous vos abonnements (Adobe, Microsoft, AWS, etc.) : montant, fréquence, prochaine échéance, propriétaire interne. Détectez les doublons et optimisez les coûts.",
      en: "Centralize all your subscriptions (Adobe, Microsoft, AWS, etc.): amount, frequency, next due date, internal owner. Spot duplicates and optimize costs.",
    },
    features: [
      { fr: "Suivi des renouvellements automatiques", en: "Auto-renewal tracking" },
      { fr: "Alertes avant prélèvement", en: "Alerts before charge" },
      { fr: "Analyse du coût total annuel", en: "Total annual cost analysis" },
      { fr: "Détection des abonnements dormants", en: "Dormant subscription detection" },
    ],
    howTo: [
      { fr: "Ajoutez chaque abonnement avec son cycle (mensuel, annuel).", en: "Add each subscription with its cycle (monthly, yearly)." },
      { fr: "Consultez le tableau récapitulatif pour voir le coût total.", en: "Check the summary table for total cost." },
    ],
  },
  {
    route: "/banking",
    group: "treasury",
    icon: Landmark,
    title: { fr: "Open Banking", en: "Open Banking" },
    tagline: {
      fr: "Connexion sécurisée à vos comptes bancaires.",
      en: "Secure connection to your bank accounts.",
    },
    description: {
      fr: "Reliez vos comptes bancaires via une API sécurisée (DSP2). Importation automatique des transactions, rapprochement intelligent avec vos factures et dépenses.",
      en: "Link your bank accounts via secure API (PSD2). Automatic transaction import, smart reconciliation with your invoices and expenses.",
    },
    features: [
      { fr: "Connexion DSP2 / Open Banking", en: "PSD2 / Open Banking connection" },
      { fr: "Import quotidien des transactions", en: "Daily transaction import" },
      { fr: "Suggestion de rapprochement IA", en: "AI reconciliation suggestions" },
      { fr: "Multi-comptes et multi-banques", en: "Multi-account and multi-bank" },
    ],
    howTo: [
      { fr: "Cliquez sur \"Connecter une banque\" et suivez l'authentification.", en: "Click \"Connect a bank\" and follow the authentication." },
      { fr: "Validez les transactions importées chaque jour.", en: "Validate imported transactions daily." },
    ],
  },

  // ========== ACCOUNTING ==========
  {
    route: "/accounting",
    group: "accounting",
    icon: BookOpen,
    title: { fr: "Module Comptabilité", en: "Accounting Module" },
    tagline: {
      fr: "Comptabilité partie double et bilan automatique.",
      en: "Double-entry accounting and automatic balance sheet.",
    },
    description: {
      fr: "Comptabilité de niveau professionnel (équivalent QuickBooks/Xero) : génération automatique des écritures depuis vos factures et paiements, bilan, compte de résultat, grand livre.",
      en: "Professional-grade accounting (QuickBooks/Xero level): automatic entry generation from your invoices and payments, balance sheet, P&L, general ledger.",
    },
    features: [
      { fr: "Partie double automatique", en: "Automatic double-entry" },
      { fr: "Bilan & compte de résultat", en: "Balance sheet & P&L" },
      { fr: "Grand livre & balance", en: "General ledger & trial balance" },
      { fr: "Clôture annuelle assistée", en: "Assisted annual closing" },
    ],
    howTo: [
      { fr: "Les écritures sont générées automatiquement depuis vos factures.", en: "Entries are auto-generated from your invoices." },
      { fr: "Consultez le bilan ou le compte de résultat à tout moment.", en: "Consult the balance sheet or P&L at any time." },
    ],
    isNew: true,
  },
  {
    route: "/journal",
    group: "accounting",
    icon: List,
    title: { fr: "Journal des écritures", en: "Journal Entries" },
    tagline: {
      fr: "Toutes les écritures comptables chronologiques.",
      en: "All accounting entries in chronological order.",
    },
    description: {
      fr: "Visualisez et corrigez chaque écriture comptable : débit, crédit, compte impacté, pièce justificative. Indispensable pour la révision avec votre expert-comptable.",
      en: "View and correct each accounting entry: debit, credit, impacted account, supporting document. Essential for review with your accountant.",
    },
    features: [
      { fr: "Filtrage par période, compte, journal", en: "Filter by period, account, journal" },
      { fr: "Saisie manuelle d'écriture", en: "Manual entry input" },
      { fr: "Export FEC (Fichier des Écritures Comptables)", en: "Standard accounting file export" },
      { fr: "Verrouillage des exercices clos", en: "Closed period locking" },
    ],
    howTo: [
      { fr: "Cliquez sur une ligne pour voir le détail et la pièce jointe.", en: "Click a row to see details and the attachment." },
      { fr: "\"Nouvelle écriture\" pour une saisie manuelle.", en: "\"New entry\" for manual input." },
    ],
  },
  {
    route: "/accounts",
    group: "accounting",
    icon: List,
    title: { fr: "Plan comptable", en: "Chart of Accounts" },
    tagline: {
      fr: "Structure des comptes selon le PCG.",
      en: "Account structure following the chart of accounts standard.",
    },
    description: {
      fr: "Plan comptable général personnalisable : créez vos sous-comptes (clients, fournisseurs, banques), définissez les règles d'imputation automatique.",
      en: "Customizable general chart of accounts: create your sub-accounts (clients, suppliers, banks), define automatic posting rules.",
    },
    features: [
      { fr: "PCG par défaut (français/marocain)", en: "Default chart (French/Moroccan)" },
      { fr: "Sous-comptes personnalisés", en: "Custom sub-accounts" },
      { fr: "Règles d'imputation automatique", en: "Automatic posting rules" },
    ],
    howTo: [
      { fr: "Naviguez dans l'arborescence des comptes.", en: "Navigate the account tree." },
      { fr: "\"Ajouter un compte\" pour créer un sous-compte.", en: "\"Add an account\" to create a sub-account." },
    ],
  },
  {
    route: "/urssaf",
    group: "accounting",
    icon: Calculator,
    title: { fr: "URSSAF & Impôts", en: "URSSAF & Taxes" },
    tagline: {
      fr: "Calcul et déclaration des charges sociales et fiscales.",
      en: "Computation and filing of social and tax charges.",
    },
    description: {
      fr: "Calcul automatique de vos cotisations sociales (URSSAF) et déclarations fiscales (TVA, IS). Calendrier des échéances et alertes.",
      en: "Automatic computation of your social charges (URSSAF) and tax filings (VAT, corporate tax). Deadline calendar and alerts.",
    },
    features: [
      { fr: "Calcul URSSAF micro-entreprise / réel", en: "URSSAF computation micro / real" },
      { fr: "Déclaration TVA mensuelle ou trimestrielle", en: "Monthly or quarterly VAT filing" },
      { fr: "Calendrier des échéances", en: "Deadline calendar" },
      { fr: "Alertes avant date limite", en: "Pre-deadline alerts" },
    ],
    howTo: [
      { fr: "Vérifiez le récapitulatif du trimestre en cours.", en: "Check the current quarter summary." },
      { fr: "Cliquez sur \"Préparer la déclaration\" à l'approche de l'échéance.", en: "Click \"Prepare filing\" as the deadline approaches." },
    ],
  },

  // ========== ADMIN ==========
  {
    route: "/users",
    group: "admin",
    icon: Users,
    title: { fr: "Utilisateurs", en: "Users" },
    tagline: {
      fr: "Gestion des accès et des rôles.",
      en: "Access and role management.",
    },
    description: {
      fr: "Invitez vos collaborateurs, définissez leurs rôles (USER, ADMIN, SUPER_ADMIN, ROOT_ADMIN), gérez les permissions module par module.",
      en: "Invite your collaborators, define their roles (USER, ADMIN, SUPER_ADMIN, ROOT_ADMIN), manage module-by-module permissions.",
    },
    features: [
      { fr: "Invitation par email", en: "Email invitation" },
      { fr: "4 niveaux de rôles", en: "4 role levels" },
      { fr: "Permissions granulaires", en: "Granular permissions" },
      { fr: "Audit des actions", en: "Action audit log" },
    ],
    howTo: [
      { fr: "\"Nouvel utilisateur\" puis renseignez l'email et le rôle.", en: "\"New user\" then fill in email and role." },
      { fr: "L'invitation est envoyée par email.", en: "The invitation is sent by email." },
    ],
  },
  {
    route: "/settings",
    group: "admin",
    icon: Settings,
    title: { fr: "Paramètres", en: "Settings" },
    tagline: {
      fr: "Configuration de votre profil et de l'application.",
      en: "Profile and application configuration.",
    },
    description: {
      fr: "Profil utilisateur, préférences (langue, thème), notifications, intégrations (Gemini, Mindee, Open Banking), sauvegarde des données.",
      en: "User profile, preferences (language, theme), notifications, integrations (Gemini, Mindee, Open Banking), data backup.",
    },
    features: [
      { fr: "Profil et mot de passe", en: "Profile and password" },
      { fr: "Préférences linguistiques", en: "Language preferences" },
      { fr: "Configuration des intégrations", en: "Integration configuration" },
      { fr: "Sauvegarde et export", en: "Backup and export" },
    ],
    howTo: [
      { fr: "Onglets en haut pour naviguer entre les sections.", en: "Top tabs to navigate between sections." },
    ],
  },
  {
    route: "/applications",
    group: "admin",
    icon: Building2,
    title: { fr: "Applications", en: "Applications" },
    tagline: {
      fr: "Multi-entreprises sous un même compte.",
      en: "Multi-business under one account.",
    },
    description: {
      fr: "Créez plusieurs \"applications\" (entreprises, succursales, projets) cloisonnées avec leur propre comptabilité, leurs propres utilisateurs et leur propre branding.",
      en: "Create multiple \"applications\" (businesses, branches, projects) compartmentalized with their own accounting, users and branding.",
    },
    features: [
      { fr: "Cloisonnement total des données", en: "Total data isolation" },
      { fr: "Branding par application (logo, couleurs)", en: "Per-application branding (logo, colors)" },
      { fr: "Bascule rapide via le sélecteur du sidebar", en: "Quick switch via the sidebar picker" },
    ],
    howTo: [
      { fr: "\"Nouvelle application\" puis configurez son nom et son logo.", en: "\"New application\" then configure name and logo." },
    ],
    roles: ["SUPER_ADMIN", "ROOT_ADMIN"],
  },
  {
    route: "/api-manager",
    group: "admin",
    icon: KeyRound,
    title: { fr: "Gestion API", en: "API Manager" },
    tagline: {
      fr: "Clés API et intégrations externes.",
      en: "API keys and external integrations.",
    },
    description: {
      fr: "Générez des clés API pour intégrer Budget By MyTools dans vos autres outils (CRM, ERP, e-commerce). Documentation Swagger intégrée.",
      en: "Generate API keys to integrate Budget By MyTools into your other tools (CRM, ERP, e-commerce). Built-in Swagger documentation.",
    },
    features: [
      { fr: "Génération de clés API", en: "API key generation" },
      { fr: "Limitation par scope", en: "Scope limitation" },
      { fr: "Documentation Swagger /api/docs", en: "Swagger docs at /api/docs" },
      { fr: "Logs d'appels", en: "Call logs" },
    ],
    howTo: [
      { fr: "\"Générer une clé\" puis sélectionnez les permissions.", en: "\"Generate a key\" then pick permissions." },
      { fr: "Copiez la clé immédiatement (elle ne sera plus affichée).", en: "Copy the key immediately (it won't be shown again)." },
    ],
    roles: ["SUPER_ADMIN", "ROOT_ADMIN"],
  },
  {
    route: "/root-admin",
    group: "admin",
    icon: ShieldAlert,
    title: { fr: "Super Dashboard", en: "Super Dashboard" },
    tagline: {
      fr: "Console technique réservée au ROOT_ADMIN.",
      en: "Technical console reserved for ROOT_ADMIN.",
    },
    description: {
      fr: "Vue système globale : santé de la base, utilisateurs actifs, jobs cron, intégrations, logs d'erreurs.",
      en: "Global system view: database health, active users, cron jobs, integrations, error logs.",
    },
    features: [
      { fr: "Métriques système", en: "System metrics" },
      { fr: "Logs et alertes", en: "Logs and alerts" },
      { fr: "Maintenance et nettoyage", en: "Maintenance and cleanup" },
    ],
    howTo: [
      { fr: "Réservé au profil ROOT_ADMIN.", en: "Reserved for ROOT_ADMIN profile." },
    ],
    roles: ["ROOT_ADMIN"],
  },

  // ========== HELP ==========
  {
    route: "/help",
    group: "help",
    icon: HelpCircle,
    title: { fr: "Centre d'aide", en: "Help Center" },
    tagline: {
      fr: "Documentation interactive de tous les modules.",
      en: "Interactive documentation of all modules.",
    },
    description: {
      fr: "Découvrez toutes les fonctionnalités, suivez la visite guidée, consultez le glossaire comptable et trouvez les réponses aux questions fréquentes.",
      en: "Discover all features, follow the guided tour, consult the accounting glossary and find answers to FAQs.",
    },
    features: [
      { fr: "Documentation par module", en: "Per-module documentation" },
      { fr: "Visite guidée interactive", en: "Interactive guided tour" },
      { fr: "Glossaire comptable", en: "Accounting glossary" },
      { fr: "FAQ", en: "FAQ" },
    ],
    howTo: [
      { fr: "Parcourez les onglets : Démarrer, Modules, Glossaire, FAQ.", en: "Browse the tabs: Get Started, Modules, Glossary, FAQ." },
      { fr: "Cliquez sur \"Lancer la visite guidée\" pour un tour interactif.", en: "Click \"Start guided tour\" for an interactive walkthrough." },
    ],
  },
];

export const GLOSSARY: { term: LocalizedString; definition: LocalizedString }[] = [
  {
    term: { fr: "CA (Chiffre d'affaires)", en: "Revenue" },
    definition: {
      fr: "Total des ventes hors taxes sur une période donnée. Calculé à partir des factures émises.",
      en: "Total tax-excluded sales over a given period. Computed from issued invoices.",
    },
  },
  {
    term: { fr: "TVA", en: "VAT" },
    definition: {
      fr: "Taxe sur la Valeur Ajoutée. Taux marocains : 0%, 7%, 10%, 14%, 20%. Collectée sur les ventes, déductible sur les achats.",
      en: "Value Added Tax. Moroccan rates: 0%, 7%, 10%, 14%, 20%. Collected on sales, deductible on purchases.",
    },
  },
  {
    term: { fr: "HT / TTC", en: "Excl. VAT / Incl. VAT" },
    definition: {
      fr: "HT = Hors Taxes (avant TVA). TTC = Toutes Taxes Comprises (TVA incluse).",
      en: "Excl. VAT = before VAT. Incl. VAT = with VAT included.",
    },
  },
  {
    term: { fr: "Partie double", en: "Double-entry" },
    definition: {
      fr: "Principe comptable : chaque opération impacte au moins deux comptes (un au débit, un au crédit) pour un montant égal.",
      en: "Accounting principle: each operation impacts at least two accounts (one debit, one credit) for an equal amount.",
    },
  },
  {
    term: { fr: "Lettrage", en: "Matching" },
    definition: {
      fr: "Action de relier un paiement à la facture correspondante pour solder l'écriture.",
      en: "Action of linking a payment to its corresponding invoice to clear the entry.",
    },
  },
  {
    term: { fr: "Bilan", en: "Balance Sheet" },
    definition: {
      fr: "Photographie du patrimoine de l'entreprise à une date donnée : actif (ce qu'elle possède) et passif (ce qu'elle doit).",
      en: "Snapshot of the company's assets and liabilities at a given date.",
    },
  },
  {
    term: { fr: "Compte de résultat", en: "P&L Statement" },
    definition: {
      fr: "Récapitulatif des produits et charges sur une période. Différence = bénéfice ou perte.",
      en: "Summary of revenues and expenses over a period. Difference = profit or loss.",
    },
  },
  {
    term: { fr: "URSSAF", en: "URSSAF" },
    definition: {
      fr: "Organisme français collectant les cotisations sociales. Au Maroc : CNSS.",
      en: "French social charges collector. In Morocco: CNSS.",
    },
  },
  {
    term: { fr: "FEC", en: "Standard Accounting File" },
    definition: {
      fr: "Fichier des Écritures Comptables : format standard exigé en cas de contrôle fiscal.",
      en: "Standard format required for tax audits.",
    },
  },
  {
    term: { fr: "DSP2 / Open Banking", en: "PSD2 / Open Banking" },
    definition: {
      fr: "Directive européenne permettant la connexion sécurisée à vos comptes bancaires via API.",
      en: "European directive enabling secure connection to your bank accounts via API.",
    },
  },
  {
    term: { fr: "OCR", en: "OCR" },
    definition: {
      fr: "Reconnaissance Optique de Caractères : extraction automatique de texte depuis une image ou un PDF.",
      en: "Optical Character Recognition: automatic text extraction from an image or PDF.",
    },
  },
  {
    term: { fr: "Avoir", en: "Credit Note" },
    definition: {
      fr: "Document inverse d'une facture, utilisé pour rembourser ou corriger une vente.",
      en: "Reverse document of an invoice, used to refund or correct a sale.",
    },
  },
];

export const FAQ: { question: LocalizedString; answer: LocalizedString }[] = [
  {
    question: { fr: "Comment créer ma première facture ?", en: "How do I create my first invoice?" },
    answer: {
      fr: "Allez dans Ventes → Factures clients, cliquez sur \"Nouvelle facture\", sélectionnez un client (créez-en un si besoin), ajoutez les lignes de produits/services avec leur TVA, puis validez et envoyez par email.",
      en: "Go to Sales → Client Invoices, click \"New invoice\", pick a client (create one if needed), add product/service lines with their VAT, then validate and send by email.",
    },
  },
  {
    question: { fr: "Comment scanner une facture papier ?", en: "How do I scan a paper invoice?" },
    answer: {
      fr: "Allez dans Achats → Scan OCR, glissez-déposez le PDF ou prenez une photo. L'IA extrait fournisseur, montants et TVA. Vérifiez puis validez pour créer la dépense.",
      en: "Go to Purchases → OCR Scan, drag-drop the PDF or take a photo. AI extracts supplier, amounts and VAT. Verify then validate to create the expense.",
    },
  },
  {
    question: { fr: "Mes données sont-elles sauvegardées ?", en: "Is my data backed up?" },
    answer: {
      fr: "Oui, sauvegarde quotidienne automatique sur PostgreSQL. Vous pouvez aussi exporter manuellement depuis Paramètres → Sauvegarde.",
      en: "Yes, automatic daily backup on PostgreSQL. You can also manually export from Settings → Backup.",
    },
  },
  {
    question: { fr: "Puis-je gérer plusieurs entreprises ?", en: "Can I manage multiple businesses?" },
    answer: {
      fr: "Oui, avec un rôle SUPER_ADMIN ou ROOT_ADMIN vous pouvez créer plusieurs Applications cloisonnées et basculer entre elles via le sélecteur du sidebar.",
      en: "Yes, with a SUPER_ADMIN or ROOT_ADMIN role you can create multiple isolated Applications and switch between them via the sidebar picker.",
    },
  },
  {
    question: { fr: "Comment inviter un collaborateur ?", en: "How do I invite a collaborator?" },
    answer: {
      fr: "Administration → Utilisateurs → \"Nouvel utilisateur\". Entrez son email et son rôle, l'invitation est envoyée automatiquement.",
      en: "Administration → Users → \"New user\". Enter their email and role, the invitation is sent automatically.",
    },
  },
  {
    question: { fr: "Comment connecter ma banque ?", en: "How do I connect my bank?" },
    answer: {
      fr: "Trésorerie → Open Banking → \"Connecter une banque\". Suivez l'authentification DSP2 sécurisée. Les transactions sont importées quotidiennement.",
      en: "Treasury → Open Banking → \"Connect a bank\". Follow the secure PSD2 authentication. Transactions are imported daily.",
    },
  },
  {
    question: { fr: "Quels taux de TVA sont supportés ?", en: "Which VAT rates are supported?" },
    answer: {
      fr: "Les taux marocains : 0%, 7%, 10%, 14% et 20%. Configurables par produit/service.",
      en: "Moroccan rates: 0%, 7%, 10%, 14% and 20%. Configurable per product/service.",
    },
  },
  {
    question: { fr: "Y a-t-il une application mobile ?", en: "Is there a mobile app?" },
    answer: {
      fr: "Oui, une application Expo native (iOS/Android) synchronisée en temps réel avec la PWA web.",
      en: "Yes, a native Expo app (iOS/Android) synchronized in real-time with the web PWA.",
    },
  },
];

export const QUICK_START: { step: number; title: LocalizedString; description: LocalizedString; route?: string }[] = [
  {
    step: 1,
    title: { fr: "Configurez votre entreprise", en: "Configure your business" },
    description: {
      fr: "Allez dans Paramètres et renseignez votre raison sociale, SIRET, adresse et logo.",
      en: "Go to Settings and fill in your company name, registration, address and logo.",
    },
    route: "/settings",
  },
  {
    step: 2,
    title: { fr: "Créez votre premier client", en: "Create your first client" },
    description: {
      fr: "Ventes → Clients → Nouveau client. Renseignez ses coordonnées pour pouvoir lui facturer.",
      en: "Sales → Clients → New client. Fill in their details to invoice them.",
    },
    route: "/clients",
  },
  {
    step: 3,
    title: { fr: "Émettez votre première facture", en: "Issue your first invoice" },
    description: {
      fr: "Ventes → Factures clients → Nouvelle facture. Sélectionnez le client, ajoutez les lignes, validez.",
      en: "Sales → Client Invoices → New invoice. Pick the client, add lines, validate.",
    },
    route: "/invoices",
  },
  {
    step: 4,
    title: { fr: "Enregistrez une dépense par OCR", en: "Record an expense via OCR" },
    description: {
      fr: "Achats → Scan OCR. Glissez une facture fournisseur, l'IA fait le reste.",
      en: "Purchases → OCR Scan. Drag a supplier invoice, AI does the rest.",
    },
    route: "/ocr-scan",
  },
  {
    step: 5,
    title: { fr: "Suivez votre activité", en: "Monitor your business" },
    description: {
      fr: "Tableau de Bord pour la vue rapide, Analyses avancées pour les rapports détaillés.",
      en: "Dashboard for the quick view, Advanced Analytics for detailed reports.",
    },
    route: "/",
  },
];

export { Compass, GraduationCap, HelpCircle };
