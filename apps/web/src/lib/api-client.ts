const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface ApiContext {
  tenantId?: string;
  clientId?: string;
  token?: string;
}

export async function apiFetch<T>(
  path: string,
  ctx: ApiContext = {},
  init: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>)
  };
  if (ctx.token) headers.Authorization = `Bearer ${ctx.token}`;
  if (ctx.tenantId) headers['x-tenant-id'] = ctx.tenantId;
  if (ctx.clientId) headers['x-client-id'] = ctx.clientId;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  health: () => apiFetch<{ ok: boolean; postgres: boolean }>('/health'),
  clients: (ctx: ApiContext) => apiFetch<unknown[]>('/v1/clients', ctx),
  coa: (ctx: ApiContext) => apiFetch<{ accounts: unknown[]; tree: unknown[] }>('/v1/accounting/coa', ctx),
  journals: (ctx: ApiContext) => apiFetch<unknown[]>('/v1/accounting/journals', ctx),
  invoices: (ctx: ApiContext) => apiFetch<unknown[]>('/v1/sales/invoices', ctx),
  bills: (ctx: ApiContext) => apiFetch<unknown[]>('/v1/purchases/bills', ctx),
  bankAccounts: (ctx: ApiContext) => apiFetch<unknown[]>('/v1/banking/accounts', ctx),
  items: (ctx: ApiContext) => apiFetch<unknown[]>('/v1/inventory/items', ctx),
  projects: (ctx: ApiContext) => apiFetch<unknown[]>('/v1/projects', ctx),
  gstFilings: (ctx: ApiContext) => apiFetch<unknown[]>('/v1/gst/filings', ctx),
  pnl: (ctx: ApiContext) => apiFetch<unknown>('/v1/accounting/reports/pnl', ctx),
  trialBalance: (ctx: ApiContext) => apiFetch<unknown[]>('/v1/accounting/reports/trial-balance', ctx)
};