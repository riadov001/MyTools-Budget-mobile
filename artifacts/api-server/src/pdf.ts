import PDFDocument from "pdfkit";

const RED = "#dc2626";
const BLACK = "#111111";
const GRAY = "#888888";
const LIGHT = "#f5f5f5";
const WHITE = "#ffffff";
const GREEN = "#16a34a";
const AMBER = "#d97706";
const BLUE = "#2563eb";

function addHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc.rect(0, 0, doc.page.width, 80).fill(BLACK);
  doc.fontSize(22).font("Helvetica-Bold").fillColor(WHITE).text("My", 40, 22, { continued: true });
  doc.fillColor(RED).text("Tools", { continued: true });
  doc.fillColor(WHITE).text(" Budget Tracker", { lineBreak: false });
  doc.fontSize(9).font("Helvetica").fillColor(GRAY).text("Accounting & Finance SaaS", 40, 48);
  doc.fillColor(WHITE).fontSize(13).font("Helvetica-Bold").text(title, doc.page.width - 280, 22, { width: 240, align: "right" });
  doc.fillColor(GRAY).fontSize(9).font("Helvetica").text(subtitle, doc.page.width - 280, 45, { width: 240, align: "right" });
  doc.y = 100;
  doc.fillColor(BLACK);
}

function addFooter(doc: PDFKit.PDFDocument) {
  const pageHeight = doc.page.height;
  doc.rect(0, pageHeight - 40, doc.page.width, 40).fill(BLACK);
  doc.fillColor(GRAY).fontSize(8).font("Helvetica")
    .text(
      `© ${new Date().getFullYear()} MyTools Budget Tracker  •  Généré le ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}  •  Document confidentiel`,
      40,
      pageHeight - 26,
      { align: "center", width: doc.page.width - 80 }
    );
}

function kpiBox(doc: PDFKit.PDFDocument, x: number, y: number, w: number, label: string, value: string, color: string) {
  doc.rect(x, y, w, 56).fill(LIGHT);
  doc.rect(x, y, 3, 56).fill(color);
  doc.fillColor(GRAY).fontSize(8).font("Helvetica").text(label.toUpperCase(), x + 10, y + 10, { width: w - 16 });
  doc.fillColor(color).fontSize(17).font("Helvetica-Bold").text(value, x + 10, y + 26, { width: w - 16 });
}

function tableHeader(doc: PDFKit.PDFDocument, y: number, cols: { label: string; x: number; width: number; align?: "left" | "right" | "center" }[]) {
  doc.rect(40, y, doc.page.width - 80, 22).fill(BLACK);
  cols.forEach(col => {
    doc.fillColor(WHITE).fontSize(8).font("Helvetica-Bold")
      .text(col.label.toUpperCase(), col.x, y + 7, { width: col.width, align: col.align || "left" });
  });
  return y + 22;
}

function tableRow(doc: PDFKit.PDFDocument, y: number, even: boolean, cols: { text: string; x: number; width: number; align?: "left" | "right" | "center"; color?: string }[]) {
  if (even) doc.rect(40, y, doc.page.width - 80, 20).fill("#fafafa");
  cols.forEach(col => {
    doc.fillColor(col.color || BLACK).fontSize(9).font("Helvetica")
      .text(col.text, col.x, y + 5, { width: col.width, align: col.align || "left" });
  });
  doc.moveTo(40, y + 20).lineTo(doc.page.width - 40, y + 20).lineWidth(0.3).strokeColor("#e5e7eb").stroke();
  return y + 20;
}

export interface ExpenseRow {
  description: string;
  category: string;
  supplierName?: string | null;
  paymentMethod?: string | null;
  total: string | number;
  status: string;
  date: string | Date;
}

export interface InvoiceData {
  number: string;
  status: string;
  supplierName: string;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
  supplierAddress?: string | null;
  issuedDate: string | Date;
  dueDate: string | Date;
  subtotal: string | number;
  taxRate: string | number;
  taxAmount: string | number;
  total: string | number;
  currency: string;
  notes?: string | null;
  linkedServices?: string | null;
}

