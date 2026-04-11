import { chatCompletion, getOrgContext, ChatMessage } from '../deepseek.service';
import prisma from '../../lib/prisma';
import type { DecisionState, PipelineResult } from '../decision-engine';

/**
 * Questions Pipeline
 * 
 * Generates facilitation questions for palestras, enriched with
 * the organization's complementary context (e.g., climate surveys).
 */

function buildQuestionsContext(state: DecisionState): string {
  const parts: string[] = [];

  if (state.complementaryContext) {
    parts.push('=== CONTEXTO DA ORGANIZAÇÃO (Arquivos Complementares) ===');
    parts.push(state.complementaryContext);
    parts.push('Use este contexto para personalizar as perguntas ao cenário real da organização.');
  }

  return parts.join('\n');
}

export async function executeQuestionsPipeline(state: DecisionState): Promise<PipelineResult> {
  const orgContext = getOrgContext(state.organizationType);

  // Try to load complementary context
  if (!state.complementaryContext && state.userId) {
    const latestDiag = await prisma.diagnostico.findFirst({
      where: { userId: state.userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (latestDiag) {
      const files = await prisma.complementaryFile.findMany({
        where: { userId: state.userId, diagnosticoId: latestDiag.id },
        select: { originalName: true },
      });
      if (files.length > 0) {
        state.complementaryContext = `Arquivos enviados: ${files.map(f => f.originalName).join(', ')}. Use os nomes dos arquivos como referência para contextualizar as perguntas.`;
      }
    }
  }

  const questionsContext = buildQuestionsContext(state);

  // Extract palestra info from query
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `Você é um facilitador especializado em desenvolvimento de liderança do Global Leadership Summit.
${orgContext}
Gere perguntas para processamento em grupo após assistir palestras.
As perguntas devem estimular reflexão, debate e aplicação prática.
Responda em português brasileiro.
Responda APENAS com JSON válido, sem markdown.`,
    },
    {
      role: 'user',
      content: `Gere 5 perguntas de facilitação para processamento em grupo baseado na solicitação:
"${state.query}"

${questionsContext}

Formato JSON:
{
  "questions": [
    {
      "question": "pergunta",
      "purpose": "objetivo desta pergunta",
      "type": "reflexão | debate | aplicação"
    }
  ],
  "facilitation_tip": "dica para o facilitador conduzir a discussão"
}`,
    },
  ];

  try {
    const response = await chatCompletion(messages, 0.7);
    const parsed = JSON.parse(response);

    return {
      intent: 'questions',
      data: parsed,
      confidence: 0.9,
      reasoning: state.complementaryContext
        ? 'Perguntas geradas com contexto dos arquivos complementares da organização.'
        : 'Perguntas geradas com base no contexto padrão da organização.',
    };
  } catch {
    return {
      intent: 'questions',
      data: { raw: 'Erro ao gerar perguntas. Tente novamente.' },
      confidence: 0.3,
      reasoning: 'Falha no parse da resposta da IA.',
    };
  }
}
