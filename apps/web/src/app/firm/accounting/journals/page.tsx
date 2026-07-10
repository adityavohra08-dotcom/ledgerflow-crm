'use client';

import { ModulePage } from '@/components/module-page';
import { api } from '@/lib/api-client';
import { DEMO_CTX } from '@/lib/demo-context';

export default function JournalsPage() {
  return (
    <ModulePage
      title="Journal Entries"
      description="Manual journals, recurring journals, templates. Invoice/bill auto-posting via accounting-engine."
      phase="Phase 1"
      features={[
        { label: 'Manual journals', status: 'api' },
        { label: 'Invoice posting', status: 'api' },
        { label: 'Period locking', status: 'api' },
        { label: 'Reversals', status: 'planned' }
      ]}
      columns={['Number', 'Date', 'Source', 'Status', 'Narration']}
      fetchRows={async () => {
        const journals = await api.journals(DEMO_CTX) as Array<{ number: string; date: string; source: string; status: string; narration?: string }>;
        return journals.map(j => [j.number, String(j.date).slice(0, 10), j.source, j.status, j.narration || '—']);
      }}
    />
  );
}