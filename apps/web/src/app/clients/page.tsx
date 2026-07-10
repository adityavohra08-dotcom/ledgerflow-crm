import { AppNav } from '../../components/app-nav';

const demoClients = [
  { name: 'Sharma Traders', gstin: '07AABCT1234D1Z5', status: 'Active', returns: 'GSTR-1, 3B' },
  { name: 'BKC Associates', gstin: '07BKCPA6670H1ZB', status: 'Attention', returns: 'GSTR-1 — CDN fix needed' },
  { name: 'Demo Exporter', gstin: '18ABJFM4031F1ZF', status: 'Active', returns: 'GSTR-1, 2B recon' }
];

export default function ClientsPage() {
  return (
    <>
      <AppNav />
      <main style={{ maxWidth: 960, margin: '2rem auto', padding: '0 1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 600 }}>Clients</h1>
        <p style={{ color: '#94a3b8', marginTop: 8 }}>
          Demo client matrix — production data lives in the Express SPA JSON store.
        </p>
        <table style={{ width: '100%', marginTop: '1.5rem', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155', color: '#64748b', textAlign: 'left' }}>
              <th style={{ padding: '0.75rem 0' }}>Client</th>
              <th>GSTIN</th>
              <th>Status</th>
              <th>Returns</th>
            </tr>
          </thead>
          <tbody>
            {demoClients.map(c => (
              <tr key={c.gstin} style={{ borderBottom: '1px solid #1e293b' }}>
                <td style={{ padding: '0.85rem 0', fontWeight: 500 }}>{c.name}</td>
                <td style={{ fontFamily: 'monospace', color: '#a5f3fc' }}>{c.gstin}</td>
                <td style={{ color: c.status === 'Attention' ? '#fcd34d' : '#6ee7b7' }}>{c.status}</td>
                <td style={{ color: '#94a3b8' }}>{c.returns}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </>
  );
}