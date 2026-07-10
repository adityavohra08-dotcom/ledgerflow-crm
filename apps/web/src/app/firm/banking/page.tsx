'use client';

import { ModulePage } from '@/components/module-page';
import { api } from '@/lib/api-client';
import { DEMO_CTX } from '@/lib/demo-context';

export default function BankingPage() {
  return (
    <ModulePage
      title="Banking"
      description="Multi-bank accounts, CSV import, smart reconciliation (ported from bank-reconciliation.js)."
      phase="Phase 2"
      features={[
        { label: 'Bank accounts', status: 'api' },
        { label: 'CSV/OFX import', status: 'api' },
        { label: 'Bank feeds (Perfios)', status: 'planned' },
        { label: 'Cash flow forecast', status: 'planned' }
      ]}
      columns={['Bank', 'Account', 'IFSC', 'Opening']}
      fetchRows={async () => {
        const accs = await api.bankAccounts(DEMO_CTX) as Array<{ bankName: string; accountNumber: string; ifsc?: string; openingBalance: number }>;
        return accs.map(a => [a.bankName, a.accountNumber, a.ifsc || '—', a.openingBalance]);
      }}
    />
  );
}