import { z } from 'zod';

export const tenantContextSchema = z.object({
  tenantId: z.string(),
  clientId: z.string(),
  userId: z.string().optional()
});

export const journalLineSchema = z.object({
  accountCode: z.string(),
  description: z.string().optional(),
  debit: z.number().min(0),
  credit: z.number().min(0)
});

export const createJournalSchema = z.object({
  date: z.string(),
  narration: z.string().optional(),
  lines: z.array(journalLineSchema).min(2)
});

export const createInvoiceSchema = z.object({
  number: z.string(),
  date: z.string(),
  partyName: z.string(),
  partyGstin: z.string().optional(),
  placeOfSupply: z.string().length(2),
  taxable: z.number(),
  cgst: z.number().default(0),
  sgst: z.number().default(0),
  igst: z.number().default(0),
  grandTotal: z.number(),
  lines: z.array(z.object({
    hsnSac: z.string(),
    description: z.string().optional(),
    qty: z.number(),
    rate: z.number(),
    taxable: z.number()
  })).optional()
});

export const createBillSchema = z.object({
  number: z.string(),
  date: z.string(),
  supplierGstin: z.string().optional(),
  taxable: z.number(),
  cgst: z.number().default(0),
  sgst: z.number().default(0),
  igst: z.number().default(0),
  grandTotal: z.number(),
  itcEligible: z.boolean().default(true)
});

export const createItemSchema = z.object({
  sku: z.string().optional(),
  name: z.string(),
  hsnSac: z.string(),
  type: z.enum(['GOODS', 'SERVICE', 'COMPOSITE']).default('GOODS'),
  salesRate: z.number().default(0),
  purchaseRate: z.number().default(0),
  gstRate: z.number().default(18)
});

export const createProjectSchema = z.object({
  name: z.string(),
  code: z.string().optional(),
  hourlyRate: z.number().optional(),
  budgetHours: z.number().optional()
});