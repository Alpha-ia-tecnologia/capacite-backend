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
// Returns the full palestra catalog (static data mirrored from frontend)
router.get('/catalog', (_req, res: Response) => {
  res.json(PALESTRAS_CATALOG);
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

// GET /api/palestras/:id (static catalog lookup)
router.get('/:id', (_req, res: Response) => {
  const palestra = PALESTRAS_CATALOG.find((p) => p.id === (_req.params.id as string));
  if (!palestra) {
    res.status(404).json({ error: 'Palestra não encontrada' });
    return;
  }
  res.json(palestra);
});

// Static catalog data (mirrored from frontend for API consistency)
const PALESTRAS_CATALOG = [
  // Category 1: Liderança Pessoal
  {
    id: 'lp1',
    title: 'O Líder que se Conhece',
    speaker: 'Craig Groeschel',
    speakerAvatar: '/speakers/craig-groeschel.jpg',
    duration: '35 min',
    description: 'Autoconsciência como base da liderança eficaz.',
    categoryIds: [1],
    year: 2023,
    glsnowUrl: 'https://glsnow.tv',
  },
  {
    id: 'lp2',
    title: 'Coragem para Liderar',
    speaker: 'Brené Brown',
    speakerAvatar: '/speakers/brene-brown.jpg',
    duration: '40 min',
    description: 'Vulnerabilidade como força na liderança.',
    categoryIds: [1],
    year: 2022,
    glsnowUrl: 'https://glsnow.tv',
  },
  {
    id: 'lp3',
    title: 'Disciplina do Líder',
    speaker: 'Jocko Willink',
    speakerAvatar: '/speakers/jocko-willink.jpg',
    duration: '30 min',
    description: 'Disciplina como caminho para a liberdade na liderança.',
    categoryIds: [1],
    year: 2023,
    glsnowUrl: 'https://glsnow.tv',
  },
  // Category 2: Pessoas, Cultura e Confiança
  {
    id: 'pcc1',
    title: 'Confiança é Construída',
    speaker: 'Brené Brown',
    speakerAvatar: '/speakers/brene-brown.jpg',
    duration: '38 min',
    description: 'Como construir e manter confiança nas equipes.',
    categoryIds: [2],
    year: 2022,
    glsnowUrl: 'https://glsnow.tv',
  },
  {
    id: 'pcc2',
    title: 'Cultura Vence Estratégia',
    speaker: 'Sam Chand',
    speakerAvatar: '/speakers/sam-chand.jpg',
    duration: '35 min',
    description: 'O papel da cultura organizacional no sucesso.',
    categoryIds: [2],
    year: 2023,
    glsnowUrl: 'https://glsnow.tv',
  },
  {
    id: 'pcc3',
    title: 'O Poder da Vulnerabilidade',
    speaker: 'Patrick Lencioni',
    speakerAvatar: '/speakers/patrick-lencioni.jpg',
    duration: '42 min',
    description: 'Vulnerabilidade como base para equipes saudáveis.',
    categoryIds: [2],
    year: 2022,
    glsnowUrl: 'https://glsnow.tv',
  },
  // Category 3: Comunicação e Influência
  {
    id: 'ci1',
    title: 'A Arte de Comunicar',
    speaker: 'Andy Stanley',
    speakerAvatar: '/speakers/andy-stanley.jpg',
    duration: '36 min',
    description: 'Comunicação clara e influente para líderes.',
    categoryIds: [3],
    year: 2023,
    glsnowUrl: 'https://glsnow.tv',
  },
  {
    id: 'ci2',
    title: 'Influência Autêntica',
    speaker: 'John Maxwell',
    speakerAvatar: '/speakers/john-maxwell.jpg',
    duration: '40 min',
    description: 'Como liderar por influência, não por posição.',
    categoryIds: [3],
    year: 2022,
    glsnowUrl: 'https://glsnow.tv',
  },
  {
    id: 'ci3',
    title: 'Conversas Corajosas',
    speaker: 'Susan Scott',
    speakerAvatar: '/speakers/susan-scott.jpg',
    duration: '33 min',
    description: 'A arte de ter conversas difíceis com respeito.',
    categoryIds: [3],
    year: 2023,
    glsnowUrl: 'https://glsnow.tv',
  },
  // Category 4: Estratégia, Decisões e Execução
  {
    id: 'ede1',
    title: 'Foco Estratégico',
    speaker: 'Jim Collins',
    speakerAvatar: '/speakers/jim-collins.jpg',
    duration: '45 min',
    description: 'Como manter foco no que realmente importa.',
    categoryIds: [4],
    year: 2023,
    glsnowUrl: 'https://glsnow.tv',
  },
  {
    id: 'ede2',
    title: 'Execução com Excelência',
    speaker: 'Chris McChesney',
    speakerAvatar: '/speakers/chris-mcchesney.jpg',
    duration: '38 min',
    description: 'Transformar estratégia em resultados concretos.',
    categoryIds: [4],
    year: 2022,
    glsnowUrl: 'https://glsnow.tv',
  },
  {
    id: 'ede3',
    title: 'Decisões que Transformam',
    speaker: 'Liz Wiseman',
    speakerAvatar: '/speakers/liz-wiseman.jpg',
    duration: '35 min',
    description: 'Como tomar decisões que multiplicam impacto.',
    categoryIds: [4],
    year: 2023,
    glsnowUrl: 'https://glsnow.tv',
  },
  // Category 5: Mudança, Inovação e Reinvenção
  {
    id: 'mir1',
    title: 'Liderando Mudanças',
    speaker: 'John Kotter',
    speakerAvatar: '/speakers/john-kotter.jpg',
    duration: '40 min',
    description: 'Conduzir mudanças organizacionais com sucesso.',
    categoryIds: [5],
    year: 2022,
    glsnowUrl: 'https://glsnow.tv',
  },
  {
    id: 'mir2',
    title: 'Mentalidade de Crescimento',
    speaker: 'Carol Dweck',
    speakerAvatar: '/speakers/carol-dweck.jpg',
    duration: '35 min',
    description: 'O poder da mentalidade de crescimento nas organizações.',
    categoryIds: [5],
    year: 2023,
    glsnowUrl: 'https://glsnow.tv',
  },
  {
    id: 'mir3',
    title: 'Inovação com Propósito',
    speaker: 'Beth Comstock',
    speakerAvatar: '/speakers/beth-comstock.jpg',
    duration: '37 min',
    description: 'Inovar com critério e propósito organizacional.',
    categoryIds: [5],
    year: 2022,
    glsnowUrl: 'https://glsnow.tv',
  },
  // Category 6: Resiliência, Saúde Emocional e Bem-estar
  {
    id: 'rse1',
    title: 'Liderança Sustentável',
    speaker: 'Henry Cloud',
    speakerAvatar: '/speakers/henry-cloud.jpg',
    duration: '38 min',
    description: 'Liderar com ritmo sustentável e saúde emocional.',
    categoryIds: [6],
    year: 2023,
    glsnowUrl: 'https://glsnow.tv',
  },
  {
    id: 'rse2',
    title: 'Saúde do Líder',
    speaker: 'Bill Hybels',
    speakerAvatar: '/speakers/bill-hybels.jpg',
    duration: '35 min',
    description: 'A importância da saúde integral do líder.',
    categoryIds: [6],
    year: 2022,
    glsnowUrl: 'https://glsnow.tv',
  },
  {
    id: 'rse3',
    title: 'Resiliência em Tempos Difíceis',
    speaker: 'Sheryl Sandberg',
    speakerAvatar: '/speakers/sheryl-sandberg.jpg',
    duration: '40 min',
    description: 'Construir resiliência pessoal e organizacional.',
    categoryIds: [6],
    year: 2023,
    glsnowUrl: 'https://glsnow.tv',
  },
  // Category 7: Propósito, Visão, Legado e Impacto
  {
    id: 'pvl1',
    title: 'Liderança com Propósito',
    speaker: 'Simon Sinek',
    speakerAvatar: '/speakers/simon-sinek.jpg',
    duration: '42 min',
    description: 'Começar pelo porquê na liderança.',
    categoryIds: [7],
    year: 2023,
    glsnowUrl: 'https://glsnow.tv',
  },
  {
    id: 'pvl2',
    title: 'Visão que Inspira',
    speaker: 'Andy Stanley',
    speakerAvatar: '/speakers/andy-stanley.jpg',
    duration: '36 min',
    description: 'Como criar e comunicar uma visão inspiradora.',
    categoryIds: [7],
    year: 2022,
    glsnowUrl: 'https://glsnow.tv',
  },
  {
    id: 'pvl3',
    title: 'Legado que Transforma',
    speaker: 'Bob Goff',
    speakerAvatar: '/speakers/bob-goff.jpg',
    duration: '34 min',
    description: 'Construir um legado de impacto duradouro.',
    categoryIds: [7],
    year: 2023,
    glsnowUrl: 'https://glsnow.tv',
  },
];

export default router;
