import PDFDocument from "pdfkit";

const RED = "#dc2626";
const BLACK = "#111111";
const GRAY = "#6b7280";
const LIGHT = "#f8fafc";
const WHITE = "#ffffff";
const GREEN = "#16a34a";
const AMBER = "#d97706";
const BLUE = "#2563eb";

function addHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc.rect(0, 0, doc.page.width, 72).fill(WHITE);
  doc.rect(0, 0, doc.page.width, 4).fill(RED);
  try {
    doc.image("dist/public/logo.png", 32, 14, { width: 36, height: 36 });
  } catch {
    doc.roundedRect(32, 14, 36, 36, 8).fill(RED);
    doc.fillColor(WHITE).fontSize(12).font("Helvetica-Bold").text("MT", 37, 25, { width: 26, align: "center" });
  }
  doc.fillColor(BLACK).fontSize(16).font("Helvetica-Bold").text("Budget by MyTools", 78, 16);
  doc.fillColor(GRAY).fontSize(8).font("Helvetica").text("Gestion financière & facturation", 78, 35);
  doc.fillColor(BLACK).fontSize(14).font("Helvetica-Bold").text(title, 360, 16, { width: doc.page.width - 392, align: "right" });
  doc.fillColor(GRAY).fontSize(8).font("Helvetica").text(subtitle, 360, 35, { width: doc.page.width - 392, align: "right" });
  doc.y = 88;
}

function addFooter(doc: PDFKit.PDFDocument) {
  const y = doc.page.height - 28;
  doc.moveTo(32, y - 8).lineTo(doc.page.width - 32, y - 8).lineWidth(0.5).strokeColor("#e5e7eb").stroke();
  doc.fillColor(GRAY).fontSize(7).font("Helvetica").text(
    `© ${new Date().getFullYear()} Budget by MyTools • Généré le ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}`,
    32,
    y,
    { width: doc.page.width - 64, align: "center" },
  );
}

function kpiBox(doc: PDFKit.PDFDocument, x: number, y: number, w: number, label: string, value: string, color: string) {
  doc.roundedRect(x, y, w, 48, 8).fill(LIGHT);
  doc.roundedRect(x, y, w, 48, 8).lineWidth(0.7).strokeColor("#e5e7eb").stroke();
  doc.rect(x, y, 3, 48).fill(color);
  doc.fillColor(GRAY).fontSize(7).font("Helvetica-Bold").text(label.toUpperCase(), x + 10, y + 8, { width: w - 16 });
  doc.fillColor(color).fontSize(15).font("Helvetica-Bold").text(value, x + 10, y + 22, { width: w - 16 });
}

function tableHeader(doc: PDFKit.PDFDocument, y: number, cols: { label: string; x: number; width: number; align?: "left" | "right" | "center" }[]) {
  doc.rect(32, y, doc.page.width - 64, 20).fill(BLACK);
  cols.forEach(col => {
    doc.fillColor(WHITE).fontSize(7).font("Helvetica-Bold").text(col.label.toUpperCase(), col.x, y + 6, { width: col.width, align: col.align || "left" });
  });
  return y + 20;
}

