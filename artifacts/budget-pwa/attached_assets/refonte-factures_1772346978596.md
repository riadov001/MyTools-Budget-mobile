# Refonte complète du système Factures

---

## A. Correction critique — StatusBadge

**Fichier** : `client/src/components/status-badge.tsx`

Le composant `StatusBadge` crashe (page blanche) quand il reçoit un statut non reconnu. Appliquer ces modifications :

### A1. Élargir le type StatusType pour inclure tous les statuts utilisés dans la BDD :

| Statut | Label FR | Classe CSS |
|---|---|---|
| `draft` | Brouillon | `bg-slate-400 text-white border-slate-500` |
| `pending` | En attente | `bg-sky-500 text-white border-sky-600` |
| `approved` | Approuvé | `bg-emerald-500 text-white border-emerald-600` |
| `accepted` | Accepté | `bg-emerald-600 text-white border-emerald-700` |
| `rejected` | Refusé | `bg-rose-500 text-white border-rose-600` |
| `completed` | Terminé | `bg-slate-500 text-white border-slate-600` |
| `cancelled` | Annulé | `bg-rose-500 text-white border-rose-600` |
| `paid` | Payée | `bg-emerald-500 text-white border-emerald-600` |
| `overdue` | En retard | `bg-rose-600 text-white border-rose-700` |
| `confirmed` | Confirmée | `bg-emerald-500 text-white border-emerald-600` |
| `sent` | Envoyée | `bg-blue-500 text-white border-blue-600` |
| `issued` | Émis | `bg-blue-500 text-white border-blue-600` |
| `refunded` | Remboursé | `bg-amber-500 text-white border-amber-600` |
| `signed` | Signé | `bg-emerald-500 text-white border-emerald-600` |
| `in_progress` | En cours | `bg-amber-500 text-white border-amber-600` |
| `finalized` | Finalisé | `bg-emerald-600 text-white border-emerald-700` |

### A2. Ajouter un fallback pour les statuts inconnus :

```ts
const fallbackConfig = { label: "Inconnu", className: "bg-gray-400 text-white border-gray-500" };
```

### A3. Changer le type du prop `status` :

- De : `status: StatusType` (union stricte)
- Vers : `status: string`
- Utiliser : `statusConfig[status as StatusType] || fallbackConfig`

---

## B. Sélection de service dans la facture directe

**Fichier** : `client/src/pages/admin-invoices.tsx`

### B1. Nouveaux états à déclarer

Ajouter après les états existants (`invoiceMediaFiles`, etc.) :

```ts
const [selectedServiceId, setSelectedServiceId] = useState<string>("custom");
const [customServiceName, setCustomServiceName] = useState("");
```

### B2. Interface utilisateur

Dans le dialog "Créer une Facture Directe", ajouter une section **"Service"** positionnée **entre la section Client et la section "Lignes de facture"** :

- Un `<Select>` contenant :
  - `<SelectItem value="custom">Saisie libre (service personnalisé)</SelectItem>`
  - Les services actifs depuis `servicesList` (query `/api/admin/services`) au format : `NomService - XX.XX€ HT`
- Quand un service existant est sélectionné :
  - Stocker son nom dans `customServiceName`
  - Si la première ligne de facture est vide (pas de description), pré-remplir automatiquement `description` et `unitPrice` avec `svc.name` et `svc.basePrice`
- Quand "Saisie libre" est sélectionné :
  - Afficher un `<Input>` pour taper un nom de service personnalisé
  - Réinitialiser `customServiceName` à `""`

### B3. Envoi des données

Dans le handler `onClick` du bouton "Créer la Facture", avant l'appel à `createDirectInvoiceMutation.mutate(...)` :

```ts
const serviceName = selectedServiceId !== "custom"
  ? servicesList.find((s: any) => s.id === selectedServiceId)?.name || customServiceName
  : customServiceName;
```

Ajouter dans l'objet envoyé à la mutation :

```ts
productDetails: serviceName || null,
```

### B4. Réinitialisation après succès

Dans le `onSuccess` de `createDirectInvoiceMutation`, ajouter :

```ts
setSelectedServiceId("custom");
setCustomServiceName("");
```

Supprimer toute référence à `setInvoiceAmount("")` et `setInvoiceProductDetails("")` (états inexistants qui causent un crash silencieux).

---

## C. Structure BDD Factures (référence, pas de modification)

### Tables principales

#### `invoices`
| Champ | Type | Description |
|---|---|---|
| `id` | varchar PK | UUID auto-généré |
| `garageId` | varchar FK → garages | Multi-tenant |
| `quoteId` | varchar FK → quotes | Nullable (direct = sans devis) |
| `clientId` | varchar FK → users | Nullable (client ponctuel) |
| `invoiceNumber` | varchar(50) UNIQUE | Format `FACT-DD-MM-XXX` |
| `amount` | decimal(10,2) | Montant TTC |
| `paymentMethod` | enum | `cash`, `wire_transfer`, `card`, `stripe`, `sepa`, `klarna`, `alma` |
| `wheelCount` | integer | Nombre de jantes |
| `diameter` | varchar(50) | Diamètre en pouces |
| `priceExcludingTax` | decimal(10,2) | Montant HT |
| `taxRate` | decimal(5,2) | Taux TVA |
| `taxAmount` | decimal(10,2) | Montant TVA |
| `productDetails` | text | Nom du service associé |
| `status` | enum | `draft`, `pending`, `sent`, `paid`, `overdue`, `cancelled` |
| `customerName` | varchar(255) | Client non enregistré |
| `customerEmail` | varchar(255) | Client non enregistré |
| `customerAddress` | text | Client non enregistré |
| `customerPhone` | varchar(50) | Client non enregistré |
| `stripeSessionId` | varchar(255) | ID session Stripe |
| `stripePaymentIntentId` | varchar(255) | ID paiement Stripe |
| `paymentLink` | varchar(500) | Lien de paiement |
| `dueDate` | timestamp | Date d'échéance |
| `paidAt` | timestamp | Date de paiement |
| `viewToken` | varchar(64) UNIQUE | Token accès public |
| `emailSentAt` | timestamp | Date envoi email |
| `viewedAt` | timestamp | Date consultation client |
| `notes` | text | Notes internes |
| `createdAt` | timestamp | Auto |
| `updatedAt` | timestamp | Auto |

