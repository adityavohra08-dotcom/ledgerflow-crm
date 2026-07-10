import type { JournalLineInput } from './types.js';

export interface LedgerBalance {
  accountCode: string;
  accountName: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

/** Trial balance from posted journal lines */
export function buildTrialBalance(
  lines: Array<JournalLineInput & { accountName?: string; accountType?: string }>
): LedgerBalance[] {
  const map = new Map<string, LedgerBalance>();
  for (const l of lines) {
    const cur = map.get(l.accountCode) ?? {
      accountCode: l.accountCode,
      accountName: l.accountName ?? l.accountCode,
      type: l.accountType ?? 'UNKNOWN',
      debit: 0,
      credit: 0,
      balance: 0
    };
    cur.debit += l.debit;
    cur.credit += l.credit;
    map.set(l.accountCode, cur);
  }
  return [...map.values()]
    .map(b => ({ ...b, balance: Math.round((b.debit - b.credit) * 100) / 100 }))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}

/** Simplified P&L from trial balance */
export function buildProfitAndLoss(trialBalance: LedgerBalance[]) {
  const income = trialBalance.filter(a => a.type === 'INCOME').reduce((s, a) => s + (a.credit - a.debit), 0);
  const expenses = trialBalance.filter(a => a.type === 'EXPENSE').reduce((s, a) => s + (a.debit - a.credit), 0);
  const netProfit = Math.round((income - expenses) * 100) / 100;
  return {
    income: Math.round(income * 100) / 100,
    expenses: Math.round(expenses * 100) / 100,
    netProfit,
    lines: trialBalance.filter(a => a.type === 'INCOME' || a.type === 'EXPENSE')
  };
}