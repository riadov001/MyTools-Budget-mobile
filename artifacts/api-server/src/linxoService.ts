const LINXO_API_KEY = process.env.LINXO_API_KEY || "";
const LINXO_API_URL = "https://api.linxo.com/v2";

export interface LinxoAccount {
  id: string;
  name: string;
  balance: number;
  currency: string;
  iban: string;
  bank_name: string;
  status: string;
}

export interface LinxoTransaction {
  id: string;
  amount: number;
  currency: string;
  description: string;
  date: string;
  category: string;
  account_id: string;
}

async function linxoFetch(path: string, options: RequestInit = {}) {
  if (!LINXO_API_KEY) throw new Error("Linxo API key not configured");
  const url = `${LINXO_API_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${LINXO_API_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Linxo API error ${response.status}: ${body}`);
  }
  return response.json();
}

export async function getLinxoAccounts(userId: string): Promise<LinxoAccount[]> {
  try {
    const data = await linxoFetch(`/users/${userId}/accounts`);
    return (data.accounts || data || []).map((a: any) => ({
      id: String(a.id),
      name: a.name || a.label || "Compte Linxo",
      balance: a.balance || 0,
      currency: a.currency || "EUR",
      iban: a.iban || "",
      bank_name: a.connection?.bank?.name || a.bank_name || "Banque",
      status: a.status || "active",
    }));
  } catch {
    return [];
  }
}

export async function getLinxoTransactions(accountId: string, limit = 50): Promise<LinxoTransaction[]> {
  try {
    const data = await linxoFetch(`/accounts/${accountId}/transactions?limit=${limit}`);
    return (data.transactions || data || []).map((t: any) => ({
      id: String(t.id),
      amount: t.amount || 0,
      currency: t.currency || "EUR",
      description: t.wording || t.label || t.description || "",
      date: t.date || t.application_date || new Date().toISOString(),
      category: t.category?.name || "Autre",
      account_id: accountId,
    }));
  } catch {
    return [];
  }
}

export function isLinxoConfigured(): boolean {
  return !!process.env.LINXO_API_KEY;
}
