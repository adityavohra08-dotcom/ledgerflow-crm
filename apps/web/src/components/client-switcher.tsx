'use client';

export function ClientSwitcher() {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Client:</span>
      <select className="rounded-md border border-border bg-background px-2 py-1 text-sm" defaultValue="demo">
        <option value="demo">Sharma Traders (07AABCT1234D1Z5)</option>
        <option value="bkc">BKC Associates (07BKCPA6670H1ZB)</option>
      </select>
    </div>
  );
}