'use client';

import { ModulePage } from '@/components/module-page';
import { api } from '@/lib/api-client';
import { DEMO_CTX } from '@/lib/demo-context';

export default function ClientsPage() {
  return (
    <ModulePage
      title="Clients"
      description="Multi-client books — each client has isolated CoA, journals, inventory, and GST returns."
      phase="Phase 3"
      features={[
        { label: 'Client onboarding + CoA seed', status: 'api' },
        { label: 'Multi-GSTIN per client', status: 'api' },
        { label: 'White-label portal', status: 'live' }
      ]}
      columns={['Name', 'State', 'GSTIN', 'Status']}
      fetchRows={async () => {
        const clients = await api.clients(DEMO_CTX) as Array<{ legalName: string; stateCode: string; gstins?: { gstin: string }[]; isActive: boolean }>;
        return clients.map(c => [c.legalName, c.stateCode, c.gstins?.[0]?.gstin || '—', c.isActive ? 'Active' : 'Inactive']);
      }}
    />
  );
}