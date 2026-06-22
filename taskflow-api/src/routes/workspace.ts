import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.json({ success: true, data: db.workspaces.findAll() });
});

router.get('/:id', (req: Request, res: Response) => {
  const ws = db.workspaces.findById(req.params.id);
  if (!ws) { res.status(404).json({ success: false, message: 'Not found' }); return; }
  res.json({ success: true, data: ws });
});

router.post('/', (req: Request, res: Response) => {
  const { name, description, ownerId } = req.body;
  if (!name) { res.status(400).json({ success: false, message: 'Name required' }); return; }
  const ws = { id: String(db.workspaces.findAll().length + 1), name, description, ownerId };
  res.status(201).json({ success: true, data: db.workspaces.create(ws) });
});

router.put('/:id', (req: Request, res: Response) => {
  const ws = db.workspaces.update(req.params.id, req.body);
  if (!ws) { res.status(404).json({ success: false, message: 'Not found' }); return; }
  res.json({ success: true, data: ws });
});

router.delete('/:id', (req: Request, res: Response) => {
  if (!db.workspaces.delete(req.params.id)) {
    res.status(404).json({ success: false, message: 'Not found' }); return;
  }
  res.status(204).send();
});

export default router;
