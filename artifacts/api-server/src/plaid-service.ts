import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  type LinkTokenCreateRequest,
  type ItemPublicTokenExchangeRequest,
  type TransactionsGetRequest,
  type AccountsGetRequest,
} from "plaid";

let plaidClient: PlaidApi | null = null;

export function getPlaidClient(): PlaidApi {
  if (!plaidClient) {
    const clientId = process.env.PLAID_CLIENT_ID;
    const secret = process.env.PLAID_SECRET;
    if (!clientId || !secret) throw Object.assign(new Error("PLAID_CLIENT_ID / PLAID_SECRET non configurés"), { status: 503 });
    const config = new Configuration({
      basePath: PlaidEnvironments.sandbox,
      baseOptions: { headers: { "PLAID-CLIENT-ID": clientId, "PLAID-SECRET": secret } },
    });
    plaidClient = new PlaidApi(config);
  }
  return plaidClient;
}

export async function createLinkToken(userId: string): Promise<string> {
  const client = getPlaidClient();
  const req: LinkTokenCreateRequest = {
    user: { client_user_id: userId },
    client_name: "MyTools Budget Tracker",
    products: [Products.Transactions],
    country_codes: [CountryCode.Fr, CountryCode.Gb, CountryCode.Us],
    language: "fr",
    webhook: undefined,
  };
  const response = await client.linkTokenCreate(req);
  return response.data.link_token;
}

export async function exchangePublicToken(publicToken: string): Promise<{ accessToken: string; itemId: string }> {
  const client = getPlaidClient();
  const req: ItemPublicTokenExchangeRequest = { public_token: publicToken };
  const response = await client.itemPublicTokenExchange(req);
  return {
    accessToken: response.data.access_token,
    itemId: response.data.item_id,
  };
}

export async function getAccounts(accessToken: string) {
  const client = getPlaidClient();
  const req: AccountsGetRequest = { access_token: accessToken };
  const response = await client.accountsGet(req);
  return response.data.accounts;
}

export async function getTransactions(accessToken: string, startDate: string, endDate: string) {
  const client = getPlaidClient();
  const req: TransactionsGetRequest = {
    access_token: accessToken,
    start_date: startDate,
    end_date: endDate,
    options: { count: 500, offset: 0 },
  };
  const response = await client.transactionsGet(req);
  return response.data.transactions;
}

export async function getInstitution(institutionId: string) {
  const client = getPlaidClient();
  const response = await client.institutionsGetById({
    institution_id: institutionId,
    country_codes: [CountryCode.Fr, CountryCode.Gb, CountryCode.Us],
  });
  return response.data.institution;
}
