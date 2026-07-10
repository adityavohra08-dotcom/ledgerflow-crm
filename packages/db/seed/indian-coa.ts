/**
 * Seed tenant + demo client with Indian CoA
 * Usage: DATABASE_URL=... npx tsx packages/db/seed/indian-coa.ts
 */
import { PrismaClient } from '@prisma/client';
import { INDIAN_COA_TEMPLATE, sortCoaForInsert } from '../../accounting-engine/src/chart-of-accounts.js';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'udyog-suvidha' },
    create: { slug: 'udyog-suvidha', name: 'Udyog Suvidha & Co.' },
    update: {}
  });

  let client = await prisma.client.findFirst({
    where: { tenantId: tenant.id, legalName: 'Sharma Traders' }
  });

  if (!client) {
    client = await prisma.client.create({
      data: {
        tenantId: tenant.id,
        legalName: 'Sharma Traders',
        tradeName: 'Sharma Traders',
        stateCode: '07',
        settings: { create: {} },
        fiscalYears: {
          create: {
            label: '2025-26',
            startDate: new Date('2025-04-01'),
            endDate: new Date('2026-03-31'),
            isCurrent: true
          }
        },
        gstins: {
          create: {
            gstin: '07AABCT1234D1Z5',
            stateCode: '07',
            isPrimary: true
          }
        }
      }
    });
  }

  const count = await prisma.account.count({ where: { clientId: client.id } });
  if (count === 0) {
    const sorted = sortCoaForInsert(INDIAN_COA_TEMPLATE);
    const codeToId = new Map<string, string>();
    for (const seed of sorted) {
      const acc = await prisma.account.create({
        data: {
          tenantId: tenant.id,
          clientId: client.id,
          code: seed.code,
          name: seed.name,
          type: seed.type,
          subType: seed.subType,
          parentId: seed.parentCode ? codeToId.get(seed.parentCode) : undefined,
          isGroup: seed.isGroup ?? false,
          isSystem: seed.isSystem ?? false
        }
      });
      codeToId.set(seed.code, acc.id);
    }
    console.log(`Seeded ${sorted.length} CoA accounts for ${client.legalName}`);
  }

  console.log({ tenantId: tenant.id, clientId: client.id });
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());