import { Router, Request, Response } from 'express';
import { NoteService } from './note.service';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.json({ success: true, data: NoteService.getAll() });
});

router.get('/:id', (req: Request, res: Response) => {
  const note = NoteService.getById(req.params.id);
  res.json({ success: true, data: note });
});

router.post('/', (req: Request, res: Response) => {
  const note = NoteService.create(req.body.title, req.body.content);
  res.status(201).json({ success: true, data: note });
});

router.put('/:id', (req: Request, res: Response) => {
  const note = NoteService.update(req.params.id, req.body.title, req.body.content);
  res.json({ success: true, data: note });
});

router.delete('/:id', (req: Request, res: Response) => {
  NoteService.delete(req.params.id);
  res.status(204).send();
});

export default router;
