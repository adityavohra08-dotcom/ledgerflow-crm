export { prisma, scopeWhere } from '@ledgerflow/db/src/client.js';

export async function dbReady(): Promise<boolean> {
  try {
    const { prisma } = await import('@ledgerflow/db/src/client.js');
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}