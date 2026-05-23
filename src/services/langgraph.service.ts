import { ChatOpenAI } from "@langchain/openai";
// @ts-ignore - TS cannot resolve export map using default node resolution
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { env } from "../config/env";
import { getOrgContext } from "./deepseek.service";
import { CATEGORIES, CategoryScore, getStrengthLevel } from "../lib/scoring";
import prisma from "../lib/prisma";

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
// Helpers de busca (tokenizacao + normalizacao)
// ═══════════════════════════════════════════

// Minusculas + remove acentos: faz "lideranca" casar com "Liderança".
function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Extrai o objeto JSON de uma resposta do LLM que pode vir com prosa ou
// markdown ao redor (ex.: "Aqui esta o JSON: { ... }").
function extrairJson(texto: string): string {
  const semFences = texto.replace(/```json/gi, "").replace(/```/g, "").trim();
  const inicio = semFences.indexOf("{");
  const fim = semFences.lastIndexOf("}");
  if (inicio !== -1 && fim !== -1 && fim > inicio) {
    return semFences.slice(inicio, fim + 1);
  }
  return semFences;
}

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "para", "por", "com", "sem", "e", "ou",
  "o", "a", "os", "as", "um", "uma", "uns", "umas", "em", "no", "na", "nos",
  "nas", "que", "se", "sobre", "como", "ao", "aos", "meu", "minha", "seu",
  "sua", "palestra", "palestras", "preletor", "preletores", "tema", "temas",
]);

// Mapa categoryId numerico (1-7) -> slug armazenado em Palestra.categoryIds.
const CATEGORY_SLUGS: Record<number, string> = {
  1: "lideranca-pessoal",
  2: "pessoas-cultura-confianca",
  3: "comunicacao-influencia",
  4: "estrategia-decisoes-execucao",
  5: "mudanca-inovacao-reinvencao",
  6: "resiliencia-saude-bemestar",
  7: "proposito-visao-legado",
};

// Dicionario de conceitos/sinonimos (normalizados, sem acento) -> slug da categoria.
// Camada semantica leve: como as descricoes ainda sao placeholders e nao ha
// embeddings, usamos a taxonomia das 7 categorias para casar a INTENCAO da busca
// (ex.: "transformacional" -> mudanca-inovacao-reinvencao) e nao so a palavra literal.
const CONCEPT_KEYWORDS: Record<string, string[]> = {
  "lideranca-pessoal": [
    "lideranca", "lider", "autolideranca", "autoconhecimento", "autoconsciencia",
    "autogestao", "disciplina", "integridade", "coerencia", "carater", "exemplo",
    "habitos", "mentalidade", "consistencia", "maturidade", "humildade", "confianca",
  ],
  "pessoas-cultura-confianca": [
    "pessoas", "cultura", "confianca", "equipe", "time", "relacionamento",
    "relacionamentos", "vulnerabilidade", "seguranca", "psicologica", "respeito",
    "colaboracao", "engajamento", "pertencimento", "diversidade", "inclusao",
    "empatia", "geracoes", "conexao", "humano", "humana",
  ],
  "comunicacao-influencia": [
    "comunicacao", "comunicar", "influencia", "influenciar", "conversa", "conversas",
    "feedback", "persuasao", "oratoria", "escuta", "negociacao", "dialogo", "clareza",
    "mensagem", "storytelling", "apresentacao", "fala", "discurso", "narrativa",
  ],
  "estrategia-decisoes-execucao": [
    "estrategia", "estrategico", "estrategica", "decisao", "decisoes", "decidir",
    "execucao", "executar", "planejamento", "foco", "prioridade", "prioridades",
    "meta", "metas", "resultado", "resultados", "produtividade", "gestao",
    "performance", "desempenho", "processo", "eficiencia", "papeis", "organizacao",
  ],
  "mudanca-inovacao-reinvencao": [
    "mudanca", "transformacao", "transformacional", "transformadora", "transformar",
    "inovacao", "inovar", "inovadora", "reinvencao", "reinventar", "disrupcao",
    "criatividade", "criativa", "adaptacao", "agilidade", "futuro", "tecnologia",
    "transicao", "startup", "mentalidade",
  ],
  "resiliencia-saude-bemestar": [
    "resiliencia", "resiliente", "saude", "emocional", "bemestar", "estresse",
    "burnout", "equilibrio", "sustentavel", "esgotamento", "autocuidado", "mental",
    "perseveranca", "superacao", "ansiedade", "paz", "descanso", "ritmo", "limites",
  ],
  "proposito-visao-legado": [
    "proposito", "visao", "legado", "impacto", "missao", "valores", "significado",
    "sentido", "transcendencia", "contribuicao", "sonho", "causa", "vocacao",
    "social", "responsabilidade", "esperanca",
  ],
};

