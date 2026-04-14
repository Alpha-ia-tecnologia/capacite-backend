import { env } from '../config/env';
import { CATEGORIES, CategoryScore, getStrengthLevel } from '../lib/scoring';
import prisma from '../lib/prisma';

// Catálogo oficial — ÚNICA fonte de verdade para palestras e palestrantes
// Inclui TODAS as palestras cadastradas: temáticas (lp/pcc/ci/ede/mir/rse/pvl),
// base (p1-p21) e edições GLS 2017-2023 (gls17-gls23)
export const CATALOGO_OFICIAL = [
  // ═══ Temáticas (21) ═══
  { id: 'lp1', title: 'O Líder que se Conhece', speaker: 'Craig Groeschel', categoryIds: [1] },
  { id: 'lp2', title: 'Coragem para Liderar', speaker: 'Brené Brown', categoryIds: [1] },
  { id: 'lp3', title: 'Disciplina do Líder', speaker: 'Jocko Willink', categoryIds: [1] },
  { id: 'pcc1', title: 'Confiança é Construída', speaker: 'Brené Brown', categoryIds: [2] },
  { id: 'pcc2', title: 'Cultura Vence Estratégia', speaker: 'Sam Chand', categoryIds: [2] },
  { id: 'pcc3', title: 'O Poder da Vulnerabilidade', speaker: 'Patrick Lencioni', categoryIds: [2] },
  { id: 'ci1', title: 'A Arte de Comunicar', speaker: 'Andy Stanley', categoryIds: [3] },
  { id: 'ci2', title: 'Influência Autêntica', speaker: 'John Maxwell', categoryIds: [3] },
  { id: 'ci3', title: 'Conversas Corajosas', speaker: 'Susan Scott', categoryIds: [3] },
  { id: 'ede1', title: 'Foco Estratégico', speaker: 'Jim Collins', categoryIds: [4] },
  { id: 'ede2', title: 'Execução com Excelência', speaker: 'Chris McChesney', categoryIds: [4] },
  { id: 'ede3', title: 'Decisões que Transformam', speaker: 'Liz Wiseman', categoryIds: [4] },
  { id: 'mir1', title: 'Liderando Mudanças', speaker: 'John Kotter', categoryIds: [5] },
  { id: 'mir2', title: 'Mentalidade de Crescimento', speaker: 'Carol Dweck', categoryIds: [5] },
  { id: 'mir3', title: 'Inovação com Propósito', speaker: 'Beth Comstock', categoryIds: [5] },
  { id: 'rse1', title: 'Liderança Sustentável', speaker: 'Henry Cloud', categoryIds: [6] },
  { id: 'rse2', title: 'Saúde do Líder', speaker: 'Bill Hybels', categoryIds: [6] },
  { id: 'rse3', title: 'Resiliência em Tempos Difíceis', speaker: 'Sheryl Sandberg', categoryIds: [6] },
  { id: 'pvl1', title: 'Liderança com Propósito', speaker: 'Simon Sinek', categoryIds: [7] },
  { id: 'pvl2', title: 'Visão que Inspira', speaker: 'Andy Stanley', categoryIds: [7] },
  { id: 'pvl3', title: 'Legado que Transforma', speaker: 'Bob Goff', categoryIds: [7] },
  // ═══ Base p1-p21 ═══
  { id: 'p1', title: 'O Líder que se Conhece', speaker: 'Craig Groeschel', categoryIds: [1] },
  { id: 'p2', title: 'Liderança Sob Pressão', speaker: 'Patrick Lencioni', categoryIds: [1] },
  { id: 'p3', title: 'Prioridades que Não Mudam', speaker: 'Henry Cloud', categoryIds: [1] },
  { id: 'p4', title: 'Confiança é Construída', speaker: 'Brené Brown', categoryIds: [2] },
  { id: 'p5', title: 'Segurança Psicológica', speaker: 'Amy Edmondson', categoryIds: [2] },
  { id: 'p6', title: 'Cultura como Vantagem', speaker: 'Horst Schulze', categoryIds: [2] },
  { id: 'p7', title: 'A Arte de Comunicar', speaker: 'Andy Stanley', categoryIds: [3] },
  { id: 'p8', title: 'Conversas Difíceis', speaker: 'Sheila Heen', categoryIds: [3] },
  { id: 'p9', title: 'Reuniões que Decidem', speaker: 'Patrick Lencioni', categoryIds: [3] },
  { id: 'p10', title: 'Foco Estratégico', speaker: 'Jim Collins', categoryIds: [4] },
  { id: 'p11', title: 'Execução com Cadência', speaker: 'Chris McChesney', categoryIds: [4] },
  { id: 'p12', title: 'Papéis Claros, Times Fortes', speaker: 'Marcus Buckingham', categoryIds: [4] },
  { id: 'p13', title: 'Lidere a Mudança', speaker: 'John Maxwell', categoryIds: [5] },
  { id: 'p14', title: 'Inovar com Propósito', speaker: 'Beth Comstock', categoryIds: [5] },
  { id: 'p15', title: 'Aprendendo com Erros', speaker: 'Tim Elmore', categoryIds: [5] },
  { id: 'p16', title: 'Ritmo Sustentável', speaker: 'Craig Groeschel', categoryIds: [6] },
  { id: 'p17', title: 'Limites Saudáveis', speaker: 'Henry Cloud', categoryIds: [6] },
  { id: 'p18', title: 'Equipes que se Apoiam', speaker: 'Liz Wiseman', categoryIds: [6] },
  { id: 'p19', title: 'Propósito que Move', speaker: 'Simon Sinek', categoryIds: [7] },
  { id: 'p20', title: 'Visão Compartilhada', speaker: 'Bill Hybels', categoryIds: [7] },
  { id: 'p21', title: 'Valores Sob Pressão', speaker: 'Albert Tate', categoryIds: [7] },
  // ═══ GLS 2017-2018 ═══
  { id: 'gls17_1', title: 'O poder da paixão e da perseverança', speaker: 'Angela Duckworth', categoryIds: [6, 1] },
  { id: 'gls17_2', title: 'Liderança agora, responsabilidade social sempre!', speaker: 'Bryan Stevenson', categoryIds: [1, 7] },
  { id: 'gls17_3', title: 'Liderança criativa em um mundo de grandes transformações', speaker: 'Fredrik Haren', categoryIds: [5, 1] },
  { id: 'gls17_4', title: 'Não tema, lidere!', speaker: 'Gary Haugen', categoryIds: [1, 6] },
  { id: 'gls17_5', title: 'O perdão e o desenvolvimento emocional', speaker: 'Immaculée Ilibagiza', categoryIds: [6, 2] },
  { id: 'gls17_6', title: 'O "tempo ocioso" para a construção de soluções', speaker: 'Juliet Funt', categoryIds: [4, 6] },
  { id: 'gls17_7', title: 'Reinventando a gestão da performance', speaker: 'Marcus Buckingham', categoryIds: [4, 2] },
  { id: 'gls17_8', title: 'Liderando você mesmo', speaker: 'Sam Adayemi', categoryIds: [1, 7] },
  // ═══ GLS 2018-2019 ═══
  { id: 'gls18_1', title: 'O líder que as pessoas amam seguir', speaker: 'Craig Groeschel', categoryIds: [1, 2] },
  { id: 'gls18_2', title: 'Liderança preventiva', speaker: 'Craig Groeschel', categoryIds: [4, 1] },
  { id: 'gls18_3', title: 'Lições de liderança', speaker: 'Angela Ahrendts', categoryIds: [1, 7] },
  { id: 'gls18_4', title: 'Juntos somos melhores', speaker: 'Danielle Strickland', categoryIds: [2, 3] },
  { id: 'gls18_5', title: 'Inteligência Cultural', speaker: 'David Livermore', categoryIds: [2, 5] },
  { id: 'gls18_6', title: 'A última flecha: não pare até ter terminado', speaker: 'Erwin McManus', categoryIds: [7, 6] },
  { id: 'gls18_7', title: 'Ver mais e ver antes', speaker: 'John Maxwell', categoryIds: [4, 7] },
  { id: 'gls18_8', title: 'A vantagem da simplicidade', speaker: 'Juliet Funt', categoryIds: [4, 5] },
  { id: 'gls18_9', title: 'O difícil trabalho de impulsionar a visão', speaker: 'Nthabiseng Legoete', categoryIds: [7, 1] },
  { id: 'gls18_10', title: 'Como manter o sucesso', speaker: 'Rasmus Ankersen', categoryIds: [4, 5] },
  { id: 'gls18_11', title: 'Navegando em conversas difíceis', speaker: 'Sheila Heen', categoryIds: [3, 2] },
  { id: 'gls18_12', title: 'Filantropia e Inovação', speaker: 'Strive Masiyiwa', categoryIds: [7, 5] },
  { id: 'gls18_13', title: 'Planar!', speaker: 'TD Jakes', categoryIds: [1, 7] },
  { id: 'gls18_14', title: 'Comece pelo porquê', speaker: 'Simon Sinek', categoryIds: [7, 3] },
  // ═══ GLS 2019-2020 ═══
  { id: 'gls19_1', title: 'Um-a-um com Paula Faris', speaker: 'Chris Voss', categoryIds: [3, 1] },
  { id: 'gls19_2', title: 'Coração acima da Razão', speaker: 'Craig Groeschel', categoryIds: [1, 7] },
  { id: 'gls19_3', title: 'Endireite a Curva', speaker: 'Craig Groeschel', categoryIds: [4, 1] },
  { id: 'gls19_4', title: 'Conduzindo à mudança transformadora', speaker: 'Danielle Strickland', categoryIds: [5, 1] },
  { id: 'gls19_5', title: 'A sua diferença é o seu destino', speaker: 'DeVon Franklin', categoryIds: [7, 1] },
  { id: 'gls19_6', title: 'Revelando os Segredos das Gerações', speaker: 'Jason Dorsey', categoryIds: [2, 3] },
  { id: 'gls19_7', title: 'Sem Medo da Rejeição', speaker: 'Jia Jiang', categoryIds: [6, 5] },
  { id: 'gls19_8', title: 'Aumente o nível da sua liderança', speaker: 'Jo Saxton', categoryIds: [1, 4] },
  { id: 'gls19_9', title: 'Liderança VIP', speaker: 'Krish Kandiah', categoryIds: [2, 7] },
  { id: 'gls19_10', title: 'Coragem de Principiante', speaker: 'Liz Bohannon', categoryIds: [5, 1] },
  { id: 'gls19_11', title: 'Domesticando Tigres', speaker: 'Todd Henry', categoryIds: [4, 6] },
  // ═══ GLS 2020-2021 ═══
  { id: 'gls20_1', title: 'Liderança que atende ao momento', speaker: 'Albert Tate', categoryIds: [1, 7] },
  { id: 'gls20_2', title: 'Segurança psicológica', speaker: 'Amy Edmondson', categoryIds: [2, 3] },
  { id: 'gls20_3', title: 'Lidere durante o mergulho', speaker: 'Craig Groeschel', categoryIds: [1, 6] },
  { id: 'gls20_4', title: 'O obstáculo mais surpreendente à inovação', speaker: 'Lysa TerKeurst', categoryIds: [5, 1] },
  { id: 'gls20_5', title: 'Como os melhores líderes desenvolvem resiliência', speaker: 'Marcus Buckingham', categoryIds: [6, 1] },
  { id: 'gls20_6', title: 'O ritmo da liderança', speaker: 'Michael Todd', categoryIds: [1, 4] },
  { id: 'gls20_7', title: 'Seguro não é o suficiente', speaker: 'Nona Jones', categoryIds: [1, 2] },
  { id: 'gls20_8', title: 'Como liderar em um recomeço', speaker: 'Paula Faris', categoryIds: [5, 6] },
  { id: 'gls20_9', title: 'Os 6 traços da liderança', speaker: 'Tomas Chamorro-Premuzic', categoryIds: [3, 2] },
  { id: 'gls20_10', title: 'A ciência da liderança: impactando para o bem', speaker: 'Vanessa Van Edwards', categoryIds: [3, 2] },
  { id: 'gls20_11', title: 'Liderança amorosa – entrevista com Kaká', speaker: 'Kaká', categoryIds: [7, 2] },
  // ═══ GLS 2021-2022 ═══
  { id: 'gls21_1', title: 'Expandindo sua capacidade de liderança', speaker: 'Craig Groeschel', categoryIds: [1, 4] },
  { id: 'gls21_2', title: 'Talento rebelde', speaker: 'Francesca Gino', categoryIds: [5, 2] },
  { id: 'gls21_3', title: 'Um minuto para pensar', speaker: 'Juliet Funt', categoryIds: [4, 6] },
  { id: 'gls21_4', title: 'A Labuta da Liderança', speaker: 'Rich Wilkeson', categoryIds: [1, 6] },
  { id: 'gls21_5', title: 'Resiliência bilionária', speaker: 'Jamie Kern Lima', categoryIds: [6, 1] },
  { id: 'gls21_6', title: 'Exigir civilidade para liderar', speaker: 'Shola Richards', categoryIds: [2, 3] },
  { id: 'gls21_7', title: 'O Poder de Escolha do Líder', speaker: 'Ibukun Awosika', categoryIds: [1, 4] },
  { id: 'gls21_8', title: 'Olá, medo!', speaker: 'Michelle Poler', categoryIds: [6, 5] },
  { id: 'gls21_9', title: 'A escolha de liderar', speaker: 'Bianca Olthoff', categoryIds: [1, 7] },
  { id: 'gls21_10', title: 'Encontre o seu Ritmo', speaker: 'Albert Tate', categoryIds: [6, 1] },
  { id: 'gls21_11', title: 'Liderança Extraordinária: Um-a-um com A.R. Bernard', speaker: 'A.R. Bernard', categoryIds: [1, 7] },
  { id: 'gls21_12', title: 'Liderança e saúde mental', speaker: 'Henry Cloud', categoryIds: [6, 2] },
  { id: 'gls21_13', title: 'Dominando o risco', speaker: 'Stanley McChrystal', categoryIds: [4, 5] },
  { id: 'gls21_14', title: 'Colaboração, Criatividade e Convicção', speaker: 'Jerry Lorenzo', categoryIds: [5, 2] },
  // ═══ GLS 2022-2023 ═══
  { id: 'gls22_1', title: 'A viagem de uma vida', speaker: 'Bob Iger', categoryIds: [7, 1] },
  { id: 'gls22_2', title: 'Aprenda a liderar em uma nova realidade', speaker: 'Carey Nieuwhof', categoryIds: [5, 1] },
  { id: 'gls22_3', title: 'Liderança única', speaker: 'Craig Groeschel', categoryIds: [1, 4] },
  { id: 'gls22_4', title: 'Recupere seu poder', speaker: 'Deb Liu', categoryIds: [1, 6] },
  { id: 'gls22_5', title: 'O papel crítico da empatia na liderança', speaker: 'Johnny C. Taylor', categoryIds: [2, 3] },
  { id: 'gls22_6', title: 'Trilhas sonoras da mente', speaker: 'Jon Acuff', categoryIds: [6, 1] },
  { id: 'gls22_7', title: 'Liderando com a dor', speaker: 'Judah Smith', categoryIds: [6, 1] },
  { id: 'gls22_8', title: 'O coração por trás do In-N-Out Burger', speaker: 'Lynsi Snyder', categoryIds: [7, 2] },
  { id: 'gls22_9', title: 'Desbloqueando a mentalidade de start-up em sua organização', speaker: 'Sahar Hashemi', categoryIds: [5, 4] },
  { id: 'gls22_10', title: 'Adaptando sua liderança para os desafios de hoje', speaker: 'Stephanie Chung', categoryIds: [1, 5] },
  { id: 'gls22_11', title: 'Ciência da conexão', speaker: 'Vanessa Van Edwards', categoryIds: [3, 2] },
  // ═══ GLS 2023-2024 ═══
  { id: 'gls23_1', title: 'Lidere onde estiver', speaker: 'Albert Tate', categoryIds: [1, 7] },
  { id: 'gls23_2', title: 'Liderando em tempos difíceis', speaker: 'Albert Tate', categoryIds: [1, 6] },
  { id: 'gls23_3', title: 'Um sacrifício que vale a pena', speaker: 'Chris Mathebula', categoryIds: [7, 1] },
  { id: 'gls23_4', title: 'O futuro da liderança é a confiança', speaker: 'Craig Groeschel', categoryIds: [2, 1] },
  { id: 'gls23_5', title: 'Liderando The Chosen', speaker: 'Dallas Jenkins', categoryIds: [7, 5] },
  { id: 'gls23_6', title: 'Promovendo uma cultura de reinvenção', speaker: 'Erin Meyer', categoryIds: [5, 2] },
  { id: 'gls23_7', title: 'Mudança de mentalidade', speaker: 'Erwin McManus', categoryIds: [5, 1] },
  { id: 'gls23_8', title: 'Confiança', speaker: 'Henry Cloud', categoryIds: [2, 3] },
  { id: 'gls23_9', title: 'O que está aqui agora?', speaker: 'Jeanne Stevens', categoryIds: [1, 6] },
  { id: 'gls23_10', title: 'O paradoxo da esperança', speaker: 'Krish Kandiah', categoryIds: [7, 6] },
  { id: 'gls23_11', title: 'O topo é solitário, mas não precisa ser', speaker: 'Liz Bohannon', categoryIds: [2, 6] },
  { id: 'gls23_12', title: 'Construa seu MAP de carreira', speaker: 'Pat Gelsinger', categoryIds: [4, 7] },
  { id: 'gls23_13', title: 'Coragem nos tempos atuais', speaker: 'Patrick Lencioni', categoryIds: [1, 3] },
  { id: 'gls23_14', title: 'Aumentando o nível – 3 perguntas para líderes de outro nível', speaker: 'Ryan Leak', categoryIds: [4, 1] },
  // ═══ GLS 2024-2025 ═══
  { id: 'gls24_2', title: 'Mais feliz em um mundo infeliz', speaker: 'Arthur C. Brooks', categoryIds: [6, 1] },
  { id: 'gls24_3', title: 'Alcance de controle', speaker: 'Carey Lohrenz', categoryIds: [1, 4] },
  { id: 'gls24_4', title: 'Permissão para se obcecar', speaker: 'Craig Groeschel', categoryIds: [1, 4] },
  { id: 'gls24_5', title: 'Um legado de liderança', speaker: 'Dan Owolabi', categoryIds: [7, 1] },
  { id: 'gls24_6', title: 'A força oculta que pode destruir seu legado', speaker: 'David Ashcraft', categoryIds: [1, 7] },
  { id: 'gls24_7', title: '7 frequências da comunicação', speaker: 'Erwin McManus', categoryIds: [3, 1] },
  { id: 'gls24_8', title: 'Amplifique seu propósito para elevar seu impacto', speaker: 'Jo Saxton', categoryIds: [7, 1] },
  { id: 'gls24_9', title: 'O paradoxo de liderar a partir de sua fraqueza', speaker: 'Joni Eareckson', categoryIds: [1, 6] },
  { id: 'gls24_10', title: 'Aproveite o poder da história', speaker: 'Kindra Hall', categoryIds: [3, 2] },
  { id: 'gls24_11', title: 'Reputação: Como você quer ser lembrado como líder', speaker: 'Krish Kandiah', categoryIds: [7, 1] },
  { id: 'gls24_12', title: 'Liberte a força mais poderosa nos negócios', speaker: 'Marcus Buckingham', categoryIds: [2, 4] },
  { id: 'gls24_13', title: 'Engraçado como o conflito funciona', speaker: 'Michael Jr.', categoryIds: [3, 2] },
  { id: 'gls24_14', title: 'Vitória por meio do trabalho em equipe', speaker: 'Mike Krzyzewski', categoryIds: [2, 4] },
  { id: 'gls24_15', title: 'Impulso dinâmico', speaker: 'Molly Fletcher', categoryIds: [4, 5] },
  { id: 'gls24_16', title: 'Hospitalidade irracional', speaker: 'Will Guidara', categoryIds: [2, 7] },
  // ═══ GLS 2025-2026 ═══
  { id: 'gls25_1', title: 'A monotonia é o segredo do sucesso', speaker: 'Craig Groeschel', categoryIds: [1, 4] },
  { id: 'gls25_2', title: 'O excesso na liderança', speaker: 'Juliet Funt', categoryIds: [6, 4] },
  { id: 'gls25_3', title: 'Conexão humana na era digital', speaker: 'Erica Dhawan', categoryIds: [3, 2] },
  { id: 'gls25_4', title: 'Liderando no hífen', speaker: 'Gabriel Salguero', categoryIds: [1, 2] },
  { id: 'gls25_5', title: 'Entrevista com David Ashcraft', speaker: 'Thasunda Brown Duckett', categoryIds: [1, 7] },
  { id: 'gls25_6', title: 'Como prosperar quando só resiliência não basta', speaker: 'Tasha Eurich', categoryIds: [6, 1] },
  { id: 'gls25_7', title: 'Entre na roda', speaker: 'Bradley Rapier', categoryIds: [5, 2] },
  { id: 'gls25_8', title: 'Desempenho regenerativo', speaker: 'James Hewitt', categoryIds: [6, 4] },
  { id: 'gls25_9', title: 'Como liderar pessoas diferentes de você', speaker: 'Stephanie Chung', categoryIds: [2, 3] },
  { id: 'gls25_10', title: 'Deixando um legado que importa', speaker: 'John Maxwell', categoryIds: [7, 1] },
  { id: 'gls25_11', title: 'Uma visão que ancora', speaker: 'Christine Caine', categoryIds: [7, 6] },
  { id: 'gls25_12', title: 'À prova de procrastinação', speaker: 'Jon Acuff', categoryIds: [4, 1] },
  { id: 'gls25_13', title: 'Mude a sua pergunta', speaker: 'David Ashcraft', categoryIds: [5, 1] },
  { id: 'gls25_14', title: 'Em qual atividade você está?', speaker: 'David Ashcraft', categoryIds: [4, 1] },
  { id: 'gls25_15', title: 'Oportunidade acima do obstáculo', speaker: 'Khalil Halaseh', categoryIds: [5, 6] },
];

