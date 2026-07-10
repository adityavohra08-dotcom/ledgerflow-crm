'use client';

import { ModulePage } from '@/components/module-page';

export default function ReconPage() {
  return (
    <ModulePage
      title="Bank Reconciliation"
      description="Smart matching by amount, date tolerance, and description fuzzy score. Bulk match and exclude."
      phase="Phase 2"
      features={[
        { label: 'Unmatched feed view', status: 'api' },
        { label: 'Fuzzy matcher', status: 'live' },
        { label: 'Bulk match', status: 'api' },
        { label: 'Statement close', status: 'api' }
      ]}
      actions={[{ label: 'Legacy Recon UI', href: 'https://ledgerflow-crm-production.up.railway.app' }]}
    />
  );
}