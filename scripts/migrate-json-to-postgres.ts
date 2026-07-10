/**
 * Migrate legacy backend/data/store.json → PostgreSQL
 * Usage: DATABASE_URL=postgresql://... npx tsx scripts/migrate-json-to-postgres.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();
const TENANT_SLUG = process.env.DEFAULT_TENANT_ID || 'udyog-suvidha';

interface LegacyClient {
  id: string;
  name: string;
  gstin?: string;
  stateCode?: string;
  pan?: string;
  invoices?: Array<Record<string, unknown>>;
  purchases?: Array<Record<string, unknown>>;
}

async function main() {
  const storePath = path.join(__dirname, '../backend/data/store.json');
  if (!fs.existsSync(storePath)) {
    console.log('No store.json found — run backend seed first or point DATABASE_URL and use indian-coa seed');
    return;
  }

  const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  const tenantData = store.tenants?.[TENANT_SLUG];
  if (!tenantData) throw new Error(`Tenant ${TENANT_SLUG} not in store.json`);

  const tenant = await prisma.tenant.upsert({
    where: { slug: TENANT_SLUG },
    create: { slug: TENANT_SLUG, name: tenantData.firmSettings?.name || 'LedgerFlow Firm' },
    update: {}
  });

  const clients = tenantData.clients || {};
  let migrated = 0;

  for (const [legacyId, c] of Object.entries(clients) as [string, LegacyClient][]) {
    const existing = await prisma.client.findFirst({
      where: { tenantId: tenant.id, legalName: c.name }
    });
    const client = existing ?? await prisma.client.create({
      data: {
        tenantId: tenant.id,
        legalName: c.name,
        stateCode: c.stateCode || '07',
        pan: c.pan,
        settings: { create: {} }
      }
    });

    if (c.gstin) {
      await prisma.clientGstin.upsert({
        where: { gstin: c.gstin },
        create: { clientId: client.id, gstin: c.gstin, stateCode: c.stateCode || '07', isPrimary: true },
        update: {}
      });
    }

    for (const inv of c.invoices || []) {
      const num = String(inv.number || '');
      if (!num) continue;
      const exists = await prisma.invoice.findFirst({ where: { clientId: client.id, number: num } });
      if (exists) continue;
      await prisma.invoice.create({
        data: {
          tenantId: tenant.id,
          clientId: client.id,
          number: num,
          date: new Date(String(inv.date || new Date().toISOString().slice(0, 10))),
          partyName: String(inv.partyName || 'Party'),
          partyGstin: inv.partyGstin ? String(inv.partyGstin) : undefined,
          placeOfSupply: String(inv.placeOfSupply || c.stateCode || '07'),
          taxable: Number(inv.taxable || 0),
          cgst: Number(inv.cgst || 0),
          sgst: Number(inv.sgst || 0),
          igst: Number(inv.igst || 0),
          grandTotal: Number(inv.grandTotal || 0),
          status: 'APPROVED'
        }
      });
    }

    for (const p of c.purchases || []) {
      const invNo = String(p.invoiceNo || p.number || '');
      if (!invNo) continue;
      const exists = await prisma.purchase.findFirst({
        where: { clientId: client.id, invoiceNo: invNo }
      });
      if (exists) continue;
      await prisma.purchase.create({
        data: {
          clientId: client.id,
          supplierGstin: String(p.supplierGstin || '00AAAA0000A0Z0'),
          invoiceNo: invNo,
          date: new Date(String(p.date || new Date().toISOString().slice(0, 10))),
          taxable: Number(p.taxable || 0),
          cgst: Number(p.cgst || 0),
          sgst: Number(p.sgst || 0),
          igst: Number(p.igst || 0),
          itcEligible: p.itcEligible !== false
        }
      });
    }

    migrated++;
    console.log(`Migrated client: ${c.name} (${legacyId})`);
  }

  console.log(`Done — ${migrated} clients migrated to tenant ${tenant.id}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());