export interface DashboardData {
  totalRevenue: number;
  totalExpenses: number;
  expPaid: number;
  expUnpaid: number;
  expOverdue: number;
  monthlyServices: number;
  expenses: ExpenseRow[];
}

export async function generateExpensesPDF(expenses: ExpenseRow[]): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    addHeader(doc, "Rapport des Dépenses", `Généré le ${dateStr}`);
    // ... rest of the content (shortened for clarity but keep logic)
    // For brevity, I'll just wrap the existing logic in the promise
    const totalAmt = expenses.reduce((s, e) => s + parseFloat(String(e.total)), 0);
    const paidAmt = expenses.filter(e => e.status === "paid").reduce((s, e) => s + parseFloat(String(e.total)), 0);
    const unpaidAmt = expenses.filter(e => e.status === "unpaid").reduce((s, e) => s + parseFloat(String(e.total)), 0);

    const boxW = (doc.page.width - 80 - 24) / 3;
    kpiBox(doc, 40, doc.y, boxW, "Total Dépenses", `${totalAmt.toFixed(2)} €`, RED);
    kpiBox(doc, 40 + boxW + 12, doc.y, boxW, "Payées", `${paidAmt.toFixed(2)} €`, GREEN);
    kpiBox(doc, 40 + (boxW + 12) * 2, doc.y, boxW, "À Payer", `${unpaidAmt.toFixed(2)} €`, AMBER);
    doc.y += 72;

    doc.fillColor(BLACK).fontSize(11).font("Helvetica-Bold").text(`Dépenses (${expenses.length})`, 40, doc.y);
    doc.rect(40, doc.y + 16, 3, 14).fill(RED);
    doc.y += 20;

    const cols = [
      { label: "Description", x: 44, width: 160 },
      { label: "Catégorie", x: 208, width: 90 },
      { label: "Fournisseur", x: 302, width: 90 },
      { label: "Date", x: 396, width: 65 },
      { label: "Montant", x: 462, width: 65, align: "right" as const },
      { label: "Statut", x: 530, width: 50, align: "center" as const },
    ];

    let y = tableHeader(doc, doc.y, cols);
    expenses.forEach((e, i) => {
      if (y > doc.page.height - 80) {
        doc.addPage({ margin: 0 });
        addHeader(doc, "Rapport des Dépenses (suite)", `Page ${i}`);
        y = doc.y;
        y = tableHeader(doc, y, cols);
      }
      const statusLabel = e.status === "paid" ? "Payé" : e.status === "overdue" ? "En retard" : "À payer";
      const statusColor = e.status === "paid" ? GREEN : e.status === "overdue" ? RED : AMBER;
      const dateFormatted = e.date ? new Date(e.date).toLocaleDateString("fr-FR") : "—";
      y = tableRow(doc, y, i % 2 === 1, [
        { text: e.description.slice(0, 28), x: 44, width: 160 },
        { text: e.category || "—", x: 208, width: 90 },
        { text: (e.supplierName || "—").slice(0, 14), x: 302, width: 90 },
        { text: dateFormatted, x: 396, width: 65 },
        { text: `${parseFloat(String(e.total)).toFixed(2)} €`, x: 462, width: 65, align: "right", color: RED },
        { text: statusLabel, x: 530, width: 50, align: "center", color: statusColor },
      ]);
    });

    if (expenses.length === 0) {
      doc.fillColor(GRAY).fontSize(10).font("Helvetica-Oblique").text("Aucune dépense enregistrée.", 40, y + 8, { align: "center", width: doc.page.width - 80 });
    }

    addFooter(doc);
    doc.end();
  });
}

