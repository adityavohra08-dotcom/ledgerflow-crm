'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PortalPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Customer Portal</h1>
      <p className="text-muted-foreground text-sm mt-1">Self-service: view invoices, download statements, pay online.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Outstanding Invoices</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Connect API with clientId to load live invoices.</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Payment</CardTitle></CardHeader>
          <CardContent><Button size="sm">Pay via UPI / Link</Button><p className="text-xs text-muted-foreground mt-2">Razorpay integration — Phase 2</p></CardContent>
        </Card>
      </div>
    </main>
  );
}