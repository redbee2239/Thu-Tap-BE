import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { projectId } = req.query;
  const data = projectId ? db.tasks.findByProject(projectId as string) : db.tasks.findAll();
  res.json({ success: true, data });
});

router.get('/:id', (req: Request, res: Response) => {
  const t = db.tasks.findById(req.params.id);
  if (!t) { res.status(404).json({ success: false, message: 'Not found' }); return; }
  res.json({ success: true, data: t });
});

router.post('/', (req: Request, res: Response) => {
  const { title, description, projectId, status, priority } = req.body;
  if (!title || !projectId) {
    res.status(400).json({ success: false, message: 'Title and projectId required' }); return;
  }
  const t = {
    id: String(db.tasks.findAll().length + 1),
    title, description, projectId,
    status: status || 'todo',
    priority: priority || 'medium',
  };
  res.status(201).json({ success: true, data: db.tasks.create(t) });
});

router.put('/:id', (req: Request, res: Response) => {
  const t = db.tasks.update(req.params.id, req.body);
  if (!t) { res.status(404).json({ success: false, message: 'Not found' }); return; }
  res.json({ success: true, data: t });
});

router.delete('/:id', (req: Request, res: Response) => {
  if (!db.tasks.delete(req.params.id)) {
    res.status(404).json({ success: false, message: 'Not found' }); return;
  }
  res.status(204).send();
});

export default router;
