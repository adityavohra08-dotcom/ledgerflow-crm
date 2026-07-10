import { Router } from 'express';
import type { AuthedRequest } from '../../types.js';
import * as svc from './inventory.service.js';

export const inventoryRouter = Router();

inventoryRouter.get('/items', async (req: AuthedRequest, res) => {
  try { res.json(await svc.listItems(req.ctx)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

inventoryRouter.post('/items', async (req: AuthedRequest, res) => {
  try { res.status(201).json(await svc.createItem(req.ctx, req.body)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

inventoryRouter.get('/warehouses', async (req: AuthedRequest, res) => {
  try { res.json(await svc.listWarehouses(req.ctx)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

inventoryRouter.post('/warehouses', async (req: AuthedRequest, res) => {
  try { res.status(201).json(await svc.createWarehouse(req.ctx, req.body)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

inventoryRouter.post('/items/:itemId/stock', async (req: AuthedRequest, res) => {
  try {
    const { warehouseId, qty, type } = req.body;
    res.json(await svc.adjustStock(req.ctx, req.params.itemId, warehouseId, Number(qty), type));
  } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});