import express from 'express';
import cors from 'cors';
import { env } from './config/env';

// Route imports
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import diagnosticoRoutes from './routes/diagnostico';
import trilhasRoutes from './routes/trilhas';
import gamificacaoRoutes from './routes/gamificacao';
import aiRoutes from './routes/ai';
import palestrasRoutes from './routes/palestras';
import filesRoutes from './routes/files';

const app = express();

// Middleware
app.use(cors({
  origin: [
    env.FRONTEND_URL,
    'https://capacite.globalleadership.com.br',
    'https://strap-capacite-frontend.gkgtsp.easypanel.host',
    'http://localhost:5173',
    'http://localhost:5174',
  ],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/diagnostico', diagnosticoRoutes);
app.use('/api/trilhas', trilhasRoutes);
app.use('/api/gamificacao', gamificacaoRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/palestras', palestrasRoutes);
app.use('/api/files', filesRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor',
  });
});

// Start server
app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`CAPACITE API running on port ${env.PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`Frontend URL: ${env.FRONTEND_URL}`);
});

export default app;
