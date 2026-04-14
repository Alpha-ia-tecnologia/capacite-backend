import { getOrgContext } from '../deepseek.service';
import { agentQuestions } from '../langgraph.service';
import prisma from '../../lib/prisma';
import type { DecisionState, PipelineResult } from '../decision-engine';

/**
 * Questions Pipeline — LangGraph Agent
 * 
 * Uses the LangGraph agent with buscar_palestras tool to verify
 * the palestra exists before generating questions.
 */

export async function executeQuestionsPipeline(state: DecisionState): Promise<PipelineResult> {
  try {
    // The query from the decision engine typically contains the palestra info
    // We pass it as both title and speaker context for the agent to resolve
    const response = await agentQuestions(
      state.query,        // title context
      state.query,        // speaker context (agent will search and validate)
      'Liderança',        // default category
      state.organizationType,
    );

    const parsed = JSON.parse(response);

    return {
      intent: 'questions',
      data: parsed,
      confidence: 0.9,
      reasoning: 'Perguntas geradas via LangGraph Agent com validação de palestra por ferramenta.',
    };
  } catch (err) {
    console.error('[QuestionsPipeline] Error:', err);
    return {
      intent: 'questions',
      data: { raw: 'Erro ao gerar perguntas. Tente novamente.' },
      confidence: 0.3,
      reasoning: 'Falha no parse da resposta da IA.',
    };
  }
}

