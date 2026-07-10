'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, FileText, ShoppingCart, Landmark, Package,
  BookOpen, Receipt, FolderKanban, BarChart3, Settings, Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/firm/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/firm/clients', label: 'Clients', icon: Users },
  { section: 'Sales' },
  { href: '/firm/sales', label: 'Quotes & Invoices', icon: FileText },
  { href: '/firm/sales/orders', label: 'Sales Orders', icon: FileText },
  { section: 'Purchases' },
  { href: '/firm/purchases', label: 'Bills & POs', icon: ShoppingCart },
  { href: '/firm/purchases/expenses', label: 'Expenses', icon: ShoppingCart },
  { section: 'Banking' },
  { href: '/firm/banking', label: 'Bank Accounts', icon: Landmark },
  { href: '/firm/banking/recon', label: 'Reconciliation', icon: Landmark },
  { section: 'Inventory' },
  { href: '/firm/inventory', label: 'Items & Stock', icon: Package },
  { section: 'Accounting' },
  { href: '/firm/accounting/coa', label: 'Chart of Accounts', icon: BookOpen },
  { href: '/firm/accounting/journals', label: 'Journals', icon: BookOpen },
  { section: 'GST' },
  { href: '/firm/gst', label: 'Returns & 2B', icon: Receipt },
  { href: '/firm/gst/einvoice', label: 'e-Invoice & EWB', icon: Receipt },
  { section: 'Projects' },
  { href: '/firm/projects', label: 'Projects & Time', icon: FolderKanban },
  { section: 'Reports' },
  { href: '/firm/reports', label: 'P&L & Reports', icon: BarChart3 },
  { section: 'Settings' },
  { href: '/firm/settings', label: 'Roles & Branding', icon: Settings },
  { href: '/portal', label: 'Customer Portal', icon: Globe }
];

export function FirmSidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span className="font-bold text-primary">LedgerFlow</span>
        <span className="text-xs text-muted-foreground">Books</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {NAV.map((item, i) => {
          if ('section' in item) {
            return <div key={i} className="pt-4 pb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.section}</div>;
          }
          const Icon = item.icon!;
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href!}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors',
                active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3 text-xs text-muted-foreground">
        <a href="https://ledgerflow-crm-production.up.railway.app" className="text-primary hover:underline">Legacy CRM →</a>
      </div>
    </aside>
  );
}