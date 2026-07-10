import Link from 'next/link';

const links = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/clients', label: 'Clients' },
  { href: '/returns', label: 'Returns' }
];

export function AppNav() {
  return (
    <nav
      style={{
        display: 'flex',
        gap: '1.25rem',
        padding: '1rem 1.5rem',
        borderBottom: '1px solid #1e293b',
        background: '#0b1220'
      }}
    >
      <span style={{ fontWeight: 700, color: '#5eead4', marginRight: '0.5rem' }}>LedgerFlow</span>
      {links.map(l => (
        <Link key={l.href} href={l.href} style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 14 }}>
          {l.label}
        </Link>
      ))}
      <a
        href="https://ledgerflow-crm-production.up.railway.app"
        style={{ color: '#2dd4bf', textDecoration: 'none', fontSize: 14, marginLeft: 'auto' }}
      >
        Live CRM →
      </a>
    </nav>
  );
}