export const PALESTRANTES_VALIDOS = [...new Set(CATALOGO_OFICIAL.map(p => p.speaker))];
export const PALESTRA_IDS_VALIDOS = CATALOGO_OFICIAL.map(p => p.id);

function catalogoParaString(): string {
  return CATALOGO_OFICIAL
    .map(p => `- ID: ${p.id} | "${p.title}" | Palestrante: ${p.speaker} | Cat: ${JSON.stringify(p.categoryIds)}`)
    .join('\n');
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function chatCompletion(messages: ChatMessage[], temperature = 0.7): Promise<string> {
  const response = await fetch(`${env.DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content || '';
}

export function getOrgContext(organizationType: string): string {
  switch (organizationType) {
    case 'ESCOLA':
      return 'Use termos como alunos, professores, corpo docente, com foco em desenvolvimento acadêmico e pedagógico.';
    case 'IGREJA':
      return 'Use termos como membros, voluntários, congregação, com foco em missão, propósito espiritual e comunidade.';
    default:
      return 'Use termos como colaboradores, equipes, departamentos, com foco em produtividade e resultados.';
  }
}

export { agentDevolutiva as generateDevolutiva } from './langgraph.service';

export { agentTrilhaSuggestions as generateTrilhaSuggestions } from './langgraph.service';

interface TrilhaSuggestion {
  name: string;
  description: string;
  type: string;
  palestraIds: string[];
  reasoning: string;
}



export async function aiSearch(
  query: string,
  organizationType: string
): Promise<string> {
  const orgContext = getOrgContext(organizationType);
  const catalogStr = catalogoParaString();

  const palestrantes = PALESTRANTES_VALIDOS.join(', ');

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `Você é um assessor inteligente do Global Leadership Summit que ajuda a encontrar palestras relevantes.
${orgContext}
Você tem acesso a EXATAMENTE 21 palestras de 17 palestrantes. NÃO existe nenhum outro palestrante ou palestra além dos listados no catálogo.
REGRA ABSOLUTA: NUNCA mencione, sugira ou referencie palestrantes ou palestras que não estejam no catálogo oficial. Se não encontrar resultado relevante, diga que não há correspondência no catálogo.
Palestrantes válidos: ${palestrantes}
Se o cliente fizer perguntas fora do escopo de capacitação e liderança, redirecione educadamente para o contexto.
Responda em português brasileiro.
Responda APENAS com JSON válido, sem markdown.`,
    },
    {
      role: 'user',
      content: `O cliente busca: "${query}"

Retorne um JSON com resultados relevantes (mínimo 3, máximo 8 resultados):

{
  "results": [
    {
      "type": "palestra",
      "palestraId": "id exato do catálogo (ex: lp1, pcc2, ci3)",
      "title": "título EXATO da palestra conforme catálogo",
      "speaker": "palestrante EXATO conforme catálogo",
      "relevance": "por que é relevante (seja persuasivo)",
      "categoryName": "categoria principal"
    },
    {
      "type": "preletor",
      "title": "Nome EXATO do Palestrante do catálogo",
      "speaker": "Nome EXATO do Palestrante do catálogo",
      "relevance": "por que este preletor é referência neste tema",
      "categoryName": "sua área de expertise"
    },
    {
      "type": "insight",
      "title": "Título do Insight",
      "relevance": "insight prático baseado nas palestras do catálogo",
      "categoryName": "área de aplicação"
    }
  ],
  "suggestion": "sugestão de busca complementar"
}

REGRAS:
- "palestra": OBRIGATÓRIO incluir pelo menos 2 — use APENAS IDs e dados EXATOS do catálogo
- "preletor": use APENAS palestrantes do catálogo: ${palestrantes}
- "insight": reflexão baseada no conteúdo das palestras do catálogo
- NUNCA invente palestrantes, palestras ou IDs que não estejam no catálogo abaixo

Catálogo OFICIAL COMPLETO (esta é a ÚNICA fonte de verdade):
${catalogStr}`,
    },
  ];

  return chatCompletion(messages, 0.5);
}

export { agentQuestions as generatePalestraQuestions } from './langgraph.service';
