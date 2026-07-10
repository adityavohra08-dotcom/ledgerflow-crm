import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import type { AuthedRequest } from '../../types.js';

export const automationRouter = Router();

automationRouter.get('/rules', async (req: AuthedRequest, res) => {
  try {
    const rules = await prisma.automationRule.findMany({ where: { tenantId: req.ctx.tenantId } });
    res.json(rules);
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

automationRouter.get('/approvals', async (req: AuthedRequest, res) => {
  try {
    const pending = await prisma.approvalRequest.findMany({
      where: { clientId: req.ctx.clientId, status: 'PENDING' }
    });
    res.json(pending);
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

automationRouter.post('/approvals/:id/approve', async (req: AuthedRequest, res) => {
  try {
    const updated = await prisma.approvalRequest.update({
      where: { id: req.params.id },
      data: { status: 'APPROVED', actedBy: req.ctx.userId, actedAt: new Date() }
    });
    res.json(updated);
  } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});