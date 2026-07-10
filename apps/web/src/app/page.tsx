import Link from 'next/link';
import { AppNav } from '../components/app-nav';

export default function HomePage() {
  return (
    <>
      <AppNav />
      <main style={{ maxWidth: 720, margin: '3rem auto', padding: '0 1.5rem' }}>
        <p style={{ color: '#5eead4', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          LedgerFlow Phases 2–5
        </p>
        <h1 style={{ fontSize: '2rem', fontWeight: 600, marginTop: 8 }}>Next.js migration shell</h1>
        <p style={{ color: '#94a3b8', lineHeight: 1.6, marginTop: 12 }}>
          Production CRM runs the Express + vanilla SPA at the repo root. This app is the Postgres / Prisma target wired
          to <code style={{ color: '#a5f3fc' }}>packages/db</code> and{' '}
          <code style={{ color: '#a5f3fc' }}>packages/gst-engine</code> (validators + recon matcher).
        </p>
        <div style={{ display: 'flex', gap: '1rem', marginTop: 28, flexWrap: 'wrap' }}>
          <Link href="/dashboard" style={{ color: '#0f172a', background: '#2dd4bf', padding: '0.6rem 1.2rem', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
            Open dashboard
          </Link>
          <Link href="/clients" style={{ color: '#e2e8f0', border: '1px solid #334155', padding: '0.6rem 1.2rem', borderRadius: 8, textDecoration: 'none', fontSize: 14 }}>
            View clients
          </Link>
          <Link href="/returns" style={{ color: '#e2e8f0', border: '1px solid #334155', padding: '0.6rem 1.2rem', borderRadius: 8, textDecoration: 'none', fontSize: 14 }}>
            GST returns
          </Link>
        </div>
        <ul style={{ color: '#cbd5e1', lineHeight: 1.8, marginTop: 32 }}>
          <li>GSTR export v1.4.0 — 200+ validation rules, portal-safe JSON</li>
          <li>Returns Hub v2.1.0 — bulk ZIP, PDFs, offline sync</li>
          <li>Tally XML + Zoho CSV import, GSTR-1A diff, GSP filing scaffold</li>
          <li>Per-client usage metering, multi-tenant auth routing</li>
        </ul>
      </main>
    </>
  );
}