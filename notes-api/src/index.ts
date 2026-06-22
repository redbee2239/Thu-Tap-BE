import express, { Request, Response, NextFunction } from 'express';
import noteRoutes from './note.routes';

const app = express();
const PORT = 3000;

app.use(express.json());

// Middleware log
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[${req.method}] ${req.originalUrl} - ${res.statusCode} - ${ms}ms`);
  });
  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/v1/notes', noteRoutes);

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const status = err.status || 500;
  res.status(status).json({ success: false, message: err.message || 'Server error' });
});

app.listen(PORT, () => console.log(`Notes API: http://localhost:${PORT}`));
