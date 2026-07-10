'use client';

import { ModulePage } from '@/components/module-page';

export default function EinvoicePage() {
  return (
    <ModulePage
      title="e-Invoice & e-Way Bill"
      description="IRN + QR generation, e-Way Bill lifecycle. ₹5 Cr threshold check per client."
      phase="Phase 3"
      features={[
        { label: 'e-Way Bill (demo)', status: 'live' },
        { label: 'IRN generation', status: 'planned' },
        { label: 'GSP integration', status: 'planned' }
      ]}
      actions={[{ label: 'E-Way Bill (legacy)', href: 'https://ledgerflow-crm-production.up.railway.app' }]}
    />
  );
}