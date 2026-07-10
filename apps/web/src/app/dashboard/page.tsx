import { AppNav } from '../../components/app-nav';

const stats = [
  { label: 'GSTR export engine', value: 'v1.4.0', detail: '200+ validation rules, offline JSON' },
  { label: 'Returns Hub', value: 'v2.1.0', detail: 'Bulk ZIP, 2B recon, section CSVs' },
  { label: 'Compliance Suite', value: 'v2.0.0', detail: 'Tally/Zoho import, GSP filing, metering' },
  { label: 'Recon engine', value: 'v2.0.0', detail: 'Fuzzy match, IMS buckets' }
];

export default function DashboardPage() {
  return (
    <>
      <AppNav />
      <main style={{ maxWidth: 960, margin: '2rem auto', padding: '0 1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 600 }}>CA Practice Dashboard</h1>
        <p style={{ color: '#94a3b8', marginTop: 8, lineHeight: 1.6 }}>
          Migration target for LedgerFlow — Postgres via <code style={{ color: '#a5f3fc' }}>packages/db</code> and
          shared GST logic in <code style={{ color: '#a5f3fc' }}>packages/gst-engine</code>.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '1rem',
            marginTop: '2rem'
          }}
        >
          {stats.map(s => (
            <div
              key={s.label}
              style={{ background: '#1e293b', borderRadius: 12, padding: '1.25rem', border: '1px solid #334155' }}
            >
              <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {s.label}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#5eead4', marginTop: 6 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>{s.detail}</div>
            </div>
          ))}
        </div>
        <section style={{ marginTop: '2.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12 }}>Phase roadmap</h2>
          <ul style={{ color: '#cbd5e1', lineHeight: 1.9, paddingLeft: '1.25rem' }}>
            <li>Phase 1 — Returns Hub, recon, bulk ZIP ✓</li>
            <li>Phase 2 — Tally XML + Zoho CSV import ✓</li>
            <li>Phase 3 — Multi-tenant auth routing (subdomain / header) ✓</li>
            <li>Phase 4 — GSTR-1A diff, GSP filing scaffold ✓</li>
            <li>Phase 5 — Usage metering, offline queue, bulk PDFs ✓</li>
          </ul>
        </section>
      </main>
    </>
  );
}