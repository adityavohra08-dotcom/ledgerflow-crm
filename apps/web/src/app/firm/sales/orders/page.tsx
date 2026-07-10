'use client';

import { ModulePage } from '@/components/module-page';

export default function SalesOrdersPage() {
  return (
    <ModulePage
      title="Sales Orders"
      description="Sales order workflow with convert-to-invoice. Links to delivery challans and inventory reservation."
      phase="Phase 1"
      features={[
        { label: 'Sales order CRUD', status: 'api' },
        { label: 'SO → Invoice', status: 'api' },
        { label: 'Stock reservation', status: 'planned' }
      ]}
    />
  );
}