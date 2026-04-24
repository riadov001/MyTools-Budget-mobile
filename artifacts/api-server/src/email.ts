import { Resend } from "resend";

const FROM = "MyTools Budget Tracker <contact@app.mytoolsgroup.eu>";
const BACKUP_FROM = "MyTools Budget Tracker <contact@myjantes.mytoolsgroup.eu>";

// Fixed recipients for MyJantes
export const MYJANTES_EMAIL = "contact@myjantes.com";
export const SUPERADMIN_EMAIL = "rbelmahi90@gmail.com";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY || "re_placeholder";
  if (!key || key === "re_placeholder") {
    console.warn("RESEND_API_KEY non configurée - Les emails ne seront pas envoyés");
    return {
      emails: {
        send: async () => ({ data: { id: "mock-id" }, error: null })
      }
    } as any;
  }
  return new Resend(key);
}

async function sendEmail(opts: { 
  to: string | string[]; 
  subject: string; 
  html: string; 
  cc?: string[];
}) {
  const resend = getResend();
  
  // Try with primary sender
  const primaryResult = await resend.emails.send({
    from: FROM,
    to: opts.to,
    cc: opts.cc,
    subject: opts.subject,
    html: opts.html,
  });

  if (primaryResult.error) {
    console.error("Primary email failed, trying backup:", primaryResult.error);
    // Try with backup sender
    return resend.emails.send({
      from: BACKUP_FROM,
      to: opts.to,
      cc: opts.cc,
      subject: opts.subject,
      html: opts.html,
    });
  }

  return primaryResult;
}

// ─── Templates ────────────────────────────────────────────────────────────────

function baseTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: #111; padding: 28px 32px; display: flex; align-items: center; gap: 12px; }
    .header h1 { color: #fff; font-size: 18px; margin: 0; }
    .header span { color: #dc2626; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
    .body { padding: 32px; }
    .body h2 { color: #111; font-size: 20px; margin: 0 0 12px; }
    .body p { color: #555; font-size: 14px; line-height: 1.6; margin: 0 0 16px; }
    .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .table th { background: #f5f5f5; padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; }
    .table td { padding: 12px 14px; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #333; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .badge-red { background: #fef2f2; color: #dc2626; }
    .badge-green { background: #f0fdf4; color: #16a34a; }
    .badge-blue { background: #eff6ff; color: #2563eb; }
    .badge-orange { background: #fff7ed; color: #c2410c; }
    .btn { display: inline-block; background: #dc2626; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 12px; }
    .footer { padding: 20px 32px; background: #fafafa; border-top: 1px solid #f0f0f0; font-size: 11px; color: #aaa; }
    .amount { font-weight: 700; font-size: 15px; color: #111; }
    .alert-box { background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 16px 0; }
    .success-box { background: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 16px 0; }
    .info-box { background: #eff6ff; border-left: 4px solid #2563eb; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>MyTools</h1>
        <span>Budget Tracker</span>
      </div>
    </div>
    <div class="body">
      ${body}
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} MyTools Budget Tracker — Tous droits réservés.<br/>
      Cet email a été envoyé automatiquement, merci de ne pas y répondre.
    </div>
  </div>
</body>
</html>`;
}

// ─── Send functions ────────────────────────────────────────────────────────────

export async function sendUpcomingPaymentAlert(opts: {
  to: string;
  userName: string;
  services: Array<{ name: string; cost: string; currency: string; daysUntil: number; nextBillingDate: string }>;
  cc?: string[];
}) {
  const rows = opts.services.map(s => `
    <tr>
      <td>${s.name}</td>
      <td><span class="amount">${parseFloat(s.cost).toFixed(2)} ${s.currency}</span></td>
      <td>${s.nextBillingDate}</td>
      <td><span class="badge badge-red">J-${s.daysUntil}</span></td>
    </tr>
  `).join("");

  const total = opts.services.reduce((sum, s) => sum + parseFloat(s.cost), 0);

  const body = `
    <h2>Rappel : Abonnements SaaS à venir</h2>
    <p>Bonjour <strong>${opts.userName}</strong>,</p>
    <p>Les abonnements suivants vont être prélevés prochainement :</p>
    <div class="alert-box">
      <strong>Total à venir :</strong> ${total.toFixed(2)} € sur ${opts.services.length} service(s)
    </div>
    <table class="table">
      <thead><tr><th>Service</th><th>Montant</th><th>Date</th><th>Délai</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p>Assurez-vous que vos moyens de paiement sont à jour pour éviter toute interruption de service.</p>
  `;

  return sendEmail({
    to: opts.to,
    cc: opts.cc,
    subject: `⚠️ ${opts.services.length} abonnement(s) à renouveler — Total ${total.toFixed(2)} €`,
    html: baseTemplate("Rappel abonnements SaaS", body),
  });
}

export async function sendSupplierInvoiceDueReminder(opts: {
  invoiceNumber: string;
  supplierName: string;
  total: string;
  currency: string;
  dueDate: string;
  hoursUntilDue: number;
}) {
  const body = `
    <h2>Rappel d'échéance : Facture fournisseur</h2>
    <p>Bonjour,</p>
    <p>La facture fournisseur suivante arrive à échéance dans <strong>${opts.hoursUntilDue}h</strong> :</p>
    <div class="alert-box">
      <strong>Action requise :</strong> Facture ${opts.invoiceNumber} de ${opts.supplierName} — ${parseFloat(opts.total).toFixed(2)} ${opts.currency}
    </div>
    <table class="table">
      <tr><td><strong>N° Facture</strong></td><td><span style="font-family:monospace;font-weight:bold;color:#dc2626">${opts.invoiceNumber}</span></td></tr>
      <tr><td><strong>Fournisseur</strong></td><td>${opts.supplierName}</td></tr>
      <tr><td><strong>Montant TTC</strong></td><td class="amount">${parseFloat(opts.total).toFixed(2)} ${opts.currency}</td></tr>
      <tr><td><strong>Échéance</strong></td><td><span class="badge badge-red">${opts.dueDate}</span></td></tr>
    </table>
    <p>Veuillez procéder au règlement avant l'échéance pour éviter tout incident.</p>
  `;

  return sendEmail({
    to: MYJANTES_EMAIL,
    cc: [SUPERADMIN_EMAIL],
    subject: `⏰ Rappel 48h — Facture ${opts.invoiceNumber} (${opts.supplierName}) — ${parseFloat(opts.total).toFixed(2)} ${opts.currency}`,
    html: baseTemplate("Rappel échéance facture fournisseur", body),
  });
}

export async function sendSupplierInvoicePaidNotification(opts: {
  invoiceNumber: string;
  supplierName: string;
  total: string;
  currency: string;
  paidDate: string;
}) {
  const body = `
    <h2>Paiement enregistré — Facture fournisseur</h2>
    <p>Bonjour,</p>
    <p>Le paiement de la facture fournisseur suivante a été enregistré avec succès :</p>
    <div class="success-box">
      <strong>✅ Paiement confirmé :</strong> Facture ${opts.invoiceNumber} — ${parseFloat(opts.total).toFixed(2)} ${opts.currency}
    </div>
    <table class="table">
      <tr><td><strong>N° Facture</strong></td><td><span style="font-family:monospace;font-weight:bold;color:#16a34a">${opts.invoiceNumber}</span></td></tr>
      <tr><td><strong>Fournisseur</strong></td><td>${opts.supplierName}</td></tr>
      <tr><td><strong>Montant réglé</strong></td><td class="amount" style="color:#16a34a">${parseFloat(opts.total).toFixed(2)} ${opts.currency}</td></tr>
      <tr><td><strong>Date de paiement</strong></td><td><span class="badge badge-green">${opts.paidDate}</span></td></tr>
    </table>
  `;

  return sendEmail({
    to: MYJANTES_EMAIL,
    cc: [SUPERADMIN_EMAIL],
    subject: `✅ Paiement enregistré — Facture ${opts.invoiceNumber} (${opts.supplierName}) — ${parseFloat(opts.total).toFixed(2)} ${opts.currency}`,
    html: baseTemplate("Paiement facture fournisseur", body),
  });
}

export async function sendServicePaidNotification(opts: {
  serviceName: string;
  provider: string;
  amount: string;
  currency: string;
  paidDate: string;
}) {
  const body = `
    <h2>Abonnement réglé</h2>
    <p>Bonjour,</p>
    <p>Le paiement de l'abonnement suivant a été enregistré :</p>
    <div class="success-box">
      <strong>✅ Paiement confirmé :</strong> ${opts.serviceName} — ${parseFloat(opts.amount).toFixed(2)} ${opts.currency}
    </div>
    <table class="table">
      <tr><td><strong>Service</strong></td><td>${opts.serviceName}</td></tr>
      <tr><td><strong>Fournisseur</strong></td><td>${opts.provider}</td></tr>
      <tr><td><strong>Montant réglé</strong></td><td class="amount" style="color:#16a34a">${parseFloat(opts.amount).toFixed(2)} ${opts.currency}</td></tr>
      <tr><td><strong>Date de paiement</strong></td><td><span class="badge badge-green">${opts.paidDate}</span></td></tr>
    </table>
  `;

  return sendEmail({
    to: MYJANTES_EMAIL,
    cc: [SUPERADMIN_EMAIL],
    subject: `✅ Abonnement réglé — ${opts.serviceName} (${opts.provider}) — ${parseFloat(opts.amount).toFixed(2)} ${opts.currency}`,
    html: baseTemplate("Paiement abonnement", body),
  });
}

export async function sendInvoiceNotification(opts: {
  to: string;
  clientName: string;
  invoiceNumber: string;
  total: string;
  dueDate: string;
  status: "sent" | "paid" | "overdue";
}) {
  const statusLabel = { sent: "Envoyée", paid: "Payée", overdue: "En retard" }[opts.status];
  const statusBadge = { sent: "badge-blue", paid: "badge-green", overdue: "badge-red" }[opts.status];

  const body = `
    <h2>Facture ${opts.invoiceNumber}</h2>
    <p>Bonjour <strong>${opts.clientName}</strong>,</p>
    <p>Voici les informations concernant votre facture :</p>
    <table class="table">
      <tr><td><strong>Référence</strong></td><td>${opts.invoiceNumber}</td></tr>
      <tr><td><strong>Montant TTC</strong></td><td class="amount">${parseFloat(opts.total).toFixed(2)} €</td></tr>
      <tr><td><strong>Échéance</strong></td><td>${opts.dueDate}</td></tr>
      <tr><td><strong>Statut</strong></td><td><span class="badge ${statusBadge}">${statusLabel}</span></td></tr>
    </table>
    ${opts.status === "overdue" ? `<div class="alert-box">Cette facture est en retard de paiement. Merci de régulariser au plus vite.</div>` : ""}
  `;

  const subjectMap = {
    sent: `Facture ${opts.invoiceNumber} — ${parseFloat(opts.total).toFixed(2)} €`,
    paid: `✅ Paiement reçu — Facture ${opts.invoiceNumber}`,
    overdue: `⚠️ Facture en retard — ${opts.invoiceNumber}`,
  };

  return sendEmail({
    to: opts.to,
    subject: subjectMap[opts.status],
    html: baseTemplate(`Facture ${opts.invoiceNumber}`, body),
  });
}

export async function sendWelcomeEmail(opts: {
  to: string;
  name: string;
  appName: string;
}) {
  const body = `
    <h2>Bienvenue sur MyTools Budget Tracker 🎉</h2>
    <p>Bonjour <strong>${opts.name}</strong>,</p>
    <p>Votre compte a été créé avec succès sur l'instance <strong>${opts.appName}</strong>.</p>
    <p>Vous pouvez maintenant :</p>
    <ul style="color:#555;font-size:14px;line-height:2;">
      <li>Créer et envoyer des <strong>factures clients</strong></li>
      <li>Suivre vos <strong>dépenses et abonnements SaaS</strong></li>
      <li>Gérer votre <strong>comptabilité</strong> (journal, plan comptable)</li>
      <li>Exporter vos données en <strong>PDF et Excel</strong></li>
    </ul>
    <p>Pour toute question, contactez votre administrateur.</p>
  `;

  return sendEmail({
    to: opts.to,
    subject: `Bienvenue sur MyTools Budget Tracker — ${opts.appName}`,
    html: baseTemplate("Bienvenue", body),
  });
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  name: string;
  resetLink: string;
}) {
  const body = `
    <h2>Réinitialisation de mot de passe</h2>
    <p>Bonjour <strong>${opts.name}</strong>,</p>
    <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
    <p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
    <p><a href="${opts.resetLink}" class="btn">Réinitialiser mon mot de passe</a></p>
    <p style="color:#aaa;font-size:12px;">Ce lien est valable 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
  `;

  return sendEmail({
    to: opts.to,
    subject: "Réinitialisation de votre mot de passe — MyTools",
    html: baseTemplate("Réinitialisation mot de passe", body),
  });
}

export async function sendMonthlyReport(opts: {
  to: string;
  userName: string;
  month: string;
  revenue: number;
  expenses: number;
  expensesPaid?: number;
  expensesUnpaid?: number;
  expensesOverdue?: number;
  balance: number;
  invoiceCount: number;
  expenseCount: number;
}) {
  const paid = opts.expensesPaid ?? 0;
  const unpaid = opts.expensesUnpaid ?? 0;
  const overdue = opts.expensesOverdue ?? 0;

  const body = `
    <h2>Rapport mensuel — ${opts.month}</h2>
    <p>Bonjour <strong>${opts.userName}</strong>,</p>
    <p>Voici le résumé financier de votre activité pour <strong>${opts.month}</strong> :</p>
    <table class="table">
      <tr><td>💰 <strong>Revenus encaissés</strong></td><td class="amount" style="color:#16a34a">+${opts.revenue.toFixed(2)} €</td></tr>
      <tr><td>📉 <strong>Dépenses totales</strong></td><td class="amount" style="color:#dc2626">-${opts.expenses.toFixed(2)} €</td></tr>
      <tr><td>⚖️ <strong>Solde net</strong></td><td class="amount" style="color:${opts.balance >= 0 ? '#16a34a' : '#dc2626'}">${opts.balance >= 0 ? '+' : ''}${opts.balance.toFixed(2)} €</td></tr>
      <tr><td>📄 Factures émises</td><td>${opts.invoiceCount}</td></tr>
      <tr><td>🧾 Dépenses enregistrées</td><td>${opts.expenseCount}</td></tr>
    </table>
    <h3 style="margin:20px 0 8px;font-size:14px;color:#111">Détail des dépenses par statut</h3>
    <table class="table">
      <tr><td>✅ <strong>Déjà payées</strong></td><td class="amount" style="color:#16a34a">${paid.toFixed(2)} €</td></tr>
      <tr><td>⏳ <strong>Reste à payer</strong></td><td class="amount" style="color:#d97706">${unpaid.toFixed(2)} €</td></tr>
      <tr><td>⚠️ <strong>En retard</strong></td><td class="amount" style="color:#dc2626">${overdue.toFixed(2)} €</td></tr>
    </table>
    ${overdue > 0 ? `<div class="alert-box"><strong>Attention :</strong> Vous avez <strong>${overdue.toFixed(2)} €</strong> de dépenses en retard de paiement. Veuillez régulariser au plus vite.</div>` : ""}
  `;

  return sendEmail({
    to: opts.to,
    subject: `📊 Rapport ${opts.month} — MyTools Budget Tracker`,
    html: baseTemplate(`Rapport ${opts.month}`, body),
  });
}
