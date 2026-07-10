import {
  INDIAN_COA_TEMPLATE,
  sortCoaForInsert,
  buildCoaTree,
  buildSalesInvoicePosting,
  buildVendorBillPosting,
  toJournalEntryInput,
  buildTrialBalance,
  buildProfitAndLoss
} from '@ledgerflow/accounting-engine/src/index.js';
import { prisma } from '../../lib/prisma.js';
import type { RequestContext } from '../../types.js';
import { createJournalSchema } from '@ledgerflow/shared/src/schemas.js';

export async function seedChartOfAccounts(ctx: RequestContext) {
  const existing = await prisma.account.count({ where: { clientId: ctx.clientId } });
  if (existing > 0) return { seeded: false, count: existing };

  const sorted = sortCoaForInsert(INDIAN_COA_TEMPLATE);
  const codeToId = new Map<string, string>();

  for (const seed of sorted) {
    const parentId = seed.parentCode ? codeToId.get(seed.parentCode) : undefined;
    const acc = await prisma.account.create({
      data: {
        tenantId: ctx.tenantId,
        clientId: ctx.clientId,
        code: seed.code,
        name: seed.name,
        type: seed.type,
        subType: seed.subType,
        parentId,
        isGroup: seed.isGroup ?? false,
        isSystem: seed.isSystem ?? false
      }
    });
    codeToId.set(seed.code, acc.id);
  }
  return { seeded: true, count: sorted.length };
}

export async function listAccounts(ctx: RequestContext) {
  const accounts = await prisma.account.findMany({
    where: { clientId: ctx.clientId },
    orderBy: { code: 'asc' }
  });
  const seeds = accounts.map(a => ({
    code: a.code,
    name: a.name,
    type: a.type,
    subType: a.subType,
    parentCode: accounts.find(p => p.id === a.parentId)?.code,
    isGroup: a.isGroup,
    isSystem: a.isSystem
  }));
  return { accounts, tree: buildCoaTree(seeds) };
}

export async function listJournals(ctx: RequestContext) {
  return prisma.journalEntry.findMany({
    where: { clientId: ctx.clientId },
    include: { lines: { include: { account: true }, orderBy: { lineOrder: 'asc' } } },
    orderBy: { date: 'desc' },
    take: 100
  });
}

