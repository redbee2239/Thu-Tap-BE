import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { workspaceId } = req.query;
  const data = workspaceId ? db.projects.findByWorkspace(workspaceId as string) : db.projects.findAll();
  res.json({ success: true, data });
});

router.get('/:id', (req: Request, res: Response) => {
  const p = db.projects.findById(req.params.id);
  if (!p) { res.status(404).json({ success: false, message: 'Not found' }); return; }
  res.json({ success: true, data: p });
});

router.post('/', (req: Request, res: Response) => {
  const { name, description, workspaceId } = req.body;
  if (!name || !workspaceId) {
    res.status(400).json({ success: false, message: 'Name and workspaceId required' }); return;
  }
  const p = { id: String(db.projects.findAll().length + 1), name, description, workspaceId };
  res.status(201).json({ success: true, data: db.projects.create(p) });
});

router.put('/:id', (req: Request, res: Response) => {
  const p = db.projects.update(req.params.id, req.body);
  if (!p) { res.status(404).json({ success: false, message: 'Not found' }); return; }
  res.json({ success: true, data: p });
});

router.delete('/:id', (req: Request, res: Response) => {
  if (!db.projects.delete(req.params.id)) {
    res.status(404).json({ success: false, message: 'Not found' }); return;
  }
  res.status(204).send();
});

export default router;
