import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate, AuthRequest } from '../middleware/auth';
import * as trilhasService from '../services/trilhas.service';

const router = Router();
router.use(authenticate);

const createTrilhaSchema = z.object({
  diagnosticoId: z.string().uuid().optional(),
  name: z.string().min(1, 'Nome da trilha é obrigatório'),
  description: z.string().optional(),
  type: z.enum(['IMPACTO', 'APROFUNDAMENTO', 'CUSTOM']),
  palestraIds: z.array(z.string()).min(1, 'A trilha deve ter pelo menos 1 palestra'),
});

const markWatchedSchema = z.object({
  watched: z.boolean(),
});

// POST /api/trilhas - Create new trilha
router.post('/', validate(createTrilhaSchema), async (req: AuthRequest, res: Response) => {
  try {
    const trilha = await trilhasService.createTrilha({
      userId: req.user!.id,
      ...req.body,
    });
    res.status(201).json(trilha);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao criar trilha';
    res.status(500).json({ error: message });
  }
});

// GET /api/trilhas - List user's trilhas
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const trilhas = await trilhasService.getUserTrilhas(req.user!.id);
    res.json(trilhas);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar trilhas' });
  }
});

// GET /api/trilhas/:id - Get trilha details
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const trilha = await trilhasService.getTrilhaById(req.params.id as string, req.user!.id);
    res.json(trilha);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar trilha';
    res.status(404).json({ error: message });
  }
});

// PATCH /api/trilhas/:trilhaId/palestras/:palestraId - Mark palestra as watched/unwatched
router.patch(
  '/:trilhaId/palestras/:palestraId',
  validate(markWatchedSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const progress = await trilhasService.markPalestraWatched(
        req.params.trilhaId as string,
        req.params.palestraId as string,
        req.user!.id,
        req.body.watched
      );
      res.json(progress);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar progresso';
      res.status(500).json({ error: message });
    }
  }
);

// DELETE /api/trilhas/:id - Delete trilha
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await trilhasService.deleteTrilha(req.params.id as string, req.user!.id);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao excluir trilha';
    res.status(500).json({ error: message });
  }
});

export default router;
