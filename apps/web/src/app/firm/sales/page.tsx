'use client';

import { ModulePage } from '@/components/module-page';
import { api } from '@/lib/api-client';
import { DEMO_CTX } from '@/lib/demo-context';
import { formatINR } from '@/lib/utils';

export default function SalesPage() {
  return (
    <ModulePage
      title="Sales — Quotes & Invoices"
      description="GST-compliant tax invoices, bill of supply, credit notes. Integrates with Rule 46 invoice maker and double-entry posting."
      phase="Phase 1"
      features={[
        { label: 'Tax Invoice / BOS', status: 'live' },
        { label: 'Quote → Invoice convert', status: 'api' },
        { label: 'e-Invoice IRN', status: 'planned' },
        { label: 'Payment links', status: 'planned' }
      ]}
      columns={['Number', 'Party', 'Date', 'Total', 'Status']}
      fetchRows={async () => {
        const inv = await api.invoices(DEMO_CTX) as Array<{ number: string; partyName: string; date: string; grandTotal: number; status: string }>;
        return inv.map(i => [i.number, i.partyName, String(i.date).slice(0, 10), formatINR(Number(i.grandTotal)), i.status]);
      }}
      actions={[{ label: 'Legacy Invoice Maker', href: 'https://ledgerflow-crm-production.up.railway.app' }]}
    />
  );
}