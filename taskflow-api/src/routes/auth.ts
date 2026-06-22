import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// POST /auth/register
router.post('/register', (req: Request, res: Response) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    res.status(400).json({ success: false, message: 'Missing fields' });
    return;
  }
  if (db.users.findByEmail(email)) {
    res.status(409).json({ success: false, message: 'Email exists' });
    return;
  }
  const user = { id: String(db.users.findAll().length + 1), email, name, password };
  db.users.create(user);
  const { password: _, ...safe } = user;
  res.status(201).json({ success: true, data: safe });
});

// POST /auth/login
router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = db.users.findByEmail(email);
  if (!user || user.password !== password) {
    res.status(401).json({ success: false, message: 'Wrong email/password' });
    return;
  }
  const { password: _, ...safe } = user;
  res.json({ success: true, data: safe });
});

export default router;
