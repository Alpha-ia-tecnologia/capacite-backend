import { CATEGORIES, CategoryScore } from '../../lib/scoring';
import { chatCompletion, getOrgContext, ChatMessage, CATALOGO_OFICIAL, PALESTRA_IDS_VALIDOS } from '../deepseek.service';
import prisma from '../../lib/prisma';
import type { DecisionState, PipelineResult } from '../decision-engine';

/**
 * Trilha Pipeline
 * 
 * Generates on-demand trilha suggestions based on a specific need
 * described by the user, going beyond the diagnostic-based defaults.
 */

const PALESTRA_IDS = `IDs de palestras disponíveis por categoria:
- Cat 1 (Liderança Pessoal): lp1, lp2, lp3
- Cat 2 (Pessoas, Cultura e Confiança): pcc1, pcc2, pcc3
- Cat 3 (Comunicação e Influência): ci1, ci2, ci3
- Cat 4 (Estratégia, Decisões e Execução): ede1, ede2, ede3
- Cat 5 (Mudança, Inovação e Reinvenção): mir1, mir2, mir3
- Cat 6 (Resiliência, Saúde Emocional): rse1, rse2, rse3
- Cat 7 (Propósito, Visão, Legado): pvl1, pvl2, pvl3`;

function buildTrilhaContext(state: DecisionState): string {
  const parts: string[] = [];

  if (state.diagnostico) {
    const ranking = state.diagnostico.ranking;
    parts.push('=== DIAGNÓSTICO DO CLIENTE ===');
    ranking.forEach((cat: CategoryScore, i: number) => {
      parts.push(`${i + 1}. ${cat.categoryName}: Gap ${cat.gap}/12`);
    });
  }

  // Check existing trilhas to avoid repetition
  if (state.existingTrilhas && state.existingTrilhas.length > 0) {
    parts.push('\n=== TRILHAS JÁ CRIADAS (evite repetir) ===');
    state.existingTrilhas.forEach((t: { name: string; type: string; palestraIds: unknown }) => {
      parts.push(`- ${t.name} (${t.type}): ${(t.palestraIds as string[]).join(', ')}`);
    });
  }

  return parts.join('\n');
}

export async function executeTrilhaPipeline(state: DecisionState): Promise<PipelineResult> {
  const orgContext = getOrgContext(state.organizationType);

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

  // Load existing trilhas to avoid repetition
  if (!state.existingTrilhas && state.userId) {
    const trilhas = await prisma.trilha.findMany({
      where: { userId: state.userId },
      select: { name: true, type: true, palestraIds: true },
    });
    state.existingTrilhas = trilhas;
  }

  const trilhaContext = buildTrilhaContext(state);

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `Você é um consultor de liderança do Global Leadership Summit.
${orgContext}
Sugira uma trilha de palestras personalizada baseada na necessidade específica descrita pelo cliente.
REGRA ABSOLUTA: Use APENAS palestras e palestrantes do catálogo oficial. NUNCA invente ou sugira palestras/palestrantes que não existam no catálogo.
Responda APENAS com JSON válido, sem markdown.`,
    },
    {
      role: 'user',
      content: `O cliente precisa de uma nova trilha para: "${state.query}"

${trilhaContext}

Sugira UMA trilha no formato JSON:
{
  "trilha": {
    "name": "nome da trilha",
    "description": "descrição curta",
    "type": "CUSTOM",
    "palestraIds": ["id1", "id2", "id3"],
    "reasoning": "por que esta sequência atende à necessidade específica"
  }
}

${PALESTRA_IDS}

A trilha deve ter 3-4 palestras e focar na necessidade descrita.
NÃO repita trilhas que o cliente já possui.`,
    },
  ];

  try {
    const response = await chatCompletion(messages, 0.5);
    const parsed = JSON.parse(response);

    // Validar que IDs retornados pela IA existem no catálogo oficial
    if (parsed.trilha?.palestraIds) {
      parsed.trilha.palestraIds = parsed.trilha.palestraIds.filter(
        (id: string) => PALESTRA_IDS_VALIDOS.includes(id)
      );
    }

    return {
      intent: 'new_trilha',
      data: parsed,
      confidence: 0.85,
      reasoning: `Trilha personalizada gerada para: "${state.query}".`,
    };
  } catch {
    return {
      intent: 'new_trilha',
      data: null,
      confidence: 0.3,
      reasoning: 'Falha ao gerar trilha personalizada.',
    };
  }
}