export async function generateDashboardPDF(data: DashboardData): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    addHeader(doc, "Rapport Financier", `Généré le ${dateStr}`);

    const boxW = (doc.page.width - 80 - 40) / 3;
    const row1Y = doc.y;
    kpiBox(doc, 40, row1Y, boxW, "Revenus Encaissés", `${data.totalRevenue.toFixed(2)} €`, GREEN);
    kpiBox(doc, 40 + boxW + 20, row1Y, boxW, "Dépenses Totales", `${data.totalExpenses.toFixed(2)} €`, RED);
    kpiBox(doc, 40 + (boxW + 20) * 2, row1Y, boxW, "Abonnements/mois", `${data.monthlyServices.toFixed(2)} €`, BLUE);
    const row2Y = row1Y + 68;
    const boxW2 = (doc.page.width - 80 - 20) / 2;
    kpiBox(doc, 40, row2Y, boxW2, "Dépenses Payées", `${data.expPaid.toFixed(2)} €`, GREEN);
    kpiBox(doc, 40 + boxW2 + 20, row2Y, boxW2, "En Attente / En Retard", `${(data.expUnpaid + data.expOverdue).toFixed(2)} €`, AMBER);
    doc.y = row2Y + 72;

    doc.fillColor(BLACK).fontSize(11).font("Helvetica-Bold").text(`Détail des Dépenses (${data.expenses.length})`, 40, doc.y);
    doc.y += 18;

    const cols = [
      { label: "Description", x: 44, width: 160 },
      { label: "Catégorie", x: 208, width: 80 },
      { label: "Fournisseur", x: 292, width: 90 },
      { label: "Mode Paiement", x: 386, width: 80 },
      { label: "Montant", x: 468, width: 65, align: "right" as const },
      { label: "Statut", x: 535, width: 45, align: "center" as const },
    ];

    let y = tableHeader(doc, doc.y, cols);
    data.expenses.forEach((e, i) => {
      if (y > doc.page.height - 80) {
        doc.addPage({ margin: 0 });
        addHeader(doc, "Rapport Financier (suite)", "");
        y = doc.y;
        y = tableHeader(doc, y, cols);
      }
      const statusLabel = e.status === "paid" ? "Payé" : e.status === "overdue" ? "Retard" : "À payer";
      const statusColor = e.status === "paid" ? GREEN : e.status === "overdue" ? RED : AMBER;
      y = tableRow(doc, y, i % 2 === 1, [
        { text: e.description.slice(0, 28), x: 44, width: 160 },
        { text: e.category || "—", x: 208, width: 80 },
        { text: (e.supplierName || "—").slice(0, 14), x: 292, width: 90 },
        { text: (e.paymentMethod || "—").slice(0, 12), x: 386, width: 80 },
        { text: `${parseFloat(String(e.total)).toFixed(2)} €`, x: 468, width: 65, align: "right", color: RED },
        { text: statusLabel, x: 535, width: 45, align: "center", color: statusColor },
      ]);
    });

    if (data.expenses.length === 0) {
      doc.fillColor(GRAY).fontSize(10).font("Helvetica-Oblique").text("Aucune dépense enregistrée.", 40, y + 8, { align: "center", width: doc.page.width - 80 });
    }

    addFooter(doc);
    doc.end();
  });
}

