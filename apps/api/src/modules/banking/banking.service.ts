import { prisma } from '../../lib/prisma.js';
import type { RequestContext } from '../../types.js';

export async function listBankAccounts(ctx: RequestContext) {
  return prisma.bankAccount.findMany({
    where: { clientId: ctx.clientId },
    include: { transactions: { take: 20, orderBy: { date: 'desc' } } }
  });
}

export async function createBankAccount(ctx: RequestContext, body: Record<string, unknown>) {
  return prisma.bankAccount.create({
    data: {
      tenantId: ctx.tenantId,
      clientId: ctx.clientId,
      bankName: String(body.bankName || 'Bank'),
      accountNumber: String(body.accountNumber || ''),
      ifsc: body.ifsc ? String(body.ifsc) : undefined,
      openingBalance: Number(body.openingBalance || 0)
    }
  });
}

export async function importTransactions(ctx: RequestContext, bankAccountId: string, rows: Array<Record<string, unknown>>) {
  const created = [];
  for (const r of rows) {
    const tx = await prisma.bankTransaction.create({
      data: {
        bankAccountId,
        date: new Date(String(r.date)),
        description: r.description ? String(r.description) : undefined,
        reference: r.reference ? String(r.reference) : undefined,
        type: String(r.type) === 'CREDIT' ? 'CREDIT' : 'DEBIT',
        amount: Math.abs(Number(r.amount || 0)),
        reconStatus: 'UNMATCHED'
      }
    });
    created.push(tx);
  }
  return { imported: created.length, transactions: created };
}

export async function listUnmatched(ctx: RequestContext, bankAccountId: string) {
  return prisma.bankTransaction.findMany({
    where: { bankAccountId, reconStatus: 'UNMATCHED' },
    orderBy: { date: 'desc' }
  });
}

export async function matchTransaction(ctx: RequestContext, txId: string, paymentId?: string) {
  return prisma.bankTransaction.update({
    where: { id: txId },
    data: { reconStatus: 'MATCHED', matchedPaymentId: paymentId }
  });
}

export async function createReconciliation(ctx: RequestContext, bankAccountId: string, body: Record<string, unknown>) {
  return prisma.bankReconciliation.create({
    data: {
      bankAccountId,
      periodEnd: new Date(String(body.periodEnd)),
      statementBal: Number(body.statementBal || 0),
      bookBal: Number(body.bookBal || 0),
      difference: Number(body.difference || 0),
      isComplete: Boolean(body.isComplete)
    }
  });
}