import { Router } from 'express';
import type { AuthedRequest } from '../../types.js';
import * as svc from './projects.service.js';

export const projectsRouter = Router();

projectsRouter.get('/', async (req: AuthedRequest, res) => {
  try { res.json(await svc.listProjects(req.ctx)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

projectsRouter.post('/', async (req: AuthedRequest, res) => {
  try { res.status(201).json(await svc.createProject(req.ctx, req.body)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

projectsRouter.post('/:id/time', async (req: AuthedRequest, res) => {
  try { res.status(201).json(await svc.logTime(req.ctx, req.params.id, req.body)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});