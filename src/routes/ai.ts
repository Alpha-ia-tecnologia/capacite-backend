import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generatePalestraQuestions, PALESTRANTES_VALIDOS, CATALOGO_OFICIAL } from '../services/deepseek.service';
import { agentSearch } from '../services/langgraph.service';
import { decide, Intent } from '../services/decision-engine';
import prisma from '../lib/prisma';

const router = Router();
router.use(authenticate);

const searchSchema = z.object({
  query: z.string().min(3, 'A busca deve ter pelo menos 3 caracteres'),
});

const questionsSchema = z.object({
  palestraTitle: z.string().min(1),
  speaker: z.string().min(1),
  categoryName: z.string().min(1),
  customContext: z.string().optional(),
});

const decideSchema = z.object({
  query: z.string().min(3, 'A solicitação deve ter pelo menos 3 caracteres'),
  intent: z.enum([
    'diagnostic_analysis',
    'search',
    'questions',
    'new_trilha',
    'evolution_insight',
  ]).optional(),
});

// ═══════════════════════════════════════════
// POST /api/ai/decide - Unified AI Decision Endpoint
// ═══════════════════════════════════════════
router.post('/decide', validate(decideSchema), async (req: AuthRequest, res: Response) => {
  try {
    const response = await decide({
      userId: req.user!.id,
      query: req.body.query,
      intent: req.body.intent as Intent | undefined,
    });

    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro no processamento da solicitação';
    res.status(500).json({ error: message });
  }
});

// ═══════════════════════════════════════════
// Legacy endpoints (backward compatibility)
// ═══════════════════════════════════════════

// POST /api/ai/search - Intelligent search
router.post('/search', validate(searchSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationType: true },
    });

    const result = await agentSearch(req.body.query, user?.organizationType || 'EMPRESA');

    // Try to parse as JSON, return raw if fails
    try {
      res.json(JSON.parse(result));
    } catch {
      res.json({ raw: result });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro na busca inteligente';
    res.status(500).json({ error: message });
  }
});

// POST /api/ai/questions - Generate palestra questions
router.post('/questions', validate(questionsSchema), async (req: AuthRequest, res: Response) => {
  try {
    // Validar que o palestrante está no catálogo oficial
    const speakerValid = PALESTRANTES_VALIDOS.some(
      p => p.toLowerCase() === req.body.speaker.toLowerCase()
    );
    if (!speakerValid) {
      res.status(400).json({ error: `Palestrante "${req.body.speaker}" não encontrado no catálogo oficial.` });
      return;
    }

    // Validar que a palestra existe no catálogo
    const palestraValid = CATALOGO_OFICIAL.some(
      p => p.title.toLowerCase() === req.body.palestraTitle.toLowerCase()
    );
    if (!palestraValid) {
      res.status(400).json({ error: `Palestra "${req.body.palestraTitle}" não encontrada no catálogo oficial.` });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationType: true },
    });

    const result = await generatePalestraQuestions(
      req.body.palestraTitle,
      req.body.speaker,
      req.body.categoryName,
      user?.organizationType || 'EMPRESA',
      req.body.customContext
    );

    try {
      res.json(JSON.parse(result));
    } catch {
      res.json({ raw: result });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao gerar perguntas';
    res.status(500).json({ error: message });
  }
});

export default router;
