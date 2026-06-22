import express, { Request, Response, NextFunction } from 'express';
import authRoutes from './routes/auth';
import workspaceRoutes from './routes/workspace';
import projectRoutes from './routes/project';
import taskRoutes from './routes/task';

const app = express();
const PORT = 3001;

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
  res.json({ status: 'ok', service: 'TaskFlow API' });
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/workspaces', workspaceRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/tasks', taskRoutes);

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const status = err.status || 500;
  res.status(status).json({ success: false, message: err.message || 'Server error' });
});

app.listen(PORT, () => console.log(`TaskFlow API: http://localhost:${PORT}`));
