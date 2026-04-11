import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import * as gamificacaoService from '../services/gamificacao.service';

const router = Router();
router.use(authenticate);

// GET /api/gamificacao - Get gamification summary
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const summary = await gamificacaoService.getGamificacaoSummary(req.user!.id);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar dados de gamificação' });
  }
});

// GET /api/gamificacao/stars - Get gold stars
router.get('/stars', async (req: AuthRequest, res: Response) => {
  try {
    const stars = await gamificacaoService.getUserGoldStars(req.user!.id);
    res.json(stars);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar estrelas' });
  }
});

// POST /api/gamificacao/check - Check and award pending stars
router.post('/check', async (req: AuthRequest, res: Response) => {
  try {
    const awarded = await gamificacaoService.checkAndAwardStars(req.user!.id);
    res.json({ awarded });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao verificar conquistas' });
  }
});

// POST /api/gamificacao/streak - Update daily streak
router.post('/streak', async (req: AuthRequest, res: Response) => {
  try {
    const streakDays = await gamificacaoService.updateStreak(req.user!.id);
    res.json({ streakDays });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar streak' });
  }
});

export default router;
