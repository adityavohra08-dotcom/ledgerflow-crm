export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: '4rem auto', padding: '0 1.5rem' }}>
      <p style={{ color: '#5eead4', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        LedgerFlow Phase 2
      </p>
      <h1 style={{ fontSize: '2rem', fontWeight: 600, marginTop: 8 }}>Next.js migration shell</h1>
      <p style={{ color: '#94a3b8', lineHeight: 1.6, marginTop: 12 }}>
        Production CRM still runs the Express + vanilla SPA at the repo root. This app is the Postgres / Prisma
        target wired to <code style={{ color: '#a5f3fc' }}>packages/db</code> and{' '}
        <code style={{ color: '#a5f3fc' }}>packages/gst-engine</code>.
      </p>
      <ul style={{ color: '#cbd5e1', lineHeight: 1.8, marginTop: 24 }}>
        <li>GST recon engine v2 — buckets, IMS actions</li>
        <li>GSTR export engine v1.3.1 — IFF, 9C, offline CSV ZIP, 3B hard-lock</li>
        <li>Returns Hub v2 — bulk ZIP, section CSVs, validation reports</li>
      </ul>
      <p style={{ marginTop: 32 }}>
        <a href="https://ledgerflow-crm-production.up.railway.app" style={{ color: '#2dd4bf' }}>
          Open live CRM →
        </a>
      </p>
    </main>
  );
}