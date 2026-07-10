export type ReconBucket =
  | 'EXACT_MATCH' | 'FUZZY_MATCH' | 'PARTIAL_MATCH'
  | 'MISSING_IN_BOOKS' | 'MISSING_IN_PORTAL' | 'REJECTED_IMS' | 'PENDING_IMS';

export type ImsAction = 'NONE' | 'ACCEPT' | 'REJECT' | 'PENDING';

export interface BooksPurchase {
  id: string;
  supplierGstin: string;
  invoiceNo: string;
  date: string;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  itcEligible?: boolean;
}

export interface Gstr2bEntry {
  id: string;
  section: string;
  supplierGstin: string;
  invoiceNo: string;
  date: string;
  taxable: number;
  igst: number;
  cgst: number;
  sgst: number;
  imsStatus?: ImsAction;
}

export interface ReconTolerance {
  dateDays: number;
  valuePct: number;
  taxAbs: number;
  invNoNormalize: boolean;
  fuzzyEnabled: boolean;
}

export interface ReconLine {
  id: string;
  bucket: ReconBucket;
  confidence: number;
  books?: BooksPurchase;
  g2b?: Gstr2bEntry;
  booksItc: number;
  gstr2bItc: number;
  variance: number;
  matchReason: string;
  imsAction: ImsAction;
}

const normInv = (s: string, n: boolean) => (n ? s.replace(/[\s\-\/]/g, '').toUpperCase() : s.trim());
const itc = (r: { igst?: number; cgst?: number; sgst?: number }) =>
  (r.igst ?? 0) + (r.cgst ?? 0) + (r.sgst ?? 0);

export function runGstr2bReconciliation(
  books: BooksPurchase[],
  g2b: Gstr2bEntry[],
  tolerance: ReconTolerance
): ReconLine[] {
  const tol = { dateDays: 3, valuePct: 0.5, taxAbs: 1, invNoNormalize: true, fuzzyEnabled: true, ...tolerance };
  const usedBooks = new Set<string>();
  const usedG2b = new Set<string>();
  const lines: ReconLine[] = [];

  const scorePair = (b: BooksPurchase, g: Gstr2bEntry) => {
    let score = 0;
    const reasons: string[] = [];
    if (b.supplierGstin !== g.supplierGstin) return { score: 0, reasons: ['GSTIN mismatch'], taxDiff: 999 };
    const bNo = normInv(b.invoiceNo, tol.invNoNormalize);
    const gNo = normInv(g.invoiceNo, tol.invNoNormalize);
    if (bNo === gNo) { score += 40; reasons.push('Invoice exact'); }
    else if (tol.fuzzyEnabled && (bNo.includes(gNo) || gNo.includes(bNo))) { score += 25; reasons.push('Invoice partial'); }
    const taxDiff = Math.abs(itc(b) - itc(g));
    if (taxDiff <= tol.taxAbs) { score += 25; reasons.push('ITC match'); }
    return { score, reasons, taxDiff };
  };

  for (const g of g2b) {
    if (g.imsStatus === 'REJECT') {
      lines.push({
        id: `rej_${g.id}`, bucket: 'REJECTED_IMS', confidence: 1, g2b: g,
        booksItc: 0, gstr2bItc: itc(g), variance: itc(g), matchReason: 'IMS rejected', imsAction: 'REJECT'
      });
      usedG2b.add(g.id);
    }
  }

  for (const g of g2b) {
    if (usedG2b.has(g.id)) continue;
    let best: { b: BooksPurchase; score: number; reasons: string[]; taxDiff: number } | null = null;
    for (const b of books) {
      if (usedBooks.has(b.id) || b.itcEligible === false) continue;
      const { score, reasons, taxDiff } = scorePair(b, g);
      if (score >= 70 && (!best || score > best.score)) best = { b, score, reasons, taxDiff };
    }
    if (!best) continue;
    const bucket: ReconBucket = best.score >= 100 && best.taxDiff <= tol.taxAbs ? 'EXACT_MATCH'
      : best.score >= 85 ? 'FUZZY_MATCH' : 'PARTIAL_MATCH';
    usedBooks.add(best.b.id);
    usedG2b.add(g.id);
    lines.push({
      id: `${bucket}_${best.b.id}_${g.id}`, bucket, confidence: best.score / 100,
      books: best.b, g2b: g, booksItc: itc(best.b), gstr2bItc: itc(g),
      variance: Math.abs(itc(best.b) - itc(g)), matchReason: best.reasons.join(', '),
      imsAction: g.imsStatus ?? 'NONE'
    });
  }

  for (const g of g2b) {
    if (usedG2b.has(g.id)) continue;
    lines.push({
      id: `mib_${g.id}`, bucket: 'MISSING_IN_BOOKS', confidence: 0, g2b: g,
      booksItc: 0, gstr2bItc: itc(g), variance: itc(g), matchReason: 'Missing in books', imsAction: 'PENDING'
    });
  }

  for (const b of books) {
    if (usedBooks.has(b.id) || b.itcEligible === false) continue;
    lines.push({
      id: `mip_${b.id}`, bucket: 'MISSING_IN_PORTAL', confidence: 0, books: b,
      booksItc: itc(b), gstr2bItc: 0, variance: itc(b), matchReason: 'Missing in 2B', imsAction: 'NONE'
    });
  }

  return lines;
}