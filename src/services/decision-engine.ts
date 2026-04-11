import { chatCompletion, ChatMessage } from './deepseek.service';
import prisma from '../lib/prisma';
import { CategoryScore } from '../lib/scoring';

import { executeDiagnosticPipeline } from './pipelines/diagnostic.pipeline';
import { executeSearchPipeline } from './pipelines/search.pipeline';
import { executeQuestionsPipeline } from './pipelines/questions.pipeline';
import { executeTrilhaPipeline } from './pipelines/trilha.pipeline';
import { executeEvolutionPipeline } from './pipelines/evolution.pipeline';

/**
 * Decision Engine — Central AI Router for CAPACITE
 * 
 * Classifies user intent via a lightweight LLM call and routes
 * to the appropriate pipeline. Each pipeline enriches its context
 * independently and returns a standardized result.
 */

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export type Intent =
  | 'diagnostic_analysis'
  | 'search'
  | 'questions'
  | 'new_trilha'
  | 'evolution_insight';

export interface DecisionState {
  userId: string;
  query: string;
  organizationType: string;
  organizationName: string;
  // Context — loaded on demand by pipelines
  diagnostico?: any;
  complementaryContext?: string;
  existingTrilhas?: any[];
}

export interface PipelineResult {
  intent: Intent;
  data: any;
  confidence: number;
  reasoning: string;
}

// ═══════════════════════════════════════════
// Intent Classification
// ═══════════════════════════════════════════

async function classifyIntent(query: string): Promise<Intent> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `Você é um classificador de intenções. Analise a solicitação do usuário e classifique em uma das categorias abaixo.

Categorias:
- diagnostic_analysis: O usuário quer analisar resultados do diagnóstico, gerar devolutiva, entender seus gaps ou pontos fortes
- search: O usuário quer buscar palestras por tema, desafio, palavra-chave ou necessidade específica
- questions: O usuário quer gerar perguntas de facilitação para palestras ou reflexão em grupo
- new_trilha: O usuário quer uma nova trilha de palestras, sugestão de sequência, ou caminho de aprendizado
- evolution_insight: O usuário quer ver sua evolução, comparar diagnósticos, entender progresso ao longo do tempo

Responda APENAS com uma das palavras-chave acima. Nada mais.`,
    },
    {
      role: 'user',
      content: query,
    },
  ];

  try {
    const response = await chatCompletion(messages, 0.1);
    const intent = response.trim().toLowerCase() as Intent;

    const validIntents: Intent[] = [
      'diagnostic_analysis',
      'search',
      'questions',
      'new_trilha',
      'evolution_insight',
    ];

    if (validIntents.includes(intent)) {
      return intent;
    }

    // Fallback: if the LLM returns something unexpected, default to search
    console.warn(`[DecisionEngine] Unknown intent "${response}", defaulting to "search"`);
    return 'search';
  } catch (error) {
    console.error('[DecisionEngine] Intent classification failed:', error);
    return 'search'; // Safe fallback
  }
}

// ═══════════════════════════════════════════
// Pipeline Registry
// ═══════════════════════════════════════════

const PIPELINE_REGISTRY: Record<Intent, (state: DecisionState) => Promise<PipelineResult>> = {
  diagnostic_analysis: executeDiagnosticPipeline,
  search: executeSearchPipeline,
  questions: executeQuestionsPipeline,
  new_trilha: executeTrilhaPipeline,
  evolution_insight: executeEvolutionPipeline,
};

// ═══════════════════════════════════════════
// Main Decision Function
// ═══════════════════════════════════════════

export interface DecisionRequest {
  userId: string;
  query: string;
  intent?: Intent; // Optional: skip classification if intent is known
}

export interface DecisionResponse {
  intent: Intent;
  result: PipelineResult;
  metadata: {
    classifiedAt: string;
    executedAt: string;
    executionTimeMs: number;
  };
}

export async function decide(request: DecisionRequest): Promise<DecisionResponse> {
  const startTime = Date.now();

  // 1. Load user context
  const user = await prisma.user.findUnique({
    where: { id: request.userId },
    select: {
      organizationType: true,
      organization: true,
    },
  });

  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  // 2. Classify intent (or use provided one)
  const classifiedAt = new Date().toISOString();
  const intent = request.intent || (await classifyIntent(request.query));

  console.log(`[DecisionEngine] Intent: ${intent} | Query: "${request.query.substring(0, 60)}..."`);

  // 3. Build initial state
  const state: DecisionState = {
    userId: request.userId,
    query: request.query,
    organizationType: user.organizationType,
    organizationName: user.organization,
  };

  // 4. Execute the appropriate pipeline
  const pipeline = PIPELINE_REGISTRY[intent];
  const result = await pipeline(state);

  const executionTimeMs = Date.now() - startTime;
  console.log(`[DecisionEngine] Completed in ${executionTimeMs}ms | Confidence: ${result.confidence}`);

  return {
    intent,
    result,
    metadata: {
      classifiedAt,
      executedAt: new Date().toISOString(),
      executionTimeMs,
    },
  };
}
