import { Router } from 'express';
import type { AuthedRequest } from '../../types.js';
import * as svc from './purchases.service.js';

export const purchasesRouter = Router();

purchasesRouter.get('/bills', async (req: AuthedRequest, res) => {
  try { res.json(await svc.listBills(req.ctx)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

purchasesRouter.post('/bills', async (req: AuthedRequest, res) => {
  try { res.status(201).json(await svc.createBill(req.ctx, req.body)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

purchasesRouter.get('/purchase-orders', async (req: AuthedRequest, res) => {
  try { res.json(await svc.listPurchaseOrders(req.ctx)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

purchasesRouter.get('/expenses', async (req: AuthedRequest, res) => {
  try { res.json(await svc.listExpenses(req.ctx)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});