#### `invoice_items`
| Champ | Type | Description |
|---|---|---|
| `id` | varchar PK | UUID auto-généré |
| `invoiceId` | varchar FK → invoices | CASCADE |
| `description` | text NOT NULL | Libellé |
| `quantity` | decimal(10,2) | Quantité (défaut: 1) |
| `unitPriceExcludingTax` | decimal(10,2) | Prix unitaire HT |
| `totalExcludingTax` | decimal(10,2) | Total HT |
| `taxRate` | decimal(5,2) | Taux TVA |
| `taxAmount` | decimal(10,2) | Montant TVA |
| `totalIncludingTax` | decimal(10,2) | Total TTC |

#### `invoice_media`
| Champ | Type | Description |
|---|---|---|
| `id` | varchar PK | UUID auto-généré |
| `invoiceId` | varchar FK → invoices | CASCADE |
| `fileType` | enum | `image`, `video` |
| `filePath` | varchar(500) | Chemin fichier |
| `fileName` | varchar(255) | Nom fichier |
| `fileSize` | integer | Taille en octets |

#### `invoice_counters`
| Champ | Type | Description |
|---|---|---|
| `id` | varchar PK | UUID auto-généré |
| `paymentType` | enum UNIQUE | `cash`, `wire_transfer`, `card` |
| `currentNumber` | integer | Compteur séquentiel |

#### `delivery_notes` (Bons de Livraison)
| Champ | Type | Description |
|---|---|---|
| `id` | varchar PK | UUID auto-généré |
| `garageId` | varchar FK → garages | Multi-tenant |
| `clientId` | varchar FK → users | CASCADE |
| `deliveryNoteNumber` | varchar(50) UNIQUE | Format BLV-MM-XXXX |
| `month` / `year` | integer | Période |
| `totalAmount` / `totalHT` / `totalTVA` | decimal(10,2) | Montants |
| `status` | enum | `draft`, `finalized`, `paid` |
| `showPrices` | boolean | Afficher les prix |
| `notes` | text | Notes |

#### `delivery_note_invoices` (jonction BL / Factures)
| Champ | Type |
|---|---|
| `deliveryNoteId` | varchar FK → delivery_notes CASCADE |
| `invoiceId` | varchar FK → invoices CASCADE |

---

## D. Routes API Factures

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/admin/invoices` | Liste toutes les factures |
| `POST` | `/api/admin/invoices` | Créer depuis un devis |
| `POST` | `/api/admin/invoices/direct` | Créer sans devis (facture directe) |
| `GET` | `/api/admin/invoices/:id` | Détail d'une facture |
| `PATCH` | `/api/admin/invoices/:id` | Modifier une facture |
| `DELETE` | `/api/admin/invoices/:id` | Supprimer (admin only) |
| `POST` | `/api/admin/invoices/:id/items` | Ajouter des lignes |
| `POST` | `/api/admin/invoices/:id/media` | Upload photos/vidéos |
| `POST` | `/api/admin/invoices/:id/send-email` | Envoi par email |
| `GET` | `/api/invoices/:id/pdf` | Données pour PDF |
| `GET` | `/api/invoices/:id/facturx` | Export XML Factur-X |
| `GET` | `/facture/:id` | Vue publique client |

---

## E. Transitions de statut

```
draft --> pending --> sent --> paid
                          --> overdue --> paid
                                     --> cancelled
draft --> cancelled
pending --> cancelled
sent --> cancelled
```

- **draft -> pending** : Admin finalise la facture
- **pending -> sent** : Email envoyé au client (auto via `send-email`)
- **sent -> paid** : Webhook Stripe (`checkout.session.completed` ou `payment_intent.succeeded`) ou marquage manuel
- **-> overdue** : Détecté par le scheduler (`notificationScheduler.ts`) toutes les 5 min si `dueDate` dépassée
- **-> cancelled** : Action manuelle admin

**Effets secondaires du passage à `paid`** :
- Met à jour `paidAt` et `stripePaymentIntentId`
- Crée une écriture comptable dans le journal `sales`
- Envoie notification (app + email + SMS)
- Envoie WebSocket `payment_confirmed`
- Crée un token de review pour feedback client
- Audit log : "Facture marquée comme payée"

---

## F. Fichiers impactés par les modifications

| Fichier | Modification |
|---|---|
| `client/src/components/status-badge.tsx` | Ajout statuts + fallback + type string |
| `client/src/pages/admin-invoices.tsx` | Sélecteur service + cleanup états |
| `shared/schema.ts` | Aucune (lecture seule, référence) |
| `server/routes.ts` | Aucune (`productDetails` déjà géré par `insertInvoiceSchema.parse()`) |
