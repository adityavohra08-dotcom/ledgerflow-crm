'use client';

import { ModulePage } from '@/components/module-page';
import { api } from '@/lib/api-client';
import { DEMO_CTX } from '@/lib/demo-context';

export default function ProjectsPage() {
  return (
    <ModulePage
      title="Projects & Time Tracking"
      description="Project profitability, billable/non-billable time, timesheet billing, retainers."
      phase="Phase 3"
      features={[
        { label: 'Projects', status: 'api' },
        { label: 'Time entries', status: 'api' },
        { label: 'Timesheet billing', status: 'planned' },
        { label: 'Retainers', status: 'planned' }
      ]}
      columns={['Name', 'Code', 'Status', 'Budget Hrs']}
      fetchRows={async () => {
        const projects = await api.projects(DEMO_CTX) as Array<{ name: string; code?: string; status: string; budgetHours?: number }>;
        return projects.map(p => [p.name, p.code || '—', p.status, p.budgetHours ?? '—']);
      }}
    />
  );
}