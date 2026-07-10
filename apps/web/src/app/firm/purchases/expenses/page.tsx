'use client';

import { ModulePage } from '@/components/module-page';

export default function ExpensesPage() {
  return (
    <ModulePage
      title="Expenses"
      description="Expense tracking with receipt upload and OCR (Phase 3). ITC eligibility per line."
      phase="Phase 2"
      features={[
        { label: 'Expense entry', status: 'api' },
        { label: 'Receipt OCR', status: 'planned' },
        { label: 'Recurring expenses', status: 'planned' }
      ]}
    />
  );
}