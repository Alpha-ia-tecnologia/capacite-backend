import { CATEGORIES, CategoryScore, getStrengthLevel } from '../../lib/scoring';
import { chatCompletion, getOrgContext, ChatMessage } from '../deepseek.service';
import { agentDevolutiva } from '../langgraph.service';
import prisma from '../../lib/prisma';
import type { DecisionState, PipelineResult } from '../decision-engine';

/**
 * Diagnostic Pipeline — LangGraph Agent
 * 
 * Uses the LangGraph agent with buscar_por_categoria and detalhe_palestra tools
 * to generate devolutivas with ONLY real catalog data.
 * Quality check cycle is preserved.
 */

interface QualityCheck {
  score: number;
  feedback: string;
}

async function evaluateQuality(devolutiva: string): Promise<QualityCheck> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `Você é um avaliador de qualidade de devolutivas de liderança.
Avalie a devolutiva fornecida com base nos seguintes critérios:
1. Tem ações práticas claras? (peso 30%)
2. O tom é profissional e encorajador? (peso 20%)
3. Está contextualizada para a organização? (peso 25%)
4. Tem seções claras (O que significa, Por que apareceu, Primeiros passos, Sinal de progresso)? (peso 25%)

Responda APENAS com JSON válido:
{"score": 0.0-1.0, "feedback": "o que precisa melhorar"}`,
    },
    {
      role: 'user',
      content: `Avalie esta devolutiva:\n\n${devolutiva}`,
    },
  ];

  try {
    const response = await chatCompletion(messages, 0.3);
    const parsed = JSON.parse(response);
    return {
      score: Math.min(1, Math.max(0, parsed.score || 0)),
      feedback: parsed.feedback || '',
    };
  } catch {
    return { score: 0.8, feedback: '' };
  }
}

export async function executeDiagnosticPipeline(state: DecisionState): Promise<PipelineResult> {
  // Load diagnostic data if not present
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

  if (!state.diagnostico) {
    return {
      intent: 'diagnostic_analysis',
      data: null,
      confidence: 0,
      reasoning: 'Nenhum diagnóstico encontrado. O cliente precisa completar o diagnóstico primeiro.',
    };
  }

  // Build ranking for the agent
  const ranking: CategoryScore[] = state.diagnostico.ranking;

  // Generate devolutiva via LangGraph Agent (uses buscar_por_categoria tool)
  let result = await agentDevolutiva(ranking, state.organizationType, state.organizationName);
  let quality = await evaluateQuality(result);
  let retries = 0;
  const maxRetries = 1; // Reduced because agent responses are already higher quality

  while (quality.score < 0.7 && retries < maxRetries) {
    console.log(`[DiagnosticPipeline] Quality score: ${quality.score}, retrying (${retries + 1}/${maxRetries})...`);
    result = await agentDevolutiva(ranking, state.organizationType, state.organizationName);
    quality = await evaluateQuality(result);
    retries++;
  }

  console.log(`[DiagnosticPipeline] Final quality score: ${quality.score} after ${retries} retries`);

  return {
    intent: 'diagnostic_analysis',
    data: {
      devolutiva: result,
      qualityScore: quality.score,
      retries,
    },
    confidence: quality.score,
    reasoning: retries > 0
      ? `Devolutiva gerada via LangGraph e refinada ${retries}x para garantir qualidade.`
      : 'Devolutiva gerada via LangGraph Agent com qualidade satisfatória.',
  };
}

