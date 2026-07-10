import { AppNav } from '../../components/app-nav';

const returnTypes = [
  { type: 'GSTR-1', schema: 'GST3.2.4', features: 'B2B/B2CS/CDN, offline JSON, 200+ rules' },
  { type: 'GSTR-1 IFF', schema: 'GST3.2.4', features: 'B2B &gt; ₹2.5L quarterly option' },
  { type: 'GSTR-1A', schema: 'GST3.2.4', features: 'Amendment diff vs baseline snapshot' },
  { type: 'GSTR-3B', schema: 'Portal', features: 'Table 3.1/4 hard-lock warnings' },
  { type: 'GSTR-9 / 9C', schema: 'Annual', features: 'FY summary + reconciliation' }
];

export default function ReturnsPage() {
  return (
    <>
      <AppNav />
      <main style={{ maxWidth: 960, margin: '2rem auto', padding: '0 1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 600 }}>GST Returns</h1>
        <p style={{ color: '#94a3b8', marginTop: 8, lineHeight: 1.6 }}>
          Export engine <strong style={{ color: '#5eead4' }}>v1.4.0</strong> — portal filename{' '}
          <code style={{ color: '#a5f3fc' }}>returns_DDMMYYYY_R1_GSTIN_offline.json</code>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
          {returnTypes.map(r => (
            <div
              key={r.type}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 10,
                padding: '1rem 1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{r.type}</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>{r.features}</div>
              </div>
              <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{r.schema}</span>
            </div>
          ))}
        </div>
        <p style={{ marginTop: '2rem', fontSize: 13, color: '#64748b' }}>
          Generate returns in the live CRM under GSTR Export or Returns Hub. Hard-refresh (Ctrl+F5) after deploy to load
          engine v1.4.0.
        </p>
      </main>
    </>
  );
}