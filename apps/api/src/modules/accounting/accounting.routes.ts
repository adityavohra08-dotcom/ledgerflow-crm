import { Router } from 'express';
import type { AuthedRequest } from '../../types.js';
import * as svc from './accounting.service.js';

export const accountingRouter = Router();

accountingRouter.post('/coa/seed', async (req: AuthedRequest, res) => {
  try {
    res.json(await svc.seedChartOfAccounts(req.ctx));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

accountingRouter.get('/coa', async (req: AuthedRequest, res) => {
  try {
    res.json(await svc.listAccounts(req.ctx));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

accountingRouter.get('/journals', async (req: AuthedRequest, res) => {
  try {
    res.json(await svc.listJournals(req.ctx));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

accountingRouter.post('/journals', async (req: AuthedRequest, res) => {
  try {
    res.status(201).json(await svc.createJournal(req.ctx, req.body));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

accountingRouter.post('/invoices/:id/post', async (req: AuthedRequest, res) => {
  try {
    const state = (req.body.sellerStateCode as string) || '07';
    res.json(await svc.postInvoice(req.ctx, req.params.id, state));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

accountingRouter.post('/bills/:id/post', async (req: AuthedRequest, res) => {
  try {
    const state = (req.body.sellerStateCode as string) || '07';
    res.json(await svc.postBill(req.ctx, req.params.id, state));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

accountingRouter.get('/reports/trial-balance', async (req: AuthedRequest, res) => {
  try {
    res.json(await svc.getTrialBalance(req.ctx));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

accountingRouter.get('/reports/pnl', async (req: AuthedRequest, res) => {
  try {
    res.json(await svc.getProfitAndLoss(req.ctx));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});