'use client';

import { ModulePage } from '@/components/module-page';
import { api } from '@/lib/api-client';
import { DEMO_CTX } from '@/lib/demo-context';

export default function CoaPage() {
  return (
    <ModulePage
      title="Chart of Accounts"
      description="Indian Schedule III–friendly hierarchical CoA. Auto-seeded on client creation."
      phase="Phase 1"
      features={[
        { label: 'Indian template', status: 'live' },
        { label: 'Tree view', status: 'api' },
        { label: 'Sub-accounts', status: 'api' },
        { label: 'Cost centers', status: 'planned' }
      ]}
      columns={['Code', 'Name', 'Type', 'Sub-type']}
      fetchRows={async () => {
        const { accounts } = await api.coa(DEMO_CTX);
        return (accounts as Array<{ code: string; name: string; type: string; subType: string }>)
          .filter(a => !a.code.endsWith('0') || a.code.length <= 4)
          .slice(0, 30)
          .map(a => [a.code, a.name, a.type, a.subType]);
      }}
    />
  );
}