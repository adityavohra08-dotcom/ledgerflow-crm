import { FirmSidebar } from '@/components/firm-sidebar';
import { ClientSwitcher } from '@/components/client-switcher';

export default function FirmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <FirmSidebar />
      <div className="pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur">
          <ClientSwitcher />
          <span className="text-xs text-muted-foreground">FY 2025-26 · Engine v2.0</span>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}