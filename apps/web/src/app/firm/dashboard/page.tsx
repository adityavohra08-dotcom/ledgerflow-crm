'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';
import { formatINR } from '@/lib/utils';
import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [health, setHealth] = useState<{ ok?: boolean; postgres?: boolean }>({});
  const [pnl, setPnl] = useState<{ income?: number; expenses?: number; netProfit?: number }>({});

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
  }, []);

  const kpis = [
    { label: 'API Status', value: health.ok ? 'Online' : 'Offline' },
    { label: 'PostgreSQL', value: health.postgres ? 'Connected' : 'Not connected' },
    { label: 'GSTR Engine', value: 'v1.4.0' },
    { label: 'Net Profit (demo)', value: pnl.netProfit != null ? formatINR(pnl.netProfit) : '—' }
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{k.value}</p></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>All phases shipped</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>✓ Phase 1 — CoA, journals, posting, sales, purchases, GST API</p>
          <p>✓ Phase 2 — Banking, inventory, stock, recon</p>
          <p>✓ Phase 3 — Projects, time tracking, automation approvals</p>
          <p className="pt-2">Connect <code className="text-primary">DATABASE_URL</code> + run <code className="text-primary">npm run db:migrate</code> for live data.</p>
        </CardContent>
      </Card>
    </div>
  );
}