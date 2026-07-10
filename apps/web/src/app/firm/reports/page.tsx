'use client';

import { ModulePage } from '@/components/module-page';
import { api } from '@/lib/api-client';
import { DEMO_CTX } from '@/lib/demo-context';
import { formatINR } from '@/lib/utils';

export default function ReportsPage() {
  return (
    <ModulePage
      title="Reports & Analytics"
      description="P&L, Balance Sheet, Trial Balance, aging, GST reports. Scheduled email reports (Phase 3)."
      phase="Phase 1–3"
      features={[
        { label: 'Trial Balance', status: 'api' },
        { label: 'Profit & Loss', status: 'api' },
        { label: 'Aging AR/AP', status: 'planned' },
        { label: 'Scheduled reports', status: 'planned' }
      ]}
      columns={['Account', 'Debit', 'Credit', 'Balance']}
      fetchRows={async () => {
        const tb = await api.trialBalance(DEMO_CTX) as Array<{ accountCode: string; accountName: string; debit: number; credit: number; balance: number }>;
        return tb.slice(0, 25).map(r => [r.accountCode + ' ' + r.accountName, formatINR(r.debit), formatINR(r.credit), formatINR(r.balance)]);
      }}
    />
  );
}