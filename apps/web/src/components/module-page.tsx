'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { useEffect, useState } from 'react';

type Feature = { label: string; status: 'live' | 'api' | 'planned' };

export function ModulePage({
  title,
  description,
  phase,
  features,
  columns,
  fetchRows,
  actions
}: {
  title: string;
  description: string;
  phase: string;
  features: Feature[];
  columns?: string[];
  fetchRows?: () => Promise<(string | number)[][]>;
  actions?: { label: string; href?: string }[];
}) {
  const [rows, setRows] = useState<(string | number)[][]>([]);
  const [loading, setLoading] = useState(!!fetchRows);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!fetchRows) return;
    fetchRows()
      .then(setRows)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [fetchRows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge>{phase}</Badge>
            <Badge variant="success">Zoho Books parity</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">{description}</p>
        </div>
        <div className="flex gap-2">
          {actions?.map(a =>
            a.href ? (
              <a key={a.label} href={a.href} className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs hover:bg-muted">{a.label}</a>
            ) : (
              <Button key={a.label} variant="outline" size="sm">{a.label}</Button>
            )
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {features.map(f => (
          <Card key={f.label}>
            <CardHeader>
              <CardTitle className="text-sm">{f.label}</CardTitle>
              <CardDescription>
                <Badge variant={f.status === 'live' ? 'success' : f.status === 'api' ? 'default' : 'warn'}>
                  {f.status}
                </Badge>
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {columns && (
        <Card>
          <CardHeader>
            <CardTitle>Records</CardTitle>
            <CardDescription>{loading ? 'Loading…' : error || `${rows.length} row(s)`}</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-amber-400 text-sm">{error} — connect API + Postgres or use legacy CRM.</p>
            ) : (
              <DataTable columns={columns} rows={rows} empty={loading ? 'Loading…' : undefined} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}