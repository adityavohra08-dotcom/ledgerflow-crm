'use client';

import { ModulePage } from '@/components/module-page';
import { api } from '@/lib/api-client';
import { DEMO_CTX } from '@/lib/demo-context';

export default function GstPage() {
  return (
    <ModulePage
      title="GST Returns & 2B Recon"
      description="GSTR-1/3B/9 export v1.4.0, GSTR-2B import, fuzzy recon, IMS buckets."
      phase="Phase 1"
      features={[
        { label: 'GSTR export v1.4.0', status: 'live' },
        { label: '2B recon API', status: 'api' },
        { label: 'GSTR-1A diff', status: 'live' },
        { label: 'IMS actions', status: 'api' }
      ]}
      columns={['Return', 'Period', 'Status', 'ARN']}
      fetchRows={async () => {
        const filings = await api.gstFilings(DEMO_CTX) as Array<{ returnType: string; period: string; status: string; arn?: string }>;
        return filings.map(f => [f.returnType, f.period, f.status, f.arn || '—']);
      }}
      actions={[{ label: 'Returns Hub (legacy)', href: 'https://ledgerflow-crm-production.up.railway.app' }]}
    />
  );
}