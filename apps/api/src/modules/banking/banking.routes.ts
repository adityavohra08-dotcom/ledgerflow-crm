import { Router } from 'express';
import type { AuthedRequest } from '../../types.js';
import * as svc from './banking.service.js';

export const bankingRouter = Router();

bankingRouter.get('/accounts', async (req: AuthedRequest, res) => {
  try { res.json(await svc.listBankAccounts(req.ctx)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

bankingRouter.post('/accounts', async (req: AuthedRequest, res) => {
  try { res.status(201).json(await svc.createBankAccount(req.ctx, req.body)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

bankingRouter.post('/accounts/:id/import', async (req: AuthedRequest, res) => {
  try {
    res.json(await svc.importTransactions(req.ctx, req.params.id, req.body.rows || []));
  } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

bankingRouter.get('/accounts/:id/unmatched', async (req: AuthedRequest, res) => {
  try { res.json(await svc.listUnmatched(req.ctx, req.params.id)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

bankingRouter.post('/transactions/:id/match', async (req: AuthedRequest, res) => {
  try { res.json(await svc.matchTransaction(req.ctx, req.params.id, req.body.paymentId)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

bankingRouter.post('/accounts/:id/reconcile', async (req: AuthedRequest, res) => {
  try { res.json(await svc.createReconciliation(req.ctx, req.params.id, req.body)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});