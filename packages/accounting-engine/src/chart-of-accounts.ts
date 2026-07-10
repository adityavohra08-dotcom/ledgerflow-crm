import type { CoaAccountSeed } from './types.js';

/**
 * Indian-friendly Chart of Accounts template (Schedule III inspired).
 * Seeded per client on onboarding. System accounts cannot be deleted.
 */
export const INDIAN_COA_TEMPLATE: CoaAccountSeed[] = [
  // Assets
  { code: '1000', name: 'Assets', type: 'ASSET', subType: 'OTHER', isGroup: true, isSystem: true },
  { code: '1100', name: 'Current Assets', type: 'ASSET', subType: 'OTHER', parentCode: '1000', isGroup: true, isSystem: true },
  { code: '1110', name: 'Cash', type: 'ASSET', subType: 'CASH', parentCode: '1100', isSystem: true },
  { code: '1120', name: 'Bank Accounts', type: 'ASSET', subType: 'BANK', parentCode: '1100', isGroup: true, isSystem: true },
  { code: '1130', name: 'Accounts Receivable', type: 'ASSET', subType: 'ACCOUNTS_RECEIVABLE', parentCode: '1100', isSystem: true },
  { code: '1140', name: 'Inventory', type: 'ASSET', subType: 'INVENTORY', parentCode: '1100', isSystem: true },
  { code: '1150', name: 'Input CGST', type: 'ASSET', subType: 'GST_INPUT', parentCode: '1100', isSystem: true },
  { code: '1151', name: 'Input SGST', type: 'ASSET', subType: 'GST_INPUT', parentCode: '1100', isSystem: true },
  { code: '1152', name: 'Input IGST', type: 'ASSET', subType: 'GST_INPUT', parentCode: '1100', isSystem: true },
  { code: '1200', name: 'Fixed Assets', type: 'ASSET', subType: 'FIXED_ASSET', parentCode: '1000', isGroup: true, isSystem: true },
  { code: '1210', name: 'Plant & Machinery', type: 'ASSET', subType: 'FIXED_ASSET', parentCode: '1200' },
  { code: '1220', name: 'Furniture & Fixtures', type: 'ASSET', subType: 'FIXED_ASSET', parentCode: '1200' },

  // Liabilities
  { code: '2000', name: 'Liabilities', type: 'LIABILITY', subType: 'OTHER', isGroup: true, isSystem: true },
  { code: '2100', name: 'Current Liabilities', type: 'LIABILITY', subType: 'OTHER', parentCode: '2000', isGroup: true, isSystem: true },
  { code: '2110', name: 'Accounts Payable', type: 'LIABILITY', subType: 'ACCOUNTS_PAYABLE', parentCode: '2100', isSystem: true },
  { code: '2120', name: 'Output CGST', type: 'LIABILITY', subType: 'GST_OUTPUT', parentCode: '2100', isSystem: true },
  { code: '2121', name: 'Output SGST', type: 'LIABILITY', subType: 'GST_OUTPUT', parentCode: '2100', isSystem: true },
  { code: '2122', name: 'Output IGST', type: 'LIABILITY', subType: 'GST_OUTPUT', parentCode: '2100', isSystem: true },
  { code: '2130', name: 'GST Payable', type: 'LIABILITY', subType: 'GST_PAYABLE', parentCode: '2100', isSystem: true },
  { code: '2140', name: 'TDS Payable', type: 'LIABILITY', subType: 'OTHER', parentCode: '2100' },

  // Equity
  { code: '3000', name: 'Equity', type: 'EQUITY', subType: 'OTHER', isGroup: true, isSystem: true },
  { code: '3100', name: 'Capital Account', type: 'EQUITY', subType: 'OTHER', parentCode: '3000', isSystem: true },
  { code: '3200', name: 'Retained Earnings', type: 'EQUITY', subType: 'OTHER', parentCode: '3000', isSystem: true },

  // Income
  { code: '4000', name: 'Income', type: 'INCOME', subType: 'OTHER', isGroup: true, isSystem: true },
  { code: '4100', name: 'Sales', type: 'INCOME', subType: 'SALES', parentCode: '4000', isSystem: true },
  { code: '4110', name: 'Sales — Taxable', type: 'INCOME', subType: 'SALES', parentCode: '4100' },
  { code: '4120', name: 'Sales — Exempt / Nil', type: 'INCOME', subType: 'SALES', parentCode: '4100' },
  { code: '4200', name: 'Other Income', type: 'INCOME', subType: 'OTHER', parentCode: '4000' },

  // Expenses
  { code: '5000', name: 'Expenses', type: 'EXPENSE', subType: 'OTHER', isGroup: true, isSystem: true },
  { code: '5100', name: 'Cost of Goods Sold', type: 'EXPENSE', subType: 'DIRECT_EXPENSE', parentCode: '5000', isSystem: true },
  { code: '5200', name: 'Purchase', type: 'EXPENSE', subType: 'PURCHASE', parentCode: '5000', isSystem: true },
  { code: '5300', name: 'Operating Expenses', type: 'EXPENSE', subType: 'INDIRECT_EXPENSE', parentCode: '5000', isGroup: true },
  { code: '5310', name: 'Rent', type: 'EXPENSE', subType: 'INDIRECT_EXPENSE', parentCode: '5300' },
  { code: '5320', name: 'Salaries', type: 'EXPENSE', subType: 'INDIRECT_EXPENSE', parentCode: '5300' },
  { code: '5330', name: 'Professional Fees', type: 'EXPENSE', subType: 'INDIRECT_EXPENSE', parentCode: '5300' },
  { code: '5340', name: 'Bank Charges', type: 'EXPENSE', subType: 'INDIRECT_EXPENSE', parentCode: '5300' }
];

/** Resolve parent-child ordering for DB insert */
export function sortCoaForInsert(accounts: CoaAccountSeed[]): CoaAccountSeed[] {
  const byCode = new Map(accounts.map(a => [a.code, a]));
  const sorted: CoaAccountSeed[] = [];
  const seen = new Set<string>();

  const visit = (code: string) => {
    if (seen.has(code)) return;
    const acc = byCode.get(code);
    if (!acc) return;
    if (acc.parentCode) visit(acc.parentCode);
    seen.add(code);
    sorted.push(acc);
  };

  accounts.forEach(a => visit(a.code));
  return sorted;
}

/** Flat tree for UI rendering */
export interface CoaTreeNode extends CoaAccountSeed {
  children: CoaTreeNode[];
  depth: number;
}

export function buildCoaTree(accounts: CoaAccountSeed[]): CoaTreeNode[] {
  const nodes = new Map<string, CoaTreeNode>();
  accounts.forEach(a => nodes.set(a.code, { ...a, children: [], depth: 0 }));

  const roots: CoaTreeNode[] = [];
  nodes.forEach(node => {
    if (node.parentCode && nodes.has(node.parentCode)) {
      const parent = nodes.get(node.parentCode)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortChildren = (list: CoaTreeNode[]) => {
    list.sort((a, b) => a.code.localeCompare(b.code));
    list.forEach(c => sortChildren(c.children));
  };
  sortChildren(roots);
  return roots;
}