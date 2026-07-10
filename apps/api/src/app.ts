import express from 'express';
import cors from 'cors';
import { authOptional } from './middleware/auth.js';
import { resolveContext, requireClient } from './middleware/context.js';
import { accountingRouter } from './modules/accounting/accounting.routes.js';
import { salesRouter } from './modules/sales/sales.routes.js';
import { purchasesRouter } from './modules/purchases/purchases.routes.js';
import { bankingRouter } from './modules/banking/banking.routes.js';
import { inventoryRouter } from './modules/inventory/inventory.routes.js';
import { gstRouter } from './modules/gst/gst.routes.js';
import { projectsRouter } from './modules/projects/projects.routes.js';
import { clientsRouter } from './modules/clients/clients.routes.js';
import { automationRouter } from './modules/automation/automation.routes.js';
import { dbReady } from './lib/prisma.js';
import type { AuthedRequest } from './types.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
  app.use(express.json({ limit: '20mb' }));

  app.get('/health', async (_req, res) => {
    res.json({
      ok: true,
      service: 'ledgerflow-api',
      version: '2.0.0',
      postgres: await dbReady(),
      modules: ['accounting', 'sales', 'purchases', 'banking', 'inventory', 'gst', 'projects', 'automation']
    });
  });

  app.use(authOptional);
  app.use(resolveContext);

  app.use('/v1/clients', clientsRouter);

  const scoped = express.Router();
  scoped.use(requireClient);
  scoped.use('/accounting', accountingRouter);
  scoped.use('/sales', salesRouter);
  scoped.use('/purchases', purchasesRouter);
  scoped.use('/banking', bankingRouter);
  scoped.use('/inventory', inventoryRouter);
  scoped.use('/gst', gstRouter);
  scoped.use('/projects', projectsRouter);
  scoped.use('/automation', automationRouter);

  app.use('/v1', scoped);

  app.get('/v1/portal/invoices', async (req: AuthedRequest, res) => {
    try {
      const { prisma } = await import('./lib/prisma.js');
      if (!req.ctx.clientId) return res.status(400).json({ error: 'clientId required' });
      const invoices = await prisma.invoice.findMany({
        where: { clientId: req.ctx.clientId, status: { in: ['SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'] } },
        orderBy: { date: 'desc' },
        take: 50
      });
      res.json(invoices);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return app;
}