// Dado um conjunto de tokens da busca, retorna os slugs de categoria cuja
// intencao foi acionada por algum conceito/sinonimo.
function categoriasPorConceito(tokens: string[]): Set<string> {
  const slugs = new Set<string>();
  for (const [slug, palavras] of Object.entries(CONCEPT_KEYWORDS)) {
    if (tokens.some(tk => palavras.includes(tk))) slugs.add(slug);
  }
  return slugs;
}

// ═══════════════════════════════════════════
// TOOL 1: Buscar Palestras no Catálogo
// ═══════════════════════════════════════════

const buscar_palestras = tool(
  async ({ termo }) => {
    // Quebra a busca em palavras isoladas e remove acentos/stopwords, para que
    // frases como "Lideranca transformacional" casem por palavra (e nao exijam
    // a frase inteira contigua) e sejam insensiveis a acento.
    const termoNorm = normalizar(termo);
    const tokens = Array.from(new Set(
      termoNorm.split(/[^a-z0-9]+/).filter(t => t.length >= 3 && !STOPWORDS.has(t))
    ));
    const termosBusca = tokens.length > 0 ? tokens : [termoNorm].filter(Boolean);

    // Categorias acionadas pela INTENCAO da busca (sinonimos/conceitos).
    const categoriasAlvo = categoriasPorConceito(termosBusca);

    // Dataset pequeno (~uma centena): carrega projecao leve e ranqueia em memoria.
    const todas = await prisma.palestra.findMany({
      select: {
        id: true, externalId: true, title: true, speaker: true,
        description: true, summary: true, duration: true, year: true,
        categoryIds: true, isProcessed: true,
        speakerProfile: { select: { bio: true } },
      },
    });

    const resultados = todas
      .map(p => {
        const titulo = normalizar(p.title);
        const palestrante = normalizar(p.speaker);
        const corpo = normalizar([p.description, p.summary ?? '', p.speakerProfile?.bio ?? ''].join(' '));
        let score = 0;
        for (const tk of termosBusca) {
          if (titulo.includes(tk) || palestrante.includes(tk)) score += 3;
          else if (corpo.includes(tk)) score += 1;
        }
        // Boost semantico: a palestra pertence a uma categoria que a busca acionou.
        // Peso menor que um acerto literal, para que matches diretos ranqueiem antes.
        const cats = Array.isArray(p.categoryIds) ? (p.categoryIds as unknown[]).map(String) : [];
        if (cats.some(c => categoriasAlvo.has(c))) score += 2;
        return { p, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) =>
        b.score - a.score ||
        Number(b.p.isProcessed) - Number(a.p.isProcessed) ||
        (b.p.year ?? 0) - (a.p.year ?? 0) ||
        a.p.title.localeCompare(b.p.title)
      )
      .slice(0, 12)
      .map(x => x.p);

    if (resultados.length === 0) {
      return "NENHUMA palestra encontrada no banco de dados de producao para esse termo. NAO invente dados. Informe ao usuario que nao ha correspondencia.";
    }

    return resultados
      .map(p => {
        const bio = p.speakerProfile?.bio ? ` | Bio: ${p.speakerProfile.bio.slice(0, 240)}` : '';
        const summary = p.summary ? ` | Resumo: ${p.summary.slice(0, 240)}` : '';
        return `ID: ${p.externalId || p.id} | DB_ID: ${p.id} | Titulo: "${p.title}" | Palestrante: ${p.speaker} | Duracao: ${p.duration} | Ano: ${p.year} | Categorias: ${JSON.stringify(p.categoryIds)}${summary}${bio}`;
      })
      .join('\n');
  },
  {
    name: "buscar_palestras",
    description: "Busca palestrantes ou palestras exclusivamente no banco de dados de producao. Ja faz busca por palavra (frases sao quebradas em termos), e insensivel a acentos e entende sinonimos/temas mapeando a intencao para as 7 categorias (ex.: 'transformacional' encontra palestras de Mudanca/Inovacao). Passe a pergunta NATURAL do usuario. SEMPRE use antes de afirmar que uma palestra existe.",
    schema: z.object({
      termo: z.string().describe("A pergunta ou tema do usuario, em linguagem natural (ex.: 'lideranca transformacional', 'como dar feedback')"),
    }),
  }
);

// ═══════════════════════════════════════════
// TOOL 2: Buscar Palestras por Categoria
// ═══════════════════════════════════════════

const buscar_por_categoria = tool(
  async ({ categoryId }) => {
    const catName = CATEGORIES.find(c => c.id === categoryId)?.name || `Categoria ${categoryId}`;
    const slug = CATEGORY_SLUGS[categoryId];

    if (!slug) {
      return `Categoria ${categoryId} invalida. Use IDs de 1 a 7.`;
    }

    // Palestra.categoryIds guarda slugs (ex.: "lideranca-pessoal"), nao numeros.
    const resultados = await prisma.palestra.findMany({
      where: { categoryIds: { array_contains: slug } },
      take: 30,
      orderBy: [{ isProcessed: 'desc' }, { year: 'desc' }, { title: 'asc' }],
    });

    if (resultados.length === 0) {
      return `Nenhuma palestra encontrada no banco de dados de producao para a categoria ${catName} (ID: ${categoryId}).`;
    }

    return `Palestras da categoria "${catName}" (${resultados.length} encontradas):\n` +
      resultados
        .map(p => `ID: ${p.externalId || p.id} | DB_ID: ${p.id} | Titulo: "${p.title}" | Palestrante: ${p.speaker}`)
        .join('\n');
  },
  {
    name: "buscar_por_categoria",
    description: "Busca TODAS as palestras de uma categoria especifica exclusivamente no banco de dados de producao.",
    schema: z.object({
      categoryId: z.number().min(1).max(7).describe("ID da categoria (1-7)"),
    }),
  }
);

const validar_ids = tool(
  async ({ ids }) => {
    const rows = await prisma.palestra.findMany({
      where: { OR: [{ id: { in: ids } }, { externalId: { in: ids } }] },
      select: { id: true, externalId: true },
    });
    const validSet = new Set(rows.flatMap(row => [row.id, row.externalId].filter(Boolean) as string[]));
    const validos = ids.filter(id => validSet.has(id));
    const invalidos = ids.filter(id => !validSet.has(id));

    let msg = `IDs validos no banco de producao: [${validos.join(', ')}]`;
    if (invalidos.length > 0) {
      msg += `\nIDs INVALIDOS no banco de producao (remova estes): [${invalidos.join(', ')}]`;
    }
    return msg;
  },
  {
    name: "validar_ids",
    description: "Valida se os IDs de palestras existem no banco de dados de producao.",
    schema: z.object({
      ids: z.array(z.string()).describe("Lista de IDs ou externalIds de palestras a validar"),
    }),
  }
);

const detalhe_palestra = tool(
  async ({ palestraId }) => {
    const palestra = await prisma.palestra.findFirst({
      where: { OR: [{ id: palestraId }, { externalId: palestraId }] },
      include: { speakerProfile: true },
    });
    if (!palestra) {
      return `Palestra com ID "${palestraId}" NAO EXISTE no banco de dados de producao. Use buscar_palestras ou buscar_por_categoria para encontrar IDs validos.`;
    }
    const categoryIds = Array.isArray(palestra.categoryIds) ? palestra.categoryIds : [];
    const cats = categoryIds.map(cid => CATEGORIES.find(c => c.id === cid)?.name || `Cat ${cid}`);
    return `ID: ${palestra.externalId || palestra.id} | DB_ID: ${palestra.id} | Titulo: "${palestra.title}" | Palestrante: ${palestra.speaker} | Duracao: ${palestra.duration} | Ano: ${palestra.year} | Categorias: ${cats.join(', ')} | Descricao: ${palestra.description}${palestra.summary ? ` | Resumo: ${palestra.summary}` : ''}${palestra.speakerProfile?.bio ? ` | Bio: ${palestra.speakerProfile.bio}` : ''}`;
  },
  {
    name: "detalhe_palestra",
    description: "Obtem detalhes completos de uma palestra especifica pelo ID no banco de dados de producao.",
    schema: z.object({
      palestraId: z.string().describe("ID ou externalId da palestra"),
    }),
  }
);

async function filterExistingPalestraIds(ids: string[]): Promise<string[]> {
  const rows = await prisma.palestra.findMany({
    where: { OR: [{ id: { in: ids } }, { externalId: { in: ids } }] },
    select: { id: true, externalId: true },
  });
  const validSet = new Set(rows.flatMap(row => [row.id, row.externalId].filter(Boolean) as string[]));
  return ids.filter(id => validSet.has(id));
}

async function getFallbackPalestraIds(prefix: string): Promise<string[]> {
  const rows = await prisma.palestra.findMany({
    where: { externalId: { startsWith: prefix } },
    select: { externalId: true },
    take: 3,
    orderBy: { externalId: 'asc' },
  });
  return rows.map(row => row.externalId);
}

export async function agentSearch(query: string, organizationType: string): Promise<string> {
  const orgContext = getOrgContext(organizationType);

  const agent = createReactAgent({
    llm: createLLM(0.1),
    tools: [buscar_palestras],
  });

  const systemPrompt = `Você é um assessor inteligente da plataforma CAPACITE do Global Leadership Summit.
${orgContext}
Você tem acesso EXCLUSIVO às palestras e preletores retornados OBRIGATORIAMENTE pela ferramenta "buscar_palestras".
REGRA ABSOLUTA 1: Você DEVE usar a ferramenta "buscar_palestras" para encontrar informações antes de responder.
REGRA ABSOLUTA 2: Você JAMAIS deve inventar uma palestra se a ferramenta não retornou correspondência.
REGRA ABSOLUTA 3: Se nao ha dados retornados pela ferramenta, devolva um insight avisando que nao temos correspondencia no banco de dados de producao.

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
  return extrairJson(lastMessageContent);
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
5. As palestras selecionadas para a Trilha 1 DEVEM ser COMPLETAMENTE DIFERENTES das da Trilha 2. Nenhuma palestra pode se repetir entre as duas trilhas. Se precisar de mais opções, busque em outras categorias ou limite as trilhas a 2-3 palestras distintas.

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

    const raw = extrairJson(result.messages[result.messages.length - 1].content as string);
    const parsed = JSON.parse(raw);

    // Post-validation: filter only valid IDs as safety net
    if (parsed.trilha1?.palestraIds) {
      parsed.trilha1.palestraIds = await filterExistingPalestraIds(parsed.trilha1.palestraIds);
    }
    if (parsed.trilha2?.palestraIds) {
      parsed.trilha2.palestraIds = await filterExistingPalestraIds(parsed.trilha2.palestraIds);
    }

    return parsed;
  } catch (err) {
    console.error('[agentTrilhaSuggestions] Fallback triggered:', err);
    // Fallback determinístico
    const catPrefixes: Record<number, string> = { 1: 'lp', 2: 'pcc', 3: 'ci', 4: 'ede', 5: 'mir', 6: 'rse', 7: 'pvl' };
    const prefix1 = catPrefixes[priority1CategoryId] || 'lp';
    const prefix2 = priority2CategoryId ? catPrefixes[priority2CategoryId] || prefix1 : prefix1;
    const fb1 = await getFallbackPalestraIds(prefix1);
    const fb2 = await getFallbackPalestraIds(prefix2);
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

  // Devolutiva e texto/markdown (nao JSON puro): apenas remove as cercas.
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
  return extrairJson(content);
}
