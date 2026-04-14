import { ChatOpenAI } from "@langchain/openai";
// @ts-ignore - TS cannot resolve export map using default node resolution
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { env } from "../config/env";
import { getOrgContext, CATALOGO_OFICIAL, PALESTRANTES_VALIDOS, PALESTRA_IDS_VALIDOS } from "./deepseek.service";
import { CATEGORIES, CategoryScore, getStrengthLevel } from "../lib/scoring";

// ═══════════════════════════════════════════
// LLM Instance Factory (DeepSeek via OpenAI SDK)
// ═══════════════════════════════════════════

function createLLM(temperature = 0.1) {
  return new ChatOpenAI({
    model: "deepseek-chat",
    temperature,
    configuration: { baseURL: env.DEEPSEEK_BASE_URL },
    apiKey: env.DEEPSEEK_API_KEY,
    maxTokens: 2500,
  });
}

// ═══════════════════════════════════════════
// TOOL 1: Buscar Palestras no Catálogo
// ═══════════════════════════════════════════

const buscar_palestras = tool(
  async ({ termo }) => {
    const lowerTermo = termo.toLowerCase();

    const resultados = CATALOGO_OFICIAL.filter(p =>
      p.title.toLowerCase().includes(lowerTermo) ||
      p.speaker.toLowerCase().includes(lowerTermo)
    );

    if (resultados.length === 0) {
      return "NENHUMA palestra encontrada no catálogo para esse termo. NÃO invente dados. Informe ao usuário que não há correspondência.";
    }

    return resultados
      .map(p => `ID: ${p.id} | Título: "${p.title}" | Palestrante: ${p.speaker} | Categorias: ${JSON.stringify(p.categoryIds)}`)
      .join('\n');
  },
  {
    name: "buscar_palestras",
    description: "Busca palestrantes ou palestras no catálogo oficial por nome do preletor ou tema da palestra. SEMPRE use antes de afirmar que uma palestra existe.",
    schema: z.object({
      termo: z.string().describe("Termo de pesquisa: nome do preletor ou palavra-chave do título"),
    }),
  }
);

// ═══════════════════════════════════════════
// TOOL 2: Buscar Palestras por Categoria
// ═══════════════════════════════════════════

const buscar_por_categoria = tool(
  async ({ categoryId }) => {
    const resultados = CATALOGO_OFICIAL.filter(p =>
      p.categoryIds.includes(categoryId)
    );

    const catName = CATEGORIES.find(c => c.id === categoryId)?.name || `Categoria ${categoryId}`;

    if (resultados.length === 0) {
      return `Nenhuma palestra encontrada para a categoria ${catName} (ID: ${categoryId}).`;
    }

    return `Palestras da categoria "${catName}" (${resultados.length} encontradas):\n` +
      resultados
        .map(p => `ID: ${p.id} | Título: "${p.title}" | Palestrante: ${p.speaker}`)
        .join('\n');
  },
  {
    name: "buscar_por_categoria",
    description: "Busca TODAS as palestras de uma categoria específica pelo ID da categoria (1-7). Use para montar trilhas ou devolutivas baseadas em categorias prioritárias.",
    schema: z.object({
      categoryId: z.number().min(1).max(7).describe("ID da categoria (1=Liderança Pessoal, 2=Pessoas/Cultura/Confiança, 3=Comunicação/Influência, 4=Estratégia/Decisões/Execução, 5=Mudança/Inovação, 6=Resiliência/Saúde, 7=Propósito/Visão/Legado)"),
    }),
  }
);

// ═══════════════════════════════════════════
// TOOL 3: Validar IDs de Palestras
// ═══════════════════════════════════════════

const validar_ids = tool(
  async ({ ids }) => {
    const validos = ids.filter(id => PALESTRA_IDS_VALIDOS.includes(id));
    const invalidos = ids.filter(id => !PALESTRA_IDS_VALIDOS.includes(id));

    let msg = `IDs válidos: [${validos.join(', ')}]`;
    if (invalidos.length > 0) {
      msg += `\nIDs INVÁLIDOS (remova estes!): [${invalidos.join(', ')}]`;
    }
    return msg;
  },
  {
    name: "validar_ids",
    description: "Valida se os IDs de palestras existem no catálogo oficial. Use ANTES de incluir IDs na resposta final para garantir que são válidos.",
    schema: z.object({
      ids: z.array(z.string()).describe("Lista de IDs de palestras a validar, por exemplo ['lp1', 'pcc2', 'gls23_4']"),
    }),
  }
);

