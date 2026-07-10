export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

export type AccountSubType =
  | 'BANK'
  | 'CASH'
  | 'ACCOUNTS_RECEIVABLE'
  | 'ACCOUNTS_PAYABLE'
  | 'INVENTORY'
  | 'FIXED_ASSET'
  | 'GST_INPUT'
  | 'GST_OUTPUT'
  | 'GST_PAYABLE'
  | 'SALES'
  | 'PURCHASE'
  | 'DIRECT_EXPENSE'
  | 'INDIRECT_EXPENSE'
  | 'OTHER';

export interface CoaAccountSeed {
  code: string;
  name: string;
  type: AccountType;
  subType: AccountSubType;
  parentCode?: string;
  isGroup?: boolean;
  isSystem?: boolean;
}

export interface JournalLineInput {
  accountCode: string;
  description?: string;
  debit: number;
  credit: number;
}

export interface JournalEntryInput {
  date: string;
  narration?: string;
  source: string;
  sourceType?: string;
  sourceId?: string;
  lines: JournalLineInput[];
}

export interface GstTaxBreakdown {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess?: number;
}

export interface SalesInvoicePostingInput {
  invoiceNumber: string;
  date: string;
  partyName: string;
  grandTotal: number;
  tax: GstTaxBreakdown;
  isBillOfSupply?: boolean;
  /** State codes — seller vs place of supply */
  sellerStateCode: string;
  placeOfSupply: string;
}

export interface VendorBillPostingInput {
  billNumber: string;
  date: string;
  vendorName: string;
  grandTotal: number;
  tax: GstTaxBreakdown;
  itcEligible: boolean;
  sellerStateCode: string;
  placeOfSupply: string;
}

export interface PostingResult {
  lines: JournalLineInput[];
  narration: string;
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}