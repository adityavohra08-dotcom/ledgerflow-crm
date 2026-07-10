'use client';

import { ModulePage } from '@/components/module-page';
import { api } from '@/lib/api-client';
import { DEMO_CTX } from '@/lib/demo-context';
import { formatINR } from '@/lib/utils';

export default function PurchasesPage() {
  return (
    <ModulePage
      title="Purchases — Bills & POs"
      description="Vendor bills with ITC tracking, purchase orders, 2-way/3-way matching."
      phase="Phase 1"
      features={[
        { label: 'Vendor bills', status: 'api' },
        { label: 'Purchase orders', status: 'api' },
        { label: 'Bill matching', status: 'api' },
        { label: 'Receipt OCR', status: 'planned' }
      ]}
      columns={['Number', 'Date', 'Total', 'ITC', 'Status']}
      fetchRows={async () => {
        const bills = await api.bills(DEMO_CTX) as Array<{ number: string; date: string; grandTotal: number; itcEligible: boolean; status: string }>;
        return bills.map(b => [b.number, String(b.date).slice(0, 10), formatINR(Number(b.grandTotal)), b.itcEligible ? 'Yes' : 'No', b.status]);
      }}
    />
  );
}