// ═══════════════════════════════════════════
// TOOL 4: Obter Detalhes de uma Palestra
// ═══════════════════════════════════════════

const detalhe_palestra = tool(
  async ({ palestraId }) => {
    const palestra = CATALOGO_OFICIAL.find(p => p.id === palestraId);
    if (!palestra) {
      return `Palestra com ID "${palestraId}" NÃO EXISTE no catálogo. Use buscar_palestras ou buscar_por_categoria para encontrar IDs válidos.`;
    }
    const cats = palestra.categoryIds.map(cid => CATEGORIES.find(c => c.id === cid)?.name || `Cat ${cid}`);
    return `ID: ${palestra.id} | Título: "${palestra.title}" | Palestrante: ${palestra.speaker} | Categorias: ${cats.join(', ')}`;
  },
  {
    name: "detalhe_palestra",
    description: "Obtém detalhes completos de uma palestra específica pelo ID. Use para enriquecer respostas com informações precisas.",
    schema: z.object({
      palestraId: z.string().describe("ID da palestra, por exemplo 'lp1', 'gls23_4'"),
    }),
  }
);


// ═══════════════════════════════════════════
// AGENT 1: Busca Inteligente
// ═══════════════════════════════════════════

export async function agentSearch(query: string, organizationType: string): Promise<string> {
  const orgContext = getOrgContext(organizationType);
  const palestrantes = PALESTRANTES_VALIDOS.join(', ');

  const agent = createReactAgent({
    llm: createLLM(0.1),
    tools: [buscar_palestras],
  });

  const systemPrompt = `Você é um assessor inteligente da plataforma CAPACITE do Global Leadership Summit.
${orgContext}
Você tem acesso EXCLUSIVO às palestras e preletores retornados OBRIGATORIAMENTE pela ferramenta "buscar_palestras".
REGRA ABSOLUTA 1: Você DEVE usar a ferramenta "buscar_palestras" para encontrar informações antes de responder.
REGRA ABSOLUTA 2: Você JAMAIS deve inventar uma palestra se a ferramenta não retornou correspondência.
REGRA ABSOLUTA 3: Se não há dados, devolva um insight avisando que não temos, listando preletores disponíveis: ${palestrantes}.

Seu retorno final DEVE ser SEMPRE um JSON válido (SÓ O JSON):
{
  "results": [
    { "type": "palestra", "palestraId": "ID exato", "title": "título EXATO", "speaker": "palestrante EXATO", "relevance": "por que", "categoryName": "categoria" },
    { "type": "preletor", "title": "Nome", "speaker": "Nome", "relevance": "expertise", "categoryName": "área" },
    { "type": "insight", "title": "Insight", "relevance": "insight real", "categoryName": "Categoria" }
  ],
  "suggestion": "sugestão"
}
Se a ferramenta não encontrou, coloque results com 1 insight de aviso. NUNCA DEVOLVA PALESTRAS FICTÍCIAS.`;

  const result = await agent.invoke({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Quais dados temos e quais podemos criar de insight para: "${query}"?` }
    ]
  });

  const lastMessageContent = result.messages[result.messages.length - 1].content as string;
  return lastMessageContent.replace(/```json/g, '').replace(/```/g, '').trim();
}


// ═══════════════════════════════════════════
// AGENT 2: Geração de Trilhas Sugeridas
// ═══════════════════════════════════════════

export async function agentTrilhaSuggestions(
  priority1CategoryId: number,
  priority2CategoryId: number | null,
  organizationType: string
): Promise<{ trilha1: any; trilha2: any }> {
  const orgContext = getOrgContext(organizationType);
  const cat1 = CATEGORIES.find(c => c.id === priority1CategoryId);
  const cat2 = priority2CategoryId ? CATEGORIES.find(c => c.id === priority2CategoryId) : null;

  const agent = createReactAgent({
    llm: createLLM(0.3),
    tools: [buscar_por_categoria, validar_ids],
  });

  const systemPrompt = `Você é um consultor de liderança do Global Leadership Summit.
${orgContext}
Sugira trilhas de palestras baseadas nas categorias prioritárias do diagnóstico.

REGRAS ABSOLUTAS:
1. ANTES de sugerir qualquer trilha, use a ferramenta "buscar_por_categoria" com os IDs das categorias prioritárias para ver quais palestras existem.
2. Use SOMENTE IDs retornados pela ferramenta. NUNCA invente IDs.
3. ANTES de responder, use "validar_ids" para confirmar que todos os IDs escolhidos são válidos.
4. Cada trilha deve ter 3-4 palestras.

Seu retorno final DEVE ser APENAS JSON válido (SÓ O JSON, sem markdown):
{
  "trilha1": {
    "name": "nome da trilha",
    "description": "descrição curta",
    "type": "IMPACTO",
    "palestraIds": ["id1", "id2", "id3"],
    "reasoning": "por que esta sequência"
  },
  "trilha2": {
    "name": "nome da trilha",
    "description": "descrição curta",
    "type": "APROFUNDAMENTO",
    "palestraIds": ["id1", "id2", "id3"],
    "reasoning": "por que esta sequência"
  }
}`;

  const userPrompt = `Com base nas prioridades:
- Prioridade 1: ${cat1?.name || 'Categoria ' + priority1CategoryId} (categoryId: ${priority1CategoryId})
${cat2 ? `- Prioridade 2: ${cat2.name} (categoryId: ${priority2CategoryId})` : ''}

Busque as palestras disponíveis nas categorias prioritárias, valide os IDs e sugira duas trilhas.
Trilha 1: IMPACTO (ação rápida, 3-4 palestras).
Trilha 2: APROFUNDAMENTO (reflexão, 3-4 palestras).`;

  try {
    const result = await agent.invoke({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    const raw = (result.messages[result.messages.length - 1].content as string)
      .replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(raw);

    // Post-validation: filter only valid IDs as safety net
    if (parsed.trilha1?.palestraIds) {
      parsed.trilha1.palestraIds = parsed.trilha1.palestraIds.filter((id: string) => PALESTRA_IDS_VALIDOS.includes(id));
    }
    if (parsed.trilha2?.palestraIds) {
      parsed.trilha2.palestraIds = parsed.trilha2.palestraIds.filter((id: string) => PALESTRA_IDS_VALIDOS.includes(id));
    }

    return parsed;
  } catch (err) {
    console.error('[agentTrilhaSuggestions] Fallback triggered:', err);
    // Fallback determinístico
    const catPrefixes: Record<number, string> = { 1: 'lp', 2: 'pcc', 3: 'ci', 4: 'ede', 5: 'mir', 6: 'rse', 7: 'pvl' };
    const prefix1 = catPrefixes[priority1CategoryId] || 'lp';
    const prefix2 = priority2CategoryId ? catPrefixes[priority2CategoryId] || prefix1 : prefix1;
    const fb1 = [`${prefix1}1`, `${prefix1}2`, `${prefix1}3`].filter(id => PALESTRA_IDS_VALIDOS.includes(id));
    const fb2 = [`${prefix2}1`, `${prefix2}2`, `${prefix2}3`].filter(id => PALESTRA_IDS_VALIDOS.includes(id));
    return {
      trilha1: { name: `Impacto Rápido - ${cat1?.name || 'Liderança'}`, description: 'Mudanças visíveis em 2-3 semanas.', type: 'IMPACTO', palestraIds: fb1, reasoning: 'Trilha de fallback.' },
      trilha2: { name: `Aprofundamento - ${cat2?.name || cat1?.name || 'Liderança'}`, description: 'Consolidar aprendizados.', type: 'APROFUNDAMENTO', palestraIds: fb2, reasoning: 'Trilha de fallback.' },
    };
  }
}


// ═══════════════════════════════════════════
// AGENT 3: Geração de Devolutiva do Diagnóstico
// ═══════════════════════════════════════════

export async function agentDevolutiva(
  ranking: CategoryScore[],
  organizationType: string,
  organizationName: string
): Promise<string> {
  const orgContext = getOrgContext(organizationType);

  const agent = createReactAgent({
    llm: createLLM(0.5),
    tools: [buscar_por_categoria, detalhe_palestra],
  });

  const categoryDetails = ranking
    .map((cat, i) => {
      const level = getStrengthLevel(cat.score);
      return `${i + 1}. ${cat.categoryName} (catId: ${cat.categoryId}): Score ${cat.score}/12 (Gap: ${cat.gap}) - ${level}`;
    })
    .join('\n');

  const priority1 = ranking[0];
  const priority2 = ranking.length > 1 && ranking[0].gap - ranking[1].gap <= 1 ? ranking[1] : null;

  const systemPrompt = `Você é um consultor especializado em desenvolvimento de liderança do Global Leadership Summit.
${orgContext}
Gere devolutivas personalizadas para organizações baseado nos resultados do diagnóstico de liderança.

REGRAS ABSOLUTAS:
1. Use a ferramenta "buscar_por_categoria" para encontrar palestras REAIS relacionadas às categorias prioritárias.
2. Se mencionar qualquer palestra ou palestrante na devolutiva, use "detalhe_palestra" para confirmar que existe.
3. NUNCA invente palestras ou palestrantes.
4. Se quiser sugerir palestras, use SOMENTE aquelas retornadas pelas ferramentas.

Seja direto, prático e encorajador. Use linguagem profissional mas acessível.
Responda em português brasileiro.

Para cada categoria prioritária, inclua OBRIGATORIAMENTE:
1. **O que significa:** Explicação clara do conceito
2. **Por que apareceu:** Contexto baseado nas respostas
3. **Primeiros passos:** 3 ações práticas para os próximos 14 dias
4. **Sinal de progresso:** Como saber que está melhorando
5. **Palestras sugeridas:** Listar as palestras REAIS da categoria (confirme com as ferramentas)

Também forneça um resumo geral do diagnóstico.`;

  const userPrompt = `Gere uma devolutiva personalizada para a organização "${organizationName}" com os seguintes resultados:

${categoryDetails}

Prioridade 1 (maior necessidade): ${priority1.categoryName} (categoryId: ${priority1.categoryId}, Gap: ${priority1.gap})
${priority2 ? `Prioridade 2 (alavanca): ${priority2.categoryName} (categoryId: ${priority2.categoryId}, Gap: ${priority2.gap})` : 'Sem prioridade 2 identificada.'}

Busque as palestras das categorias prioritárias usando as ferramentas antes de redigir a devolutiva.`;

  const result = await agent.invoke({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  const content = result.messages[result.messages.length - 1].content as string;
  return content.replace(/```json/g, '').replace(/```/g, '').trim();
}


// ═══════════════════════════════════════════
// AGENT 4: Geração de Perguntas Pós-Palestra
// ═══════════════════════════════════════════

export async function agentQuestions(
  palestraTitle: string,
  speaker: string,
  categoryName: string,
  organizationType: string,
  customContext?: string
): Promise<string> {
  const orgContext = getOrgContext(organizationType);

  const agent = createReactAgent({
    llm: createLLM(0.5),
    tools: [buscar_palestras, detalhe_palestra],
  });

  const systemPrompt = `Você é um facilitador especializado em desenvolvimento de liderança do Global Leadership Summit.
${orgContext}
Gere perguntas para processamento em grupo após assistir palestras.

REGRAS ABSOLUTAS:
1. ANTES de gerar perguntas, use "buscar_palestras" com o nome do palestrante para confirmar que a palestra existe no catálogo.
2. Se a palestra NÃO existir no catálogo, informe que não pode gerar perguntas para ela e NÃO invente conteúdo.
3. As perguntas devem ser baseadas no TÍTULO REAL e PALESTRANTE REAL retornado pela ferramenta.
4. Estimule reflexão, debate e aplicação prática.

Responda em português brasileiro.
Responda APENAS com JSON válido (SÓ O JSON, sem markdown):
{
  "questions": [
    {
      "question": "pergunta",
      "purpose": "objetivo desta pergunta",
      "type": "reflexão | debate | aplicação"
    }
  ]
}

Se a palestra não existir no catálogo, retorne:
{
  "error": "Palestra não encontrada no catálogo oficial.",
  "questions": []
}`;

  const userPrompt = `Gere 5 perguntas de facilitação para processamento em grupo da palestra:
- Título informado: "${palestraTitle}"
- Palestrante informado: ${speaker}
- Categoria: ${categoryName}
${customContext ? `- Contexto específico: ${customContext}` : ''}

Primeiro, confirme que a palestra e o palestrante existem no catálogo usando buscar_palestras com o nome "${speaker}".`;

  const result = await agent.invoke({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  const content = result.messages[result.messages.length - 1].content as string;
  return content.replace(/```json/g, '').replace(/```/g, '').trim();
}
