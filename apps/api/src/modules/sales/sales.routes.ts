import { Router } from 'express';
import type { AuthedRequest } from '../../types.js';
import * as svc from './sales.service.js';

export const salesRouter = Router();

salesRouter.get('/invoices', async (req: AuthedRequest, res) => {
  try { res.json(await svc.listInvoices(req.ctx)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

salesRouter.post('/invoices', async (req: AuthedRequest, res) => {
  try { res.status(201).json(await svc.createInvoice(req.ctx, req.body)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

salesRouter.get('/quotes', async (req: AuthedRequest, res) => {
  try { res.json(await svc.listQuotes(req.ctx)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

salesRouter.get('/sales-orders', async (req: AuthedRequest, res) => {
  try { res.json(await svc.listSalesOrders(req.ctx)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

salesRouter.post('/quotes/:id/convert', async (req: AuthedRequest, res) => {
  try { res.json(await svc.convertQuoteToInvoice(req.ctx, req.params.id)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});