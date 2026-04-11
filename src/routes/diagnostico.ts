import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate, AuthRequest } from '../middleware/auth';
import * as diagnosticoService from '../services/diagnostico.service';
import prisma from '../lib/prisma';

const router = Router();
router.use(authenticate);

const createDiagnosticoSchema = z.object({
  answers: z.record(z.string(), z.number().min(1).max(4)).refine(
    (answers) => Object.keys(answers).length === 21,
    { message: 'O diagnóstico deve conter exatamente 21 respostas' }
  ),
});

// POST /api/diagnostico - Create new diagnostico
router.post('/', validate(createDiagnosticoSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organization: true, organizationType: true },
    });

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }

    const result = await diagnosticoService.createDiagnostico({
      userId: req.user!.id,
      answers: req.body.answers,
      organizationType: user.organizationType,
      organizationName: user.organization,
    });

    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao criar diagnóstico';
    res.status(500).json({ error: message });
  }
});

// GET /api/diagnostico - List user's diagnosticos
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const diagnosticos = await diagnosticoService.getUserDiagnosticos(req.user!.id);
    res.json(diagnosticos);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar diagnósticos' });
  }
});

// GET /api/diagnostico/latest - Get latest diagnostico
router.get('/latest', async (req: AuthRequest, res: Response) => {
  try {
    const diagnostico = await diagnosticoService.getLatestDiagnostico(req.user!.id);
    if (!diagnostico) {
      res.status(404).json({ error: 'Nenhum diagnóstico encontrado' });
      return;
    }
    res.json(diagnostico);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar diagnóstico' });
  }
});

// GET /api/diagnostico/compare - Compare diagnosticos over time
router.get('/compare', async (req: AuthRequest, res: Response) => {
  try {
    const comparison = await diagnosticoService.compareDiagnosticos(req.user!.id);
    res.json(comparison);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao comparar diagnósticos' });
  }
});

// GET /api/diagnostico/:id - Get specific diagnostico
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const diagnostico = await diagnosticoService.getDiagnosticoById(req.params.id as string, req.user!.id);
    res.json(diagnostico);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar diagnóstico';
    res.status(404).json({ error: message });
  }
});

export default router;
