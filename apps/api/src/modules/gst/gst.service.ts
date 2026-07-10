import { runGstr2bReconciliation } from '@ledgerflow/gst-engine/src/matcher.js';
import { validateGstr1Json } from '@ledgerflow/gst-engine/src/validators.js';
import { prisma } from '../../lib/prisma.js';
import type { RequestContext } from '../../types.js';

export async function listFilings(ctx: RequestContext) {
  return prisma.gstrFiling.findMany({
    where: { clientId: ctx.clientId },
    orderBy: { period: 'desc' }
  });
}

export async function importGstr2b(ctx: RequestContext, period: string, rawJson: unknown) {
  return prisma.gstr2bImport.upsert({
    where: { clientId_period: { clientId: ctx.clientId, period } },
    create: { clientId: ctx.clientId, period, source: 'upload', rawJson: rawJson as object },
    update: { rawJson: rawJson as object, importedAt: new Date() }
  });
}

export async function runRecon(ctx: RequestContext, period: string) {
  const g2bImport = await prisma.gstr2bImport.findUnique({
    where: { clientId_period: { clientId: ctx.clientId, period } }
  });
  if (!g2bImport) throw new Error('GSTR-2B not imported for period');

  const purchases = await prisma.purchase.findMany({
    where: { clientId: ctx.clientId, date: { gte: periodStart(period), lte: periodEnd(period) } }
  });

  const books = purchases.map(p => ({
    id: p.id,
    supplierGstin: p.supplierGstin,
    invoiceNo: p.invoiceNo,
    date: p.date.toISOString().slice(0, 10),
    taxable: Number(p.taxable),
    cgst: Number(p.cgst),
    sgst: Number(p.sgst),
    igst: Number(p.igst),
    itcEligible: p.itcEligible
  }));

  const raw = g2bImport.rawJson as { entries?: Array<Record<string, unknown>> };
  const g2b = (raw.entries || []).map((e, i) => ({
    id: String(e.id || `g2b_${i}`),
    section: String(e.section || 'B2B'),
    supplierGstin: String(e.supplierGstin || ''),
    invoiceNo: String(e.invoiceNo || ''),
    date: String(e.date || ''),
    taxable: Number(e.taxable || 0),
    igst: Number(e.igst || 0),
    cgst: Number(e.cgst || 0),
    sgst: Number(e.sgst || 0),
    imsStatus: e.imsStatus as 'NONE' | 'ACCEPT' | 'REJECT' | 'PENDING' | undefined
  }));

  const lines = runGstr2bReconciliation(books, g2b, {
    dateDays: 3, valuePct: 0.5, taxAbs: 1, invNoNormalize: true, fuzzyEnabled: true
  });

  const stats = {
    total: lines.length,
    exact: lines.filter(l => l.bucket === 'EXACT_MATCH').length,
    fuzzy: lines.filter(l => l.bucket === 'FUZZY_MATCH').length,
    missingBooks: lines.filter(l => l.bucket === 'MISSING_IN_BOOKS').length,
    missingPortal: lines.filter(l => l.bucket === 'MISSING_IN_PORTAL').length
  };

  const run = await prisma.reconRun.create({
    data: {
      clientId: ctx.clientId,
      period,
      config: { fuzzy: true },
      stats,
      lines: {
        create: lines.map(l => ({
          bucket: l.bucket,
          confidence: l.confidence,
          booksPurchaseId: l.books?.id,
          booksGstin: l.books?.supplierGstin,
          booksInvNo: l.books?.invoiceNo,
          booksItc: l.booksItc,
          g2bGstin: l.g2b?.supplierGstin,
          g2bInvNo: l.g2b?.invoiceNo,
          g2bItc: l.gstr2bItc,
          imsStatus: l.imsAction,
          variance: l.variance,
          matchReason: l.matchReason
        }))
      }
    },
    include: { lines: true }
  });

  return { run, stats };
}

export function validateGstr1(data: Record<string, unknown>) {
  return validateGstr1Json(data);
}

function periodStart(period: string) {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

function periodEnd(period: string) {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m, 0);
}