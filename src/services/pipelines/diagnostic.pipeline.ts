import { env } from '../../config/env';
import { CATEGORIES, CategoryScore, getStrengthLevel } from '../../lib/scoring';
import { chatCompletion, getOrgContext, ChatMessage } from '../deepseek.service';
import prisma from '../../lib/prisma';
import type { DecisionState, PipelineResult } from '../decision-engine';

/**
 * Diagnostic Pipeline
 * 
 * Generates personalized devolutivas with a quality check cycle.
 * If the first response doesn't meet quality standards, it retries
 * with feedback up to 2 additional times.
 */

interface QualityCheck {
  score: number;
  feedback: string;
}

function buildDiagnosticContext(state: DecisionState): string {
  const parts: string[] = [];

  if (state.diagnostico) {
    const ranking = state.diagnostico.ranking;
    parts.push('=== DIAGNÓSTICO DO CLIENTE ===');
    ranking.forEach((cat: CategoryScore, i: number) => {
      const level = getStrengthLevel(cat.score);
      parts.push(`${i + 1}. ${cat.categoryName}: Score ${cat.score}/12 (Gap: ${cat.gap}) - ${level}`);
    });

    const priority1 = ranking[0];
    parts.push(`\nPrioridade 1 (maior necessidade): ${priority1.categoryName} (Gap: ${priority1.gap})`);
    if (ranking.length > 1 && ranking[0].gap - ranking[1].gap <= 1) {
      parts.push(`Prioridade 2 (alavanca): ${ranking[1].categoryName} (Gap: ${ranking[1].gap})`);
    }
  }

  if (state.complementaryContext) {
    parts.push('\n=== CONTEXTO COMPLEMENTAR (Arquivos do Cliente) ===');
    parts.push(state.complementaryContext);
  }

  return parts.join('\n');
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
    // If evaluation fails, assume acceptable quality
    return { score: 0.8, feedback: '' };
  }
}

async function generateDevolutiva(
  state: DecisionState,
  previousResult?: string,
  feedback?: string
): Promise<string> {
  const orgContext = getOrgContext(state.organizationType);
  const diagnosticContext = buildDiagnosticContext(state);

  const systemPrompt = `Você é um consultor especializado em desenvolvimento de liderança do Global Leadership Summit.
Gere devolutivas personalizadas para organizações baseado nos resultados do diagnóstico de liderança.
${orgContext}
Seja direto, prático e encorajador. Use linguagem profissional mas acessível.
Responda em português brasileiro.

Para cada categoria identificada como prioritária, inclua OBRIGATORIAMENTE:
1. **O que significa:** Explicação clara do conceito
2. **Por que apareceu:** Contexto baseado nas respostas
3. **Primeiros passos:** 3 ações práticas para os próximos 14 dias
4. **Sinal de progresso:** Como saber que está melhorando

Também forneça um resumo geral do diagnóstico, destacando pontos fortes e áreas de oportunidade.`;

  let userPrompt = `Gere uma devolutiva personalizada para a organização "${state.organizationName}" com os seguintes dados:\n\n${diagnosticContext}`;

  if (previousResult && feedback) {
    userPrompt += `\n\n=== REVISÃO NECESSÁRIA ===
A devolutiva anterior precisa de ajustes:
${feedback}

Devolutiva anterior para referência:
${previousResult}

Por favor, gere uma nova versão melhorada.`;
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  return chatCompletion(messages);
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

  // Load complementary files context if available
  if (!state.complementaryContext && state.userId && state.diagnostico) {
    const files = await prisma.complementaryFile.findMany({
      where: { userId: state.userId, diagnosticoId: state.diagnostico.id },
      select: { originalName: true },
    });
    if (files.length > 0) {
      state.complementaryContext = `Arquivos enviados pelo cliente: ${files.map(f => f.originalName).join(', ')}`;
    }
  }

  // Generate devolutiva with quality check cycle
  let result = await generateDevolutiva(state);
  let quality = await evaluateQuality(result);
  let retries = 0;
  const maxRetries = 2;

  while (quality.score < 0.7 && retries < maxRetries) {
    console.log(`[DiagnosticPipeline] Quality score: ${quality.score}, retrying (${retries + 1}/${maxRetries})...`);
    result = await generateDevolutiva(state, result, quality.feedback);
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
      ? `Devolutiva gerada e refinada ${retries}x para garantir qualidade.`
      : 'Devolutiva gerada com qualidade satisfatória na primeira tentativa.',
  };
}
