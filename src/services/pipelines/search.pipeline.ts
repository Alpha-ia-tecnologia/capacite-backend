import { CATEGORIES } from '../../lib/scoring';
import { chatCompletion, getOrgContext, ChatMessage, CATALOGO_OFICIAL, PALESTRANTES_VALIDOS } from '../deepseek.service';
import prisma from '../../lib/prisma';
import type { DecisionState, PipelineResult } from '../decision-engine';

/**
 * Search Pipeline
 *
 * Intelligent search that enriches the query with the user's
 * diagnostic context, making results more relevant.
 */

const CATALOGO = CATALOGO_OFICIAL
  .map(p => `${p.id} "${p.title}" (${p.speaker}) [Cat ${p.categoryIds.join(',')}]`)
  .join('\n');

function buildSearchContext(state: DecisionState): string {
  const parts: string[] = [];

  if (state.diagnostico) {
    const ranking = state.diagnostico.ranking;
    const priority1 = ranking[0];
    const priority2 = ranking.length > 1 && ranking[0].gap - ranking[1].gap <= 1 ? ranking[1] : null;

    parts.push('=== CONTEXTO DO DIAGNÓSTICO DO CLIENTE ===');
    parts.push(`Prioridade 1: ${priority1.categoryName} (Gap: ${priority1.gap}/12)`);
    if (priority2) {
      parts.push(`Prioridade 2: ${priority2.categoryName} (Gap: ${priority2.gap}/12)`);
    }
    parts.push('Considere este contexto ao ranquear as palestras por relevância.');
  }

  return parts.join('\n');
}

export async function executeSearchPipeline(state: DecisionState): Promise<PipelineResult> {
  const orgContext = getOrgContext(state.organizationType);

  // Load diagnostic context if available
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

  const searchContext = buildSearchContext(state);

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `Você é um assessor inteligente do Global Leadership Summit que ajuda a encontrar palestras relevantes.
${orgContext}
Você tem acesso a EXATAMENTE 21 palestras de 17 palestrantes. NÃO existe nenhum outro palestrante ou palestra além dos listados no catálogo.
REGRA ABSOLUTA: NUNCA mencione, sugira ou referencie palestrantes ou palestras que não estejam no catálogo oficial.
Palestrantes válidos: ${PALESTRANTES_VALIDOS.join(', ')}
Se o cliente fizer perguntas fora do escopo de capacitação e liderança, redirecione educadamente para o contexto.
Responda em português brasileiro.
Responda APENAS com JSON válido, sem markdown.`,
    },
    {
      role: 'user',
      content: `O cliente busca: "${state.query}"

${searchContext}

Retorne um JSON com palestras relevantes:
{
  "results": [
    {
      "palestraId": "id",
      "title": "título",
      "speaker": "palestrante",
      "relevance": "por que é relevante para esta busca",
      "categoryName": "categoria",
      "matchesDiagnostic": true/false
    }
  ],
  "suggestion": "sugestão de busca complementar",
  "diagnosticInsight": "se o cliente tem diagnóstico, como esta busca se conecta com suas prioridades"
}

Catálogo:
${CATALOGO}`,
    },
  ];

  try {
    const response = await chatCompletion(messages, 0.5);
    const parsed = JSON.parse(response);

    return {
      intent: 'search',
      data: parsed,
      confidence: 0.9,
      reasoning: state.diagnostico
        ? 'Busca enriquecida com contexto do diagnóstico do cliente.'
        : 'Busca realizada sem contexto de diagnóstico.',
    };
  } catch {
    return {
      intent: 'search',
      data: { raw: 'Erro ao processar busca. Tente novamente.' },
      confidence: 0.3,
      reasoning: 'Falha no parse da resposta da IA.',
    };
  }
}