export async function createJournal(ctx: RequestContext, body: unknown) {
  const parsed = createJournalSchema.parse(body);
  const accounts = await prisma.account.findMany({ where: { clientId: ctx.clientId } });
  const byCode = new Map(accounts.map(a => [a.code, a]));

  const totalDebit = parsed.lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = parsed.lines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Journal unbalanced: Dr ${totalDebit} ≠ Cr ${totalCredit}`);
  }

  const settings = await prisma.clientSettings.findUnique({ where: { clientId: ctx.clientId } });
  const num = settings?.journalNextNumber ?? 1;
  const number = `${settings?.journalPrefix ?? 'JE'}-${String(num).padStart(5, '0')}`;

  const entry = await prisma.journalEntry.create({
    data: {
      tenantId: ctx.tenantId,
      clientId: ctx.clientId,
      number,
      date: new Date(parsed.date),
      narration: parsed.narration,
      source: 'MANUAL',
      status: 'POSTED',
      postedAt: new Date(),
      lines: {
        create: parsed.lines.map((l, i) => {
          const acc = byCode.get(l.accountCode);
          if (!acc) throw new Error(`Account ${l.accountCode} not found`);
          return {
            accountId: acc.id,
            description: l.description,
            debit: l.debit,
            credit: l.credit,
            lineOrder: i
          };
        })
      }
    },
    include: { lines: { include: { account: true } } }
  });

  if (settings) {
    await prisma.clientSettings.update({
      where: { clientId: ctx.clientId },
      data: { journalNextNumber: num + 1 }
    });
  }

  return entry;
}

export async function postInvoice(ctx: RequestContext, invoiceId: string, sellerStateCode: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, clientId: ctx.clientId },
    include: { lines: true }
  });
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.journalEntryId) return { alreadyPosted: true };

  const posting = buildSalesInvoicePosting({
    invoiceNumber: invoice.number,
    date: invoice.date.toISOString().slice(0, 10),
    partyName: invoice.partyName,
    grandTotal: Number(invoice.grandTotal),
    sellerStateCode,
    placeOfSupply: invoice.placeOfSupply,
    isBillOfSupply: invoice.docType === 'BILL_OF_SUPPLY',
    tax: {
      taxable: Number(invoice.taxable),
      cgst: Number(invoice.cgst),
      sgst: Number(invoice.sgst),
      igst: Number(invoice.igst)
    }
  });

  const journal = await createJournalFromPosting(ctx, toJournalEntryInput(posting, {
    date: invoice.date.toISOString().slice(0, 10),
    source: 'INVOICE',
    sourceType: 'Invoice',
    sourceId: invoice.id
  }));

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { journalEntryId: journal.id, status: 'APPROVED' }
  });

  return { journal, posting };
}

export async function postBill(ctx: RequestContext, billId: string, sellerStateCode: string) {
  const bill = await prisma.bill.findFirst({ where: { id: billId, clientId: ctx.clientId } });
  if (!bill) throw new Error('Bill not found');
  if (bill.journalEntryId) return { alreadyPosted: true };

  const posting = buildVendorBillPosting({
    billNumber: bill.number,
    date: bill.date.toISOString().slice(0, 10),
    vendorName: bill.contactId ?? 'Vendor',
    grandTotal: Number(bill.grandTotal),
    itcEligible: bill.itcEligible,
    sellerStateCode,
    placeOfSupply: sellerStateCode,
    tax: {
      taxable: Number(bill.taxable),
      cgst: Number(bill.cgst),
      sgst: Number(bill.sgst),
      igst: Number(bill.igst)
    }
  });

  const journal = await createJournalFromPosting(ctx, toJournalEntryInput(posting, {
    date: bill.date.toISOString().slice(0, 10),
    source: 'BILL',
    sourceType: 'Bill',
    sourceId: bill.id
  }));

  await prisma.bill.update({
    where: { id: bill.id },
    data: { journalEntryId: journal.id, status: 'APPROVED' }
  });

  return { journal, posting };
}

async function createJournalFromPosting(
  ctx: RequestContext,
  input: ReturnType<typeof toJournalEntryInput>
) {
  const accounts = await prisma.account.findMany({ where: { clientId: ctx.clientId } });
  const byCode = new Map(accounts.map(a => [a.code, a]));
  const settings = await prisma.clientSettings.findUnique({ where: { clientId: ctx.clientId } });
  const num = settings?.journalNextNumber ?? 1;
  const number = `${settings?.journalPrefix ?? 'JE'}-${String(num).padStart(5, '0')}`;

  const entry = await prisma.journalEntry.create({
    data: {
      tenantId: ctx.tenantId,
      clientId: ctx.clientId,
      number,
      date: new Date(input.date),
      narration: input.narration,
      source: input.source as 'INVOICE' | 'BILL' | 'MANUAL',
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      status: 'POSTED',
      postedAt: new Date(),
      lines: {
        create: input.lines.map((l, i) => ({
          accountId: byCode.get(l.accountCode)!.id,
          description: l.description,
          debit: l.debit,
          credit: l.credit,
          lineOrder: i
        }))
      }
    },
    include: { lines: { include: { account: true } } }
  });

  if (settings) {
    await prisma.clientSettings.update({
      where: { clientId: ctx.clientId },
      data: { journalNextNumber: num + 1 }
    });
  }
  return entry;
}

export async function getTrialBalance(ctx: RequestContext) {
  const lines = await prisma.journalLine.findMany({
    where: { journalEntry: { clientId: ctx.clientId, status: 'POSTED' } },
    include: { account: true, journalEntry: true }
  });
  const flat = lines.map(l => ({
    accountCode: l.account.code,
    accountName: l.account.name,
    accountType: l.account.type,
    debit: Number(l.debit),
    credit: Number(l.credit),
    description: l.description ?? undefined
  }));
  return buildTrialBalance(flat);
}

export async function getProfitAndLoss(ctx: RequestContext) {
  const tb = await getTrialBalance(ctx);
  return buildProfitAndLoss(tb);
}