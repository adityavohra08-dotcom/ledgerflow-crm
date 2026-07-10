import { Router } from 'express';
import type { AuthedRequest } from '../../types.js';
import * as svc from './clients.service.js';

export const clientsRouter = Router();

clientsRouter.get('/', async (req: AuthedRequest, res) => {
  try { res.json(await svc.listClients(req.ctx.tenantId)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

clientsRouter.get('/:id', async (req: AuthedRequest, res) => {
  try {
    const client = await svc.getClient(req.params.id);
    if (!client) return res.status(404).json({ error: 'Not found' });
    res.json(client);
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

clientsRouter.post('/', async (req: AuthedRequest, res) => {
  try { res.status(201).json(await svc.createClient(req.ctx.tenantId, req.body)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});