export async function generateSupplierInvoicePDF(inv: InvoiceData): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const statusMap: Record<string, string> = { pending: "À approuver", approved: "Approuvée", paid: "Payée", cancelled: "Annulée" };
    const statusColorMap: Record<string, string> = { pending: AMBER, approved: BLUE, paid: GREEN, cancelled: GRAY };
    const statusLabel = statusMap[inv.status] ?? inv.status;
    const statusColor = statusColorMap[inv.status] ?? GRAY;

    addHeader(doc, inv.number, `Facture Fournisseur`);

    doc.rect(40, doc.y, doc.page.width - 80, 1).fill(RED);
    doc.y += 12;

    const boxW = (doc.page.width - 80 - 16) / 2;

    doc.rect(40, doc.y, boxW, 90).fill(LIGHT);
    doc.fillColor(GRAY).fontSize(8).font("Helvetica").text("FOURNISSEUR", 52, doc.y + 10);
    doc.fillColor(BLACK).fontSize(13).font("Helvetica-Bold").text(inv.supplierName, 52, doc.y + 22, { width: boxW - 24 });
    if (inv.supplierEmail) doc.fillColor(GRAY).fontSize(9).font("Helvetica").text(inv.supplierEmail, 52, doc.y + 40, { width: boxW - 24 });
    if (inv.supplierPhone) doc.fillColor(GRAY).fontSize(9).text(inv.supplierPhone, 52, doc.y + 52, { width: boxW - 24 });

    doc.rect(40 + boxW + 16, doc.y, boxW, 90).fill(LIGHT);
    doc.fillColor(GRAY).fontSize(8).font("Helvetica").text("INFORMATIONS", 52 + boxW + 16, doc.y + 10);
    doc.fillColor(GRAY).fontSize(9).text("Date d'émission :", 52 + boxW + 16, doc.y + 26);
    doc.fillColor(BLACK).fontSize(9).font("Helvetica-Bold").text(new Date(inv.issuedDate).toLocaleDateString("fr-FR"), 52 + boxW + 110, doc.y + 26);
    doc.fillColor(GRAY).fontSize(9).font("Helvetica").text("Date d'échéance :", 52 + boxW + 16, doc.y + 42);
    doc.fillColor(RED).fontSize(9).font("Helvetica-Bold").text(new Date(inv.dueDate).toLocaleDateString("fr-FR"), 52 + boxW + 110, doc.y + 42);
    doc.fillColor(GRAY).fontSize(9).font("Helvetica").text("Statut :", 52 + boxW + 16, doc.y + 58);
    doc.fillColor(statusColor).fontSize(9).font("Helvetica-Bold").text(statusLabel, 52 + boxW + 110, doc.y + 58);

    doc.y += 106;

    const services: string[] = inv.linkedServices ? JSON.parse(inv.linkedServices) : [];
    const cols = [
      { label: "Service / Prestation", x: 44, width: 380 },
      { label: "Montant", x: 475, width: 80, align: "right" as const },
    ];
    let y = tableHeader(doc, doc.y, cols);
    if (services.length > 0) {
      services.forEach((s, i) => {
        y = tableRow(doc, y, i % 2 === 1, [
          { text: s, x: 44, width: 380 },
          { text: "—", x: 475, width: 80, align: "right" },
        ]);
      });
    } else {
      y = tableRow(doc, y, false, [
        { text: "Prestation principale", x: 44, width: 380 },
        { text: `${parseFloat(String(inv.subtotal)).toFixed(2)} ${inv.currency}`, x: 475, width: 80, align: "right" },
      ]);
    }

    y += 16;
    const totW = 260;
    const totX = doc.page.width - 40 - totW;
    doc.rect(totX, y, totW, 1).fill("#e5e7eb");
    y += 4;
    doc.fillColor(GRAY).fontSize(10).font("Helvetica").text("Montant HT :", totX, y);
    doc.fillColor(BLACK).fontSize(10).font("Helvetica-Bold").text(`${parseFloat(String(inv.subtotal)).toFixed(2)} ${inv.currency}`, totX, y, { width: totW, align: "right" });
    y += 18;
    doc.fillColor(GRAY).fontSize(10).font("Helvetica").text(`TVA (${inv.taxRate}%) :`, totX, y);
    doc.fillColor(BLACK).fontSize(10).font("Helvetica-Bold").text(`${parseFloat(String(inv.taxAmount)).toFixed(2)} ${inv.currency}`, totX, y, { width: totW, align: "right" });
    y += 8;
    doc.rect(totX, y, totW, 36).fill(BLACK);
    doc.fillColor(WHITE).fontSize(12).font("Helvetica-Bold").text("Total TTC :", totX + 12, y + 11);
    doc.fillColor(RED).fontSize(14).font("Helvetica-Bold").text(`${parseFloat(String(inv.total)).toFixed(2)} ${inv.currency}`, totX, y + 9, { width: totW - 12, align: "right" });

    if (inv.notes) {
      doc.y = y + 52;
      doc.rect(40, doc.y, doc.page.width - 80, 1).fill("#e5e7eb");
      doc.y += 10;
      doc.fillColor(GRAY).fontSize(8).font("Helvetica").text("NOTE :", 40, doc.y);
      doc.fillColor(BLACK).fontSize(9).text(inv.notes, 40, doc.y + 12, { width: doc.page.width - 80 });
    }

    addFooter(doc);
    doc.end();
  });
}
