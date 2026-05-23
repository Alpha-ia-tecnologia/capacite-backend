import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { CATEGORIES, QUESTIONS } from '../lib/scoring';
import prisma from '../lib/prisma';
import {
  ingestTranscription,
  getProcessedPalestras,
  searchPalestrasByTopic,
} from '../services/palestra-ingestion.service';

const router = Router();

// Public route - Get categories and questions
// GET /api/palestras/categories
router.get('/categories', (_req, res: Response) => {
  res.json(CATEGORIES);
});

// GET /api/palestras/questions
router.get('/questions', (_req, res: Response) => {
  res.json(QUESTIONS);
});

// GET /api/palestras/catalog
// Returns the palestra catalog from the production database.
router.get('/catalog', async (_req, res: Response) => {
  try {
    const palestras = await prisma.palestra.findMany({
      orderBy: [{ year: 'desc' }, { title: 'asc' }],
      select: {
        id: true,
        externalId: true,
        title: true,
        speaker: true,
        description: true,
        duration: true,
        categoryIds: true,
        year: true,
        glsnowUrl: true,
        speakerProfile: {
          select: {
            photoUrl: true,
          },
        },
      },
    });

    res.json(palestras.map(p => ({
      id: p.externalId || p.id,
      title: p.title,
      speaker: p.speaker,
      speakerAvatar: p.speakerProfile?.photoUrl || '',
      duration: p.duration,
      description: p.description,
      categoryIds: p.categoryIds,
      year: p.year,
      glsnowUrl: p.glsnowUrl || '',
    })));
  } catch (err) {
    console.error('Error listing palestra catalog from database:', err);
    res.status(500).json({ error: 'Erro ao listar catálogo de palestras do banco de dados' });
  }
});

// ═══════════════════════════════════════════
// Database-backed endpoints (transcription system)
// ═══════════════════════════════════════════

// GET /api/palestras/db — List all palestras from database
router.get('/db', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const palestras = await prisma.palestra.findMany({
      orderBy: { externalId: 'asc' },
      select: {
        id: true,
        externalId: true,
        title: true,
        speaker: true,
        description: true,
        categoryIds: true,
        isProcessed: true,
        summary: true,
        keyTopics: true,
        createdAt: true,
      },
    });
    res.json(palestras);
  } catch (err) {
    console.error('Error listing palestras:', err);
    res.status(500).json({ error: 'Erro ao listar palestras' });
  }
});

// GET /api/palestras/db/processed — Get only processed palestras with summaries
router.get('/db/processed', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const palestras = await getProcessedPalestras();
    res.json(palestras);
  } catch (err) {
    console.error('Error getting processed palestras:', err);
    res.status(500).json({ error: 'Erro ao buscar palestras processadas' });
  }
});

// GET /api/palestras/search/topics?q=confiança — Search by topic keyword
router.get('/search/topics', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      res.status(400).json({ error: 'Parâmetro q é obrigatório' });
      return;
    }
    const results = await searchPalestrasByTopic(query);
    res.json(results);
  } catch (err) {
    console.error('Error searching palestras:', err);
    res.status(500).json({ error: 'Erro na busca' });
  }
});

// POST /api/palestras/:id/transcription — Upload transcription text for a palestra
router.post('/:id/transcription', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!user.isAdmin) {
      res.status(403).json({ error: 'Apenas administradores podem enviar transcrições' });
      return;
    }

    const { transcription } = req.body;
    if (!transcription || typeof transcription !== 'string') {
      res.status(400).json({ error: 'Campo transcription (string) é obrigatório' });
      return;
    }

    if (transcription.length < 100) {
      res.status(400).json({ error: 'Transcrição muito curta (mínimo 100 caracteres)' });
      return;
    }

    const result = await ingestTranscription(req.params.id as string, transcription);
    res.json({
      message: 'Transcrição processada com sucesso',
      ...result,
    });
  } catch (err: any) {
    console.error('Error ingesting transcription:', err);
    res.status(500).json({ error: err.message || 'Erro ao processar transcrição' });
  }
});

// GET /api/palestras/:id/status — Get processing status of a palestra
router.get('/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const palestra = await prisma.palestra.findUnique({
      where: { id: req.params.id as string },
      select: {
        id: true,
        externalId: true,
        title: true,
        isProcessed: true,
        summary: true,
        keyTopics: true,
        keyQuotes: true,
        _count: { select: { chunks: true } },
      },
    });

    if (!palestra) {
      res.status(404).json({ error: 'Palestra não encontrada' });
      return;
    }

    res.json(palestra);
  } catch (err) {
    console.error('Error getting palestra status:', err);
    res.status(500).json({ error: 'Erro ao buscar status' });
  }
});

// ═══════════════════════════════════════════
// Static catalog (kept for backward compatibility)
// ═══════════════════════════════════════════

// GET /api/palestras/:id (database lookup)
router.get('/:id', async (req, res: Response) => {
  try {
    const id = req.params.id as string;
    const palestra = await prisma.palestra.findFirst({
      where: { OR: [{ id }, { externalId: id }] },
      include: { speakerProfile: true },
    });

    if (!palestra) {
      res.status(404).json({ error: 'Palestra nao encontrada no banco de dados' });
      return;
    }

    res.json({
      id: palestra.externalId || palestra.id,
      dbId: palestra.id,
      title: palestra.title,
      speaker: palestra.speaker,
      description: palestra.description,
      duration: palestra.duration,
      categoryIds: palestra.categoryIds,
      year: palestra.year,
      glsnowUrl: palestra.glsnowUrl || '',
      summary: palestra.summary,
      keyTopics: palestra.keyTopics,
      keyQuotes: palestra.keyQuotes,
      isProcessed: palestra.isProcessed,
      speakerProfile: palestra.speakerProfile,
    });
  } catch (err) {
    console.error('Error getting palestra from database:', err);
    res.status(500).json({ error: 'Erro ao buscar palestra do banco de dados' });
  }
});

export default router;