function tableRow(doc: PDFKit.PDFDocument, y: number, even: boolean, cols: { text: string; x: number; width: number; align?: "left" | "right" | "center"; color?: string }[]) {
  if (even) doc.rect(32, y, doc.page.width - 64, 18).fill("#fbfdff");
  cols.forEach(col => {
    doc.fillColor(col.color || BLACK).fontSize(8).font("Helvetica").text(col.text, col.x, y + 4, { width: col.width, align: col.align || "left" });
  });
  doc.moveTo(32, y + 18).lineTo(doc.page.width - 32, y + 18).lineWidth(0.35).strokeColor("#e5e7eb").stroke();
  return y + 18;
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

    addHeader(doc, "Rapport des dépenses", new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }));

    const totalAmt = expenses.reduce((s, e) => s + parseFloat(String(e.total)), 0);
    const paidAmt = expenses.filter(e => e.status === "paid").reduce((s, e) => s + parseFloat(String(e.total)), 0);
    const unpaidAmt = expenses.filter(e => e.status === "unpaid").reduce((s, e) => s + parseFloat(String(e.total)), 0);

    const boxW = (doc.page.width - 64 - 16) / 3;
    const rowY = doc.y;
    kpiBox(doc, 32, rowY, boxW, "Total", `${totalAmt.toFixed(2)} €`, RED);
    kpiBox(doc, 32 + boxW + 8, rowY, boxW, "Payées", `${paidAmt.toFixed(2)} €`, GREEN);
    kpiBox(doc, 32 + (boxW + 8) * 2, rowY, boxW, "À payer", `${unpaidAmt.toFixed(2)} €`, AMBER);
    doc.y = rowY + 60;

    const cols = [
      { label: "Description", x: 36, width: 175 },
      { label: "Catégorie", x: 214, width: 80 },
      { label: "Fournisseur", x: 296, width: 92 },
      { label: "Date", x: 392, width: 58 },
      { label: "Montant", x: 452, width: 70, align: "right" as const },
      { label: "Statut", x: 526, width: 44, align: "center" as const },
    ];

    let y = tableHeader(doc, doc.y, cols);
    expenses.forEach((e, i) => {
      if (y > doc.page.height - 60) {
        doc.addPage({ margin: 0 });
        addHeader(doc, "Rapport des dépenses (suite)", "");
        y = tableHeader(doc, doc.y, cols);
      }
      const statusLabel = e.status === "paid" ? "Payé" : e.status === "overdue" ? "En retard" : "À payer";
      const statusColor = e.status === "paid" ? GREEN : e.status === "overdue" ? RED : AMBER;
      y = tableRow(doc, y, i % 2 === 1, [
        { text: e.description.slice(0, 30), x: 36, width: 175 },
        { text: e.category || "—", x: 214, width: 80 },
        { text: (e.supplierName || "—").slice(0, 16), x: 296, width: 92 },
        { text: e.date ? new Date(e.date).toLocaleDateString("fr-FR") : "—", x: 392, width: 58 },
        { text: `${parseFloat(String(e.total)).toFixed(2)} €`, x: 452, width: 70, align: "right", color: RED },
        { text: statusLabel, x: 526, width: 44, align: "center", color: statusColor },
      ]);
    });

    if (expenses.length === 0) {
      doc.fillColor(GRAY).fontSize(9).font("Helvetica-Oblique").text("Aucune dépense enregistrée.", 32, y + 8, { align: "center", width: doc.page.width - 64 });
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

    addHeader(doc, "Rapport financier", new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }));

    const boxW = (doc.page.width - 64 - 16) / 3;
    const row1Y = doc.y;
    kpiBox(doc, 32, row1Y, boxW, "Revenus encaissés", `${data.totalRevenue.toFixed(2)} €`, GREEN);
    kpiBox(doc, 32 + boxW + 8, row1Y, boxW, "Dépenses totales", `${data.totalExpenses.toFixed(2)} €`, RED);
    kpiBox(doc, 32 + (boxW + 8) * 2, row1Y, boxW, "Abonnements/mois", `${data.monthlyServices.toFixed(2)} €`, BLUE);
    doc.y = row1Y + 60;

    const cols = [
      { label: "Description", x: 36, width: 175 },
      { label: "Catégorie", x: 214, width: 80 },
      { label: "Fournisseur", x: 296, width: 92 },
      { label: "Paiement", x: 392, width: 58 },
      { label: "Montant", x: 452, width: 70, align: "right" as const },
      { label: "Statut", x: 526, width: 44, align: "center" as const },
    ];

    let y = tableHeader(doc, doc.y, cols);
    data.expenses.forEach((e, i) => {
      if (y > doc.page.height - 60) {
        doc.addPage({ margin: 0 });
        addHeader(doc, "Rapport financier (suite)", "");
        y = tableHeader(doc, doc.y, cols);
      }
      const statusLabel = e.status === "paid" ? "Payé" : e.status === "overdue" ? "Retard" : "À payer";
      const statusColor = e.status === "paid" ? GREEN : e.status === "overdue" ? RED : AMBER;
      y = tableRow(doc, y, i % 2 === 1, [
        { text: e.description.slice(0, 30), x: 36, width: 175 },
        { text: e.category || "—", x: 214, width: 80 },
        { text: (e.supplierName || "—").slice(0, 16), x: 296, width: 92 },
        { text: (e.paymentMethod || "—").slice(0, 12), x: 392, width: 58 },
        { text: `${parseFloat(String(e.total)).toFixed(2)} €`, x: 452, width: 70, align: "right", color: RED },
        { text: statusLabel, x: 526, width: 44, align: "center", color: statusColor },
      ]);
    });

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

    addHeader(doc, inv.number, "Facture fournisseur");

    const statusMap: Record<string, string> = { pending: "À approuver", approved: "Approuvée", paid: "Payée", cancelled: "Annulée" };
    const statusColorMap: Record<string, string> = { pending: AMBER, approved: BLUE, paid: GREEN, cancelled: GRAY };
    const statusLabel = statusMap[inv.status] ?? inv.status;
    const statusColor = statusColorMap[inv.status] ?? GRAY;

    const boxY = doc.y;
    const boxW = (doc.page.width - 64 - 10) / 2;

    doc.roundedRect(32, boxY, boxW, 76, 8).fill(LIGHT);
    doc.roundedRect(32 + boxW + 10, boxY, boxW, 76, 8).fill(LIGHT);

    doc.fillColor(GRAY).fontSize(7).font("Helvetica-Bold").text("FOURNISSEUR", 42, boxY + 10);
    doc.fillColor(BLACK).fontSize(12).font("Helvetica-Bold").text(inv.supplierName, 42, boxY + 22, { width: boxW - 20 });
    if (inv.supplierEmail) doc.fillColor(GRAY).fontSize(8).font("Helvetica").text(inv.supplierEmail, 42, boxY + 40, { width: boxW - 20 });
    if (inv.supplierPhone) doc.fillColor(GRAY).fontSize(8).text(inv.supplierPhone, 42, boxY + 52, { width: boxW - 20 });

    const metaX = 42 + boxW + 10;
    doc.fillColor(GRAY).fontSize(7).font("Helvetica-Bold").text("INFORMATIONS", metaX, boxY + 10);
    doc.fillColor(GRAY).fontSize(8).font("Helvetica").text("Émission", metaX, boxY + 24);
    doc.fillColor(BLACK).fontSize(8).font("Helvetica-Bold").text(new Date(inv.issuedDate).toLocaleDateString("fr-FR"), metaX + 68, boxY + 24);
    doc.fillColor(GRAY).fontSize(8).font("Helvetica").text("Échéance", metaX, boxY + 38);
    doc.fillColor(RED).fontSize(8).font("Helvetica-Bold").text(new Date(inv.dueDate).toLocaleDateString("fr-FR"), metaX + 68, boxY + 38);
    doc.fillColor(GRAY).fontSize(8).font("Helvetica").text("Statut", metaX, boxY + 52);
    doc.fillColor(statusColor).fontSize(8).font("Helvetica-Bold").text(statusLabel, metaX + 68, boxY + 52);

    doc.y = boxY + 92;

    const itemCols = [
      { label: "Désignation", x: 36, width: 300 },
      { label: "Qté", x: 338, width: 44, align: "center" as const },
      { label: "PU HT", x: 386, width: 70, align: "right" as const },
      { label: "Total HT", x: 460, width: 70, align: "right" as const },
    ];

    let y = tableHeader(doc, doc.y, itemCols);
    const rows = [
      { text: "Service principal", x: 36, width: 300 },
      { text: "1", x: 338, width: 44, align: "center" as const },
      { text: `${Number(inv.subtotal).toFixed(2)} ${inv.currency}`, x: 386, width: 70, align: "right" as const },
      { text: `${Number(inv.subtotal).toFixed(2)} ${inv.currency}`, x: 460, width: 70, align: "right" as const },
    ];
    y = tableRow(doc, y, false, rows);

    const summaryY = y + 12;
    const summaryX = 355;
    doc.roundedRect(summaryX, summaryY, 175, 78, 8).fill(LIGHT);
    doc.fillColor(GRAY).fontSize(8).font("Helvetica").text("Sous-total", summaryX + 10, summaryY + 10);
    doc.fillColor(BLACK).fontSize(9).font("Helvetica-Bold").text(`${Number(inv.subtotal).toFixed(2)} ${inv.currency}`, summaryX + 95, summaryY + 10, { width: 70, align: "right" });
    doc.fillColor(GRAY).fontSize(8).font("Helvetica").text(`TVA (${Number(inv.taxRate).toFixed(2)}%)`, summaryX + 10, summaryY + 28);
    doc.fillColor(BLACK).fontSize(9).font("Helvetica-Bold").text(`${Number(inv.taxAmount).toFixed(2)} ${inv.currency}`, summaryX + 95, summaryY + 28, { width: 70, align: "right" });
    doc.moveTo(summaryX + 10, summaryY + 46).lineTo(summaryX + 165, summaryY + 46).lineWidth(0.4).strokeColor("#e5e7eb").stroke();
    doc.fillColor(RED).fontSize(12).font("Helvetica-Bold").text(`${Number(inv.total).toFixed(2)} ${inv.currency}`, summaryX + 10, summaryY + 52, { width: 155, align: "right" });

    if (inv.notes) {
      doc.y = summaryY + 96;
      doc.fillColor(BLACK).fontSize(9).font("Helvetica-Bold").text("Notes", 32, doc.y);
      doc.fillColor(GRAY).fontSize(8).font("Helvetica").text(inv.notes, 32, doc.y + 12, { width: doc.page.width - 64 });
    }

    addFooter(doc);
    doc.end();
  });
}
