import { CATEGORIES, CategoryScore } from '../../lib/scoring';
import { chatCompletion, getOrgContext, ChatMessage, CATALOGO_OFICIAL, PALESTRA_IDS_VALIDOS } from '../deepseek.service';
import { agentTrilhaSuggestions } from '../langgraph.service';
import prisma from '../../lib/prisma';
import type { DecisionState, PipelineResult } from '../decision-engine';

/**
 * Trilha Pipeline — LangGraph Agent
 * 
 * Uses the LangGraph agent with buscar_por_categoria and validar_ids tools
 * to guarantee only real catalog IDs are returned.
 */

export async function executeTrilhaPipeline(state: DecisionState): Promise<PipelineResult> {
  // Load diagnostic if not present
  if (!state.diagnostico && state.userId) {
    const latestDiag = await prisma.diagnostico.findFirst({
      where: { userId: state.userId },
      orderBy: { createdAt: 'desc' },
    });

    if (latestDiag) {
      const ranking = CATEGORIES.map((cat) => {
        const scores = latestDiag.categoryScores as Record<string, number>;
        const gaps = latestDiag.categoryGaps as Record<string, number>;
        return {
          categoryId: cat.id,
          categoryName: cat.name,
          score: scores[String(cat.id)] || 0,
          gap: gaps[String(cat.id)] || 0,
        };
      }).sort((a, b) => b.gap - a.gap);

      state.diagnostico = { ...latestDiag, ranking };
    }
  }

  // Get priority categories
  const priority1 = state.diagnostico?.ranking?.[0]?.categoryId || 1;
  const priority2 = state.diagnostico?.ranking?.length > 1 &&
    state.diagnostico.ranking[0].gap - state.diagnostico.ranking[1].gap <= 1
    ? state.diagnostico.ranking[1].categoryId
    : null;

  try {
    const trilhas = await agentTrilhaSuggestions(priority1, priority2, state.organizationType);

    return {
      intent: 'new_trilha',
      data: trilhas,
      confidence: 0.9,
      reasoning: `Trilhas geradas via LangGraph Agent com IDs validados por ferramenta.`,
    };
  } catch (err) {
    console.error('[TrilhaPipeline] Error:', err);
    return {
      intent: 'new_trilha',
      data: null,
      confidence: 0.3,
      reasoning: 'Falha ao gerar trilha personalizada.',
    };
  }
}

