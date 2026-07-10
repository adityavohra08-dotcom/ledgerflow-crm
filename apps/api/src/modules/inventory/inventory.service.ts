import { prisma } from '../../lib/prisma.js';
import type { RequestContext } from '../../types.js';
import { createItemSchema } from '@ledgerflow/shared/src/schemas.js';

export async function listItems(ctx: RequestContext) {
  return prisma.item.findMany({
    where: { clientId: ctx.clientId },
    include: { stockLevels: { include: { warehouse: true } } },
    orderBy: { name: 'asc' }
  });
}

export async function createItem(ctx: RequestContext, body: unknown) {
  const data = createItemSchema.parse(body);
  return prisma.item.create({
    data: {
      tenantId: ctx.tenantId,
      clientId: ctx.clientId,
      sku: data.sku,
      name: data.name,
      hsnSac: data.hsnSac,
      type: data.type,
      salesRate: data.salesRate,
      purchaseRate: data.purchaseRate,
      gstRate: data.gstRate
    }
  });
}

export async function listWarehouses(ctx: RequestContext) {
  return prisma.warehouse.findMany({
    where: { clientId: ctx.clientId },
    include: { stockLevels: { include: { item: true } } }
  });
}

export async function createWarehouse(ctx: RequestContext, body: Record<string, unknown>) {
  return prisma.warehouse.create({
    data: {
      tenantId: ctx.tenantId,
      clientId: ctx.clientId,
      name: String(body.name),
      isDefault: Boolean(body.isDefault)
    }
  });
}

export async function adjustStock(
  ctx: RequestContext,
  itemId: string,
  warehouseId: string,
  qty: number,
  type: 'ADJUSTMENT' | 'OPENING' = 'ADJUSTMENT'
) {
  const level = await prisma.stockLevel.upsert({
    where: { itemId_warehouseId: { itemId, warehouseId } },
    create: { itemId, warehouseId, qtyOnHand: qty },
    update: { qtyOnHand: { increment: qty } }
  });

  await prisma.stockMovement.create({
    data: {
      tenantId: ctx.tenantId,
      clientId: ctx.clientId,
      itemId,
      warehouseId,
      type,
      qty,
      date: new Date()
    }
  });

  return level;
}