import { CATEGORIES } from '../../lib/scoring';
import { chatCompletion, getOrgContext, ChatMessage } from '../deepseek.service';
import prisma from '../../lib/prisma';
import type { DecisionState, PipelineResult } from '../decision-engine';

/**
 * Evolution Pipeline
 * 
 * Generates AI-powered insights comparing diagnostics over time.
 * Goes beyond raw numbers to provide meaningful narrative about
 * the organization's leadership development journey.
 */

export async function executeEvolutionPipeline(state: DecisionState): Promise<PipelineResult> {
  const orgContext = getOrgContext(state.organizationType);

  // Load all diagnostics for comparison
  const diagnosticos = await prisma.diagnostico.findMany({
    where: { userId: state.userId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      categoryScores: true,
      categoryGaps: true,
      priority1Category: true,
      priority2Category: true,
      createdAt: true,
    },
  });

  if (diagnosticos.length < 2) {
    return {
      intent: 'evolution_insight',
      data: {
        message: 'É necessário ter pelo menos 2 diagnósticos para gerar insights de evolução.',
        totalDiagnosticos: diagnosticos.length,
      },
      confidence: 1,
      reasoning: 'Cliente tem menos de 2 diagnósticos. Nenhuma comparação possível.',
    };
  }

  const oldest = diagnosticos[0];
  const newest = diagnosticos[diagnosticos.length - 1];
  const oldScores = oldest.categoryScores as Record<string, number>;
  const newScores = newest.categoryScores as Record<string, number>;

  // Build evolution data
  const evolutionDetails = CATEGORIES.map((cat) => {
    const before = oldScores[String(cat.id)] || 0;
    const after = newScores[String(cat.id)] || 0;
    const change = after - before;
    const direction = change > 0 ? '📈 Melhorou' : change < 0 ? '📉 Piorou' : '➡️ Estável';
    return `- ${cat.name}: ${before}/12 → ${after}/12 (${change > 0 ? '+' : ''}${change}) ${direction}`;
  }).join('\n');

  const daysBetween = Math.floor(
    (newest.createdAt.getTime() - oldest.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Load trilha completion data
  const completedTrilhas = await prisma.trilha.findMany({
    where: { userId: state.userId },
    include: { progress: true },
  });

  const totalCompletion = completedTrilhas.filter((t) => {
    const total = (t.palestraIds as string[]).length;
    const watched = t.progress.filter((p) => p.watched).length;
    return total > 0 && watched === total;
  }).length;

  const watchedCount = await prisma.trilhaProgress.count({
    where: { userId: state.userId, watched: true },
  });

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `Você é um consultor de liderança do Global Leadership Summit especializado em análise de evolução.
${orgContext}
Gere uma análise narrativa da evolução do cliente entre diagnósticos.
Seja encorajador mas realista. Destaque progressos e áreas que precisam de atenção.
Responda em português brasileiro.
Responda APENAS com JSON válido, sem markdown.`,
    },
    {
      role: 'user',
      content: `Gere uma análise de evolução para a organização "${state.organizationName}":

Período: ${daysBetween} dias entre diagnósticos
Total de diagnósticos: ${diagnosticos.length}
Trilhas completadas: ${totalCompletion}
Palestras assistidas: ${watchedCount}

Evolução por categoria:
${evolutionDetails}

Prioridade original: Categoria ${oldest.priority1Category}
Prioridade atual: Categoria ${newest.priority1Category}

Formato JSON:
{
  "summary": "resumo em 2-3 frases da evolução geral",
  "highlights": ["destaques positivos"],
  "attentionAreas": ["áreas que precisam de atenção"],
  "nextSteps": ["3 recomendações para o próximo ciclo"],
  "motivationalMessage": "mensagem de encorajamento personalizada"
}`,
    },
  ];

  try {
    const response = await chatCompletion(messages, 0.6);
    const parsed = JSON.parse(response);

    return {
      intent: 'evolution_insight',
      data: {
        ...parsed,
        metrics: {
          totalDiagnosticos: diagnosticos.length,
          daysBetween,
          trilhasCompletadas: totalCompletion,
          palestrasAssistidas: watchedCount,
        },
      },
      confidence: 0.9,
      reasoning: `Análise de evolução gerada comparando ${diagnosticos.length} diagnósticos ao longo de ${daysBetween} dias.`,
    };
  } catch {
    return {
      intent: 'evolution_insight',
      data: { raw: 'Erro ao gerar análise de evolução.' },
      confidence: 0.3,
      reasoning: 'Falha no parse da resposta da IA.',
    };
  }
}
