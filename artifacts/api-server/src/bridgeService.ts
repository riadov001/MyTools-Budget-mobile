import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Bridge API (stub for European bank connections)
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY || "";
const BRIDGE_API_URL = BRIDGE_API_KEY.startsWith("sandbox_") 
  ? "https://api.bridgeapi.io/v2" 
  : "https://api.bridgeapi.io/v2"; // Both use same base URL, but keeping logic for future differentiation if needed

export interface BridgeAccount {
  id: string;
  name: string;
  balance: number;
  currency: string;
  iban: string;
  type: string;
  bank_name: string;
  status: string;
}

export interface BridgeTransaction {
  id: string;
  amount: number;
  currency: string;
  description: string;
  date: string;
  category: string;
  account_id: string;
}

async function bridgeFetch(path: string, options: RequestInit = {}) {
  if (!BRIDGE_API_KEY) throw new Error("Bridge API key not configured");
  const url = `${BRIDGE_API_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Bridge-Version": "2021-06-01",
      "Client-Id": process.env.BRIDGE_CLIENT_ID || "",
      "Client-Secret": BRIDGE_API_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Bridge API error ${response.status}: ${body}`);
  }
  return response.json();
}

export async function getBridgeAccounts(userId: string): Promise<BridgeAccount[]> {
  try {
    const data = await bridgeFetch(`/accounts?user_uuid=${userId}`);
    return (data.resources || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      balance: a.balance,
      currency: a.currency_code,
      iban: a.iban || "",
      type: a.type,
      bank_name: a.bank?.name || "",
      status: a.status,
    }));
  } catch {
    return [];
  }
}

export async function getBridgeTransactions(accountId: string, limit = 50): Promise<BridgeTransaction[]> {
  try {
    const data = await bridgeFetch(`/transactions?account_id=${accountId}&limit=${limit}`);
    return (data.resources || []).map((t: any) => ({
      id: t.id,
      amount: t.amount,
      currency: t.currency_code,
      description: t.description || t.clean_description || "",
      date: t.date,
      category: t.category?.name || "Autre",
      account_id: accountId,
    }));
  } catch {
    return [];
  }
}

export async function createBridgeConnectSession(userId: string, redirectUrl: string): Promise<string | null> {
  try {
    const data = await bridgeFetch("/connect/sessions", {
      method: "POST",
      body: JSON.stringify({ user_uuid: userId, redirect_url: redirectUrl }),
    });
    return data.url || null;
  } catch {
    return null;
  }
}

// Stripe Financial Connections helpers
export async function createStripeFinancialConnectionSession(customerId: string) {
  if (!stripe) throw new Error("Stripe not configured");
  return stripe.financialConnections.sessions.create({
    account_holder: { type: "customer", customer: customerId },
    permissions: ["balances", "transactions"],
  });
}

export async function getStripeAccountBalance(accountId: string) {
  if (!stripe) throw new Error("Stripe not configured");
  return stripe.financialConnections.accounts.retrieveBalance(accountId);
}

export async function refreshStripeTransactions(accountId: string) {
  if (!stripe) throw new Error("Stripe not configured");
  return stripe.financialConnections.accounts.refreshAccount(accountId, { features: ["transactions"] });
}

export function isBridgeConfigured(): boolean {
  return !!(process.env.BRIDGE_API_KEY && process.env.BRIDGE_CLIENT_ID);
}
