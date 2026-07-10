import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6">
      <p className="text-sm font-semibold uppercase tracking-wider text-primary">LedgerFlow Books v2.0</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Zoho Books-class Indian GST accounting</h1>
      <p className="mt-4 text-muted-foreground leading-relaxed">
        Full double-entry accounting, sales & purchase cycles, banking, inventory, GST compliance, projects, and reports —
        built for CA firms managing hundreds of clients. Your legacy GST Invoice Maker and GSTR export v1.4.0 remain live.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/firm/dashboard"><Button>Open Firm Dashboard</Button></Link>
        <Link href="/portal"><Button variant="outline">Customer Portal</Button></Link>
        <a href="https://ledgerflow-crm-production.up.railway.app"><Button variant="ghost">Legacy CRM</Button></a>
      </div>
      <ul className="mt-10 space-y-2 text-sm text-muted-foreground">
        <li>Phase 1 — Accounting + GST + Sales/Purchase</li>
        <li>Phase 2 — Inventory + Banking + Payments</li>
        <li>Phase 3 — Projects + Automation + Advanced reports</li>
      </ul>
    </main>
  );
}