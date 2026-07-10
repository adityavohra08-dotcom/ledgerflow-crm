import { Router } from 'express';
import type { AuthedRequest } from '../../types.js';
import * as svc from './gst.service.js';

export const gstRouter = Router();

gstRouter.get('/filings', async (req: AuthedRequest, res) => {
  try { res.json(await svc.listFilings(req.ctx)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

gstRouter.post('/gstr2b/import', async (req: AuthedRequest, res) => {
  try {
    res.json(await svc.importGstr2b(req.ctx, req.body.period, req.body.data));
  } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

gstRouter.post('/gstr2b/recon', async (req: AuthedRequest, res) => {
  try {
    res.json(await svc.runRecon(req.ctx, req.body.period));
  } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

gstRouter.post('/gstr1/validate', async (req: AuthedRequest, res) => {
  try {
    res.json(svc.validateGstr1(req.body));
  } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});