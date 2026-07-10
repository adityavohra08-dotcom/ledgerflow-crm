import type {
  JournalEntryInput,
  JournalLineInput,
  PostingResult,
  SalesInvoicePostingInput,
  VendorBillPostingInput
} from './types.js';

const round2 = (n: number) => Math.round(n * 100) / 100;

export class PostingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PostingError';
  }
}

/** Enforce double-entry balance */
export function validateBalance(lines: JournalLineInput[]): PostingResult {
  const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;
  return {
    lines,
    narration: '',
    totalDebit,
    totalCredit,
    balanced
  };
}

function line(accountCode: string, debit: number, credit: number, description?: string): JournalLineInput {
  return { accountCode, debit: round2(debit), credit: round2(credit), description };
}

const isInterState = (sellerState: string, pos: string) => sellerState !== pos;

/**
 * Sales Tax Invoice → Journal lines
 * Dr Accounts Receivable (1130)
 * Cr Sales (4110 or 4120)
 * Cr Output CGST/SGST or IGST (2120/2121/2122)
 */
export function buildSalesInvoicePosting(input: SalesInvoicePostingInput): PostingResult {
  const { tax, grandTotal, isBillOfSupply, sellerStateCode, placeOfSupply } = input;
  const inter = isInterState(sellerStateCode, placeOfSupply);
  const salesAccount = isBillOfSupply || tax.taxable === 0 ? '4120' : '4110';

  const lines: JournalLineInput[] = [
    line('1130', grandTotal, 0, `Debtor — ${input.partyName}`),
    line(salesAccount, 0, tax.taxable, 'Sales')
  ];

  if (!isBillOfSupply) {
    if (inter) {
      if (tax.igst > 0) lines.push(line('2122', 0, tax.igst, 'Output IGST'));
    } else {
      if (tax.cgst > 0) lines.push(line('2120', 0, tax.cgst, 'Output CGST'));
      if (tax.sgst > 0) lines.push(line('2121', 0, tax.sgst, 'Output SGST'));
    }
  }

  const result = validateBalance(lines);
  result.narration = `Sales Invoice ${input.invoiceNumber} — ${input.partyName}`;
  if (!result.balanced) {
    throw new PostingError(
      `Invoice ${input.invoiceNumber} unbalanced: Dr ${result.totalDebit} ≠ Cr ${result.totalCredit}`
    );
  }
  return result;
}

/**
 * Vendor Bill → Journal lines
 * Dr Purchase/Expense (5200) + Input tax (1150/1151/1152)
 * Cr Accounts Payable (2110)
 */
export function buildVendorBillPosting(input: VendorBillPostingInput): PostingResult {
  const { tax, grandTotal, itcEligible, sellerStateCode, placeOfSupply } = input;
  const inter = isInterState(sellerStateCode, placeOfSupply);

  const lines: JournalLineInput[] = [
    line('5200', tax.taxable, 0, `Purchase — ${input.vendorName}`),
    line('2110', 0, grandTotal, `Creditor — ${input.vendorName}`)
  ];

  if (itcEligible) {
    if (inter) {
      if (tax.igst > 0) lines.push(line('1152', tax.igst, 0, 'Input IGST'));
    } else {
      if (tax.cgst > 0) lines.push(line('1150', tax.cgst, 0, 'Input CGST'));
      if (tax.sgst > 0) lines.push(line('1151', tax.sgst, 0, 'Input SGST'));
    }
  }

  const result = validateBalance(lines);
  result.narration = `Vendor Bill ${input.billNumber} — ${input.vendorName}`;
  if (!result.balanced) {
    throw new PostingError(
      `Bill ${input.billNumber} unbalanced: Dr ${result.totalDebit} ≠ Cr ${result.totalCredit}`
    );
  }
  return result;
}

/** Payment received: Dr Bank, Cr AR */
export function buildPaymentReceivedPosting(
  amount: number,
  partyName: string,
  bankAccountCode = '1120',
  reference?: string
): PostingResult {
  const lines = [
    line(bankAccountCode, amount, 0, reference ?? 'Payment received'),
    line('1130', 0, amount, partyName)
  ];
  const result = validateBalance(lines);
  result.narration = `Payment received — ${partyName}`;
  if (!result.balanced) throw new PostingError('Payment received entry unbalanced');
  return result;
}

/** Payment made: Dr AP, Cr Bank */
export function buildPaymentMadePosting(
  amount: number,
  partyName: string,
  bankAccountCode = '1120',
  reference?: string
): PostingResult {
  const lines = [
    line('2110', amount, 0, partyName),
    line(bankAccountCode, 0, amount, reference ?? 'Payment made')
  ];
  const result = validateBalance(lines);
  result.narration = `Payment made — ${partyName}`;
  if (!result.balanced) throw new PostingError('Payment made entry unbalanced');
  return result;
}

export function toJournalEntryInput(
  posting: PostingResult,
  meta: Pick<JournalEntryInput, 'date' | 'source' | 'sourceType' | 'sourceId'>
): JournalEntryInput {
  return {
    ...meta,
    narration: posting.narration,
    lines: posting.lines
  };
}