import { describe, expect, it } from 'vitest';
import { buildSalesInvoicePosting, buildVendorBillPosting } from './posting-engine.js';

describe('posting-engine', () => {
  it('balances intra-state sales invoice', () => {
    const r = buildSalesInvoicePosting({
      invoiceNumber: 'INV-001',
      date: '2026-04-15',
      partyName: 'Sharma Traders',
      grandTotal: 11800,
      sellerStateCode: '07',
      placeOfSupply: '07',
      tax: { taxable: 10000, cgst: 900, sgst: 900, igst: 0 }
    });
    expect(r.balanced).toBe(true);
    expect(r.totalDebit).toBe(11800);
    expect(r.totalCredit).toBe(11800);
  });

  it('balances inter-state sales invoice with IGST', () => {
    const r = buildSalesInvoicePosting({
      invoiceNumber: 'INV-002',
      date: '2026-04-15',
      partyName: 'Mumbai Buyer',
      grandTotal: 11800,
      sellerStateCode: '07',
      placeOfSupply: '27',
      tax: { taxable: 10000, cgst: 0, sgst: 0, igst: 1800 }
    });
    expect(r.balanced).toBe(true);
  });

  it('balances vendor bill with ITC', () => {
    const r = buildVendorBillPosting({
      billNumber: 'BILL-001',
      date: '2026-04-10',
      vendorName: 'Supplier Co',
      grandTotal: 5900,
      itcEligible: true,
      sellerStateCode: '07',
      placeOfSupply: '07',
      tax: { taxable: 5000, cgst: 450, sgst: 450, igst: 0 }
    });
    expect(r.balanced).toBe(true);
  });
});