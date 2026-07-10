/**
 * GSTR-1 portal validation rules — TypeScript port of gst-validation-rules.js
 */

export type ValidationSeverity = 'error' | 'warn';

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  msg: string;
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  details: { errors: ValidationIssue[]; warnings: ValidationIssue[] };
  ruleCount: number;
  valid: boolean;
}

export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const DATE_RE = /^\d{2}-\d{2}-\d{4}$/;
export const FP_RE = /^\d{6}$/;
export const VALID_RATES = [0, 0.25, 3, 5, 6, 12, 18, 28, 40];
const INVOICE_TYPES = ['R', 'DE', 'SEWP', 'SEWPC', 'SEWOP', 'SEWOPC', 'CBW'];

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n: number) => Math.round(num(n) * 100) / 100;

function push(arr: ValidationIssue[], severity: ValidationSeverity, code: string, msg: string) {
  arr.push({ severity, code, msg });
}

function ruleHeader(data: Record<string, unknown>, errors: ValidationIssue[], warnings: ValidationIssue[]) {
  const gstin = String(data.gstin ?? '');
  if (!data.gstin) push(errors, 'error', 'HDR-001', 'gstin is required');
  else if (!GSTIN_RE.test(gstin.replace(/\s/g, '').toUpperCase())) push(errors, 'error', 'HDR-002', 'gstin format invalid');
  if (!data.fp) push(errors, 'error', 'HDR-003', 'fp (filing period) is required');
  else if (!FP_RE.test(String(data.fp))) push(warnings, 'warn', 'HDR-004', 'fp should be MMYYYY format');
  if (!data.version) push(errors, 'error', 'HDR-005', 'version field required');
  if (!data.hash) push(warnings, 'warn', 'HDR-006', 'hash field recommended for offline tool');
  if (data.meta) push(errors, 'error', 'HDR-007', 'meta block must not appear in portal JSON');
  if (data.summary) push(errors, 'error', 'HDR-008', 'summary block must not appear in portal JSON');
  const state = gstin.slice(0, 2);
  if (state && !/^\d{2}$/.test(state)) push(warnings, 'warn', 'HDR-009', 'gstin state code invalid');
}

function ruleB2b(data: Record<string, unknown>, errors: ValidationIssue[], warnings: ValidationIssue[]) {
  const gstin = String(data.gstin ?? '');
  ((data.b2b as Array<Record<string, unknown>>) || []).forEach((g, gi) => {
    const ctin = String(g.ctin ?? '');
    if (!g.ctin) push(errors, 'error', `B2B-${gi}-CTIN`, `B2B[${gi}] missing ctin`);
    else if (!GSTIN_RE.test(ctin)) push(warnings, 'warn', `B2B-${gi}-CTIN-FMT`, `B2B[${gi}] ctin format suspect`);
    if (ctin === gstin) push(errors, 'error', `B2B-${gi}-SELF`, `B2B[${gi}] cannot invoice to self`);
    ((g.inv as Array<Record<string, unknown>>) || []).forEach((inv, j) => {
      const pos = String(inv.pos ?? '');
      if (!inv.inum) push(errors, 'error', `B2B-${gi}-${j}-INUM`, `B2B[${gi}].inv[${j}] missing inum`);
      if (inv.inum && String(inv.inum).length > 16) push(errors, 'error', `B2B-${gi}-${j}-INUM-LEN`, `B2B[${gi}].inv[${j}] inum > 16 chars`);
      if (!inv.idt || !DATE_RE.test(String(inv.idt))) push(errors, 'error', `B2B-${gi}-${j}-IDT`, `B2B[${gi}].inv[${j}] idt must be DD-MM-YYYY`);
      if (!pos || pos.length !== 2) push(warnings, 'warn', `B2B-${gi}-${j}-POS`, `B2B[${gi}].inv[${j}] pos should be 2-digit state code`);
      if (inv.val == null) push(errors, 'error', `B2B-${gi}-${j}-VAL`, `B2B[${gi}].inv[${j}] missing val`);
      if (inv.rchrg && !['Y', 'N'].includes(String(inv.rchrg))) push(warnings, 'warn', `B2B-${gi}-${j}-RCHRG`, `B2B[${gi}].inv[${j}] rchrg must be Y or N`);
      if (inv.inv_typ && !INVOICE_TYPES.includes(String(inv.inv_typ))) push(warnings, 'warn', `B2B-${gi}-${j}-TYP`, `B2B[${gi}].inv[${j}] inv_typ unusual`);
      if (!((inv.itms as unknown[]) || []).length) push(warnings, 'warn', `B2B-${gi}-${j}-ITMS`, `B2B[${gi}].inv[${j}] no line items`);
      const inter = pos && gstin && pos !== gstin.slice(0, 2);
      let taxSum = 0;
      ((inv.itms as Array<Record<string, unknown>>) || []).forEach((it, k) => {
        const d = (it.itm_det as Record<string, unknown>) || {};
        if (!VALID_RATES.includes(num(d.rt))) push(warnings, 'warn', `B2B-${gi}-${j}-${k}-RT`, `B2B line rate ${d.rt}% not standard`);
        if (num(d.txval) < 0) push(errors, 'error', `B2B-${gi}-${j}-${k}-TX`, `B2B negative taxable`);
        if (inter && (d.camt != null || d.samt != null)) push(errors, 'error', `B2B-${gi}-${j}-${k}-INTER-CS`, `B2B inter-state must omit camt/samt`);
        if (!inter && d.iamt != null) push(errors, 'error', `B2B-${gi}-${j}-${k}-INTRA-I`, `B2B intra-state must omit iamt`);
        taxSum += num(d.txval) + num(d.iamt) + num(d.camt) + num(d.samt) + num(d.csamt);
      });
      if (Math.abs(round2(taxSum) - round2(num(inv.val))) > 0.05) {
        push(warnings, 'warn', `B2B-${gi}-${j}-VAL-MATCH`, `B2B[${gi}].inv[${j}] val ${inv.val} vs lines ${round2(taxSum)}`);
      }
    });
  });
}

function ruleB2cs(data: Record<string, unknown>, errors: ValidationIssue[], warnings: ValidationIssue[]) {
  ((data.b2cs as Array<Record<string, unknown>>) || []).forEach((r, i) => {
    if (!['INTER', 'INTRA'].includes(String(r.sply_ty))) push(warnings, 'warn', `B2CS-${i}-SPLY`, `B2CS[${i}] sply_ty must be INTER or INTRA`);
    if (r.typ !== 'OE') push(warnings, 'warn', `B2CS-${i}-TYP`, `B2CS[${i}] typ should be OE`);
    if (!r.pos) push(warnings, 'warn', `B2CS-${i}-POS`, `B2CS[${i}] missing pos`);
    if (!VALID_RATES.includes(num(r.rt))) push(warnings, 'warn', `B2CS-${i}-RT`, `B2CS[${i}] rate ${r.rt}% not standard`);
    if (r.sply_ty === 'INTRA' && r.iamt != null) push(errors, 'error', `B2CS-${i}-INTRA-I`, `B2CS INTRA must omit iamt`);
    if (r.sply_ty === 'INTER' && (r.camt != null || r.samt != null)) push(errors, 'error', `B2CS-${i}-INTER-CS`, `B2CS INTER must omit camt/samt`);
    if (num(r.txval) < 0) push(errors, 'error', `B2CS-${i}-NEG`, `B2CS negative taxable`);
  });
}

function ruleCdn(data: Record<string, unknown>, errors: ValidationIssue[], warnings: ValidationIssue[]) {
  ((data.cdnr as Array<Record<string, unknown>>) || []).forEach((g, gi) => {
    ((g.nt as Array<Record<string, unknown>>) || []).forEach((nt, j) => {
      if (!nt.nt_num) push(errors, 'error', `CDNR-${gi}-${j}-NUM`, `CDNR missing nt_num`);
      if (!nt.nt_dt || !DATE_RE.test(String(nt.nt_dt))) push(errors, 'error', `CDNR-${gi}-${j}-DT`, `CDNR invalid nt_dt`);
      if (!['C', 'D'].includes(String(nt.ntty))) push(warnings, 'warn', `CDNR-${gi}-${j}-NTTY`, `CDNR ntty must be C or D`);
      if (nt.inum && !nt.idt) push(errors, 'error', `CDNR-${gi}-${j}-IDT`, `CDNR has inum without idt`);
    });
  });
  ((data.cdnur as Array<Record<string, unknown>>) || []).forEach((row, i) => {
    if (row.nt) push(errors, 'error', `CDNUR-${i}-WRAP`, `CDNUR must be flat fields not nt[]`);
    if (!row.nt_num) push(errors, 'error', `CDNUR-${i}-NUM`, `CDNUR missing nt_num`);
    if (row.inum && !row.idt) push(errors, 'error', `CDNUR-${i}-IDT`, `CDNUR has inum without idt`);
  });
}

function ruleHsn(data: Record<string, unknown>, errors: ValidationIssue[], warnings: ValidationIssue[]) {
  const hsn = (data.hsn as Record<string, unknown>) || {};
  const rows = [
    ...((hsn.hsn_b2b as Array<Record<string, unknown>>) || []),
    ...((hsn.hsn_b2c as Array<Record<string, unknown>>) || [])
  ];
  if (hsn.data) push(errors, 'error', 'HSN-DEPRECATED', 'hsn.data deprecated — use hsn_b2b/hsn_b2c');
  rows.forEach((h, i) => {
    if (!h.hsn_sc) push(warnings, 'warn', `HSN-${i}-CODE`, `HSN[${i}] missing hsn_sc`);
    if (h.hsn_sc && String(h.hsn_sc).length < 4) push(warnings, 'warn', `HSN-${i}-LEN`, `HSN[${i}] code short`);
    if (!h.num) push(warnings, 'warn', `HSN-${i}-NUM`, `HSN[${i}] missing sequence num`);
    if (h.user_desc != null) push(errors, 'error', `HSN-${i}-DESC`, `HSN[${i}] must not contain user_desc`);
    if (!VALID_RATES.includes(num(h.rt))) push(warnings, 'warn', `HSN-${i}-RT`, `HSN rate ${h.rt}% not standard`);
    if (num(h.txval) < 0) push(errors, 'error', `HSN-${i}-NEG`, `HSN negative taxable`);
  });
}

export function validateGstr1Json(data: Record<string, unknown>): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  ruleHeader(data, errors, warnings);
  ruleB2b(data, errors, warnings);
  ruleB2cs(data, errors, warnings);
  ruleCdn(data, errors, warnings);
  ruleHsn(data, errors, warnings);
  return {
    errors: errors.map(e => e.msg),
    warnings: warnings.map(w => w.msg),
    details: { errors, warnings },
    ruleCount: errors.length + warnings.length,
    valid: errors.length === 0
  };
}

export function validateReturnJson(returnType: string, data: Record<string, unknown>): ValidationResult {
  if (returnType !== 'GSTR-1' && returnType !== 'GSTR-1A' && returnType !== 'GSTR-1 IFF') {
    return { errors: [], warnings: [], details: { errors: [], warnings: [] }, ruleCount: 0, valid: true };
  }
  return validateGstr1Json(data);
}