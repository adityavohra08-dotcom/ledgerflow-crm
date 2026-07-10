'use client';

import { ModulePage } from '@/components/module-page';

export default function SettingsPage() {
  return (
    <ModulePage
      title="Settings"
      description="Custom roles, approval workflows, white-label branding, custom domain, automation rules."
      phase="Phase 3"
      features={[
        { label: 'Role-based access', status: 'api' },
        { label: 'Approval workflows', status: 'api' },
        { label: 'White-label', status: 'live' },
        { label: 'Custom fields', status: 'planned' }
      ]}
    />
  );
}