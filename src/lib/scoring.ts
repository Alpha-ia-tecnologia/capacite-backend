/**
 * Diagnostic scoring logic for CAPACITE
 *
 * 7 Categories, 3 questions each (21 total)
 * Scale: 1-4 (Nunca, Às vezes, Frequentemente, Sempre)
 * Score per category: sum of 3 answers (range 3-12)
 * Gap: 12 - score (higher gap = higher need)
 */

export const CATEGORIES = [
  { id: 1, name: 'Liderança Pessoal', questionIds: [1, 2, 3] },
  { id: 2, name: 'Pessoas, Cultura e Confiança', questionIds: [4, 5, 6] },
  { id: 3, name: 'Comunicação e Influência', questionIds: [7, 8, 9] },
  { id: 4, name: 'Estratégia, Decisões e Execução', questionIds: [10, 11, 12] },
  { id: 5, name: 'Mudança, Inovação e Reinvenção', questionIds: [13, 14, 15] },
  { id: 6, name: 'Resiliência, Saúde Emocional e Bem-estar', questionIds: [16, 17, 18] },
  { id: 7, name: 'Propósito, Visão, Legado e Impacto', questionIds: [19, 20, 21] },
];

export const QUESTIONS = [
  { id: 1, categoryId: 1, text: 'Há direção estável: prioridades não mudam toda semana.' },
  { id: 2, categoryId: 1, text: 'A liderança é coerente (fala e prática combinam).' },
  { id: 3, categoryId: 1, text: 'Sob pressão, a liderança mantém clareza e equilíbrio (não gera caos).' },
  { id: 4, categoryId: 2, text: 'Há confiança: baixa política interna e baixa defensividade.' },
  { id: 5, categoryId: 2, text: 'Existe segurança para discordar e trazer problemas sem medo.' },
  { id: 6, categoryId: 2, text: 'A equipe trata as pessoas com respeito mesmo em tensões.' },
  { id: 7, categoryId: 3, text: 'Informações importantes chegam com clareza e no tempo certo.' },
  { id: 8, categoryId: 3, text: 'Conversas difíceis acontecem com respeito (sem silêncio e sem fofoca).' },
  { id: 9, categoryId: 3, text: 'Reuniões viram decisões e combinados claros.' },
  { id: 10, categoryId: 4, text: 'Existe foco claro (o que é prioridade agora).' },
  { id: 11, categoryId: 4, text: 'Papéis e responsabilidades são claros.' },
  { id: 12, categoryId: 4, text: 'O que se decide vira ação com acompanhamento e cadência.' },
  { id: 13, categoryId: 5, text: 'Mudanças são conduzidas com organização (não viram bagunça prolongada).' },
  { id: 14, categoryId: 5, text: 'A equipe aprende com erros e ajusta rápido (sem caça às bruxas).' },
  { id: 15, categoryId: 5, text: 'Há espaço para testar melhorias com critério (inovar com propósito).' },
  { id: 16, categoryId: 6, text: 'O ritmo é sustentável (há margem para respirar e recuperar).' },
  { id: 17, categoryId: 6, text: 'Limites são respeitados (urgência não é regra).' },
  { id: 18, categoryId: 6, text: 'Em semanas difíceis, a equipe se apoia (não vira "cada um por si").' },
  { id: 19, categoryId: 7, text: 'O time sabe por que o trabalho importa (propósito é claro).' },
  { id: 20, categoryId: 7, text: 'Existe visão compartilhada que orienta escolhas.' },
  { id: 21, categoryId: 7, text: 'Valores são praticados especialmente sob pressão.' },
];

export interface CategoryScore {
  categoryId: number;
  categoryName: string;
  score: number;
  gap: number;
}

export interface DiagnosticoResult {
  categoryScores: Record<string, number>;
  categoryGaps: Record<string, number>;
  priority1: number;
  priority2: number | null;
  ranking: CategoryScore[];
}

export function calculateDiagnostico(answers: Record<string, number>): DiagnosticoResult {
  const scores: CategoryScore[] = CATEGORIES.map((cat) => {
    const score = cat.questionIds.reduce((sum, qId) => {
      const answer = answers[`q${qId}`] ?? answers[String(qId)] ?? 0;
      return sum + answer;
    }, 0);

    return {
      categoryId: cat.id,
      categoryName: cat.name,
      score,
      gap: 12 - score,
    };
  });

  // Sort by gap descending (highest need first)
  const ranking = [...scores].sort((a, b) => b.gap - a.gap);

  const priority1 = ranking[0].categoryId;

  // Priority 2: only if within 1 point of priority 1's gap
  let priority2: number | null = null;
  if (ranking.length > 1 && ranking[0].gap - ranking[1].gap <= 1) {
    priority2 = ranking[1].categoryId;
  }

  const categoryScores: Record<string, number> = {};
  const categoryGaps: Record<string, number> = {};

  scores.forEach((s) => {
    categoryScores[String(s.categoryId)] = s.score;
    categoryGaps[String(s.categoryId)] = s.gap;
  });

  return {
    categoryScores,
    categoryGaps,
    priority1,
    priority2,
    ranking,
  };
}

export function getStrengthLevel(score: number): 'forte' | 'moderado' | 'fraco' {
  if (score >= 10) return 'forte';
  if (score >= 7) return 'moderado';
  return 'fraco';
}
