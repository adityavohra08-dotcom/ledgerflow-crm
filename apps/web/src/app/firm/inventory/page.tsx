'use client';

import { ModulePage } from '@/components/module-page';
import { api } from '@/lib/api-client';
import { DEMO_CTX } from '@/lib/demo-context';

export default function InventoryPage() {
  return (
    <ModulePage
      title="Inventory"
      description="Item master with HSN/SAC, warehouses, stock movements, FIFO/weighted average valuation."
      phase="Phase 2"
      features={[
        { label: 'Item master', status: 'api' },
        { label: 'Warehouses', status: 'api' },
        { label: 'Stock adjustments', status: 'api' },
        { label: 'Serial / batch tracking', status: 'planned' }
      ]}
      columns={['SKU', 'Name', 'HSN', 'GST %', 'Type']}
      fetchRows={async () => {
        const items = await api.items(DEMO_CTX) as Array<{ sku?: string; name: string; hsnSac: string; gstRate: number; type: string }>;
        return items.map(i => [i.sku || '—', i.name, i.hsnSac, i.gstRate, i.type]);
      }}
    />
  );
}