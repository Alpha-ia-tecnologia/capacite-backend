import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seeds the 21 GLS palestras into the database.
 * Run with: npx tsx prisma/seed-palestras.ts
 */

const PALESTRAS = [
  // Liderança Pessoal
  { externalId: 'p1', title: 'O Líder que se Conhece', speaker: 'Craig Groeschel', description: 'Como a autoconsciência transforma a liderança e gera confiança no time.', duration: '28 min', categoryIds: ['lideranca-pessoal'], year: 2023 },
  { externalId: 'p2', title: 'Liderança Sob Pressão', speaker: 'Patrick Lencioni', description: 'Manter clareza e equilíbrio quando tudo parece desmoronar.', duration: '32 min', categoryIds: ['lideranca-pessoal'], year: 2023 },
  { externalId: 'p3', title: 'Prioridades que Não Mudam', speaker: 'Henry Cloud', description: 'Construindo consistência e direção estável na liderança.', duration: '25 min', categoryIds: ['lideranca-pessoal'], year: 2022 },

  // Pessoas, Cultura e Confiança
  { externalId: 'p4', title: 'Confiança é Construída', speaker: 'Brené Brown', description: 'Os pilares da confiança e como eliminá-la destrói equipes.', duration: '35 min', categoryIds: ['pessoas-cultura-confianca'], year: 2023 },
  { externalId: 'p5', title: 'Segurança Psicológica', speaker: 'Amy Edmondson', description: 'Criar um ambiente onde é seguro discordar e aprender com erros.', duration: '30 min', categoryIds: ['pessoas-cultura-confianca'], year: 2022 },
  { externalId: 'p6', title: 'Cultura como Vantagem', speaker: 'Horst Schulze', description: 'Respeito e excelência como base de uma cultura forte.', duration: '27 min', categoryIds: ['pessoas-cultura-confianca'], year: 2023 },

  // Comunicação e Influência
  { externalId: 'p7', title: 'A Arte de Comunicar', speaker: 'Andy Stanley', description: 'Comunicação clara que inspira ação e alinhamento.', duration: '30 min', categoryIds: ['comunicacao-influencia'], year: 2023 },
  { externalId: 'p8', title: 'Conversas Difíceis', speaker: 'Sheila Heen', description: 'Como abordar conflitos com respeito e chegar a resoluções.', duration: '33 min', categoryIds: ['comunicacao-influencia'], year: 2022 },
  { externalId: 'p9', title: 'Reuniões que Decidem', speaker: 'Patrick Lencioni', description: 'Transformar reuniões em momentos de decisão e ação.', duration: '28 min', categoryIds: ['comunicacao-influencia'], year: 2023 },

  // Estratégia, Decisões e Execução
  { externalId: 'p10', title: 'Foco Estratégico', speaker: 'Jim Collins', description: 'A disciplina de dizer não para manter o foco no que importa.', duration: '35 min', categoryIds: ['estrategia-decisoes-execucao'], year: 2023 },
  { externalId: 'p11', title: 'Execução com Cadência', speaker: 'Chris McChesney', description: 'As 4 disciplinas da execução: foco, alavancas, placar e cadência.', duration: '30 min', categoryIds: ['estrategia-decisoes-execucao'], year: 2022 },
  { externalId: 'p12', title: 'Papéis Claros, Times Fortes', speaker: 'Marcus Buckingham', description: 'Clareza de papéis e responsabilidades como base de alta performance.', duration: '27 min', categoryIds: ['estrategia-decisoes-execucao'], year: 2023 },

  // Mudança, Inovação e Reinvenção
  { externalId: 'p13', title: 'Lidere a Mudança', speaker: 'John Maxwell', description: 'Como conduzir transições sem perder o time no caminho.', duration: '32 min', categoryIds: ['mudanca-inovacao-reinvencao'], year: 2023 },
  { externalId: 'p14', title: 'Inovar com Propósito', speaker: 'Beth Comstock', description: 'Criatividade e experimentação com critério dentro de organizações.', duration: '28 min', categoryIds: ['mudanca-inovacao-reinvencao'], year: 2022 },
  { externalId: 'p15', title: 'Aprendendo com Erros', speaker: 'Tim Elmore', description: 'Eliminar a caça às bruxas e criar cultura de aprendizado rápido.', duration: '25 min', categoryIds: ['mudanca-inovacao-reinvencao'], year: 2023 },

  // Resiliência, Saúde Emocional e Bem-estar
  { externalId: 'p16', title: 'Ritmo Sustentável', speaker: 'Craig Groeschel', description: 'Liderar em um ritmo que permite respirar e recuperar.', duration: '30 min', categoryIds: ['resiliencia-saude-bemestar'], year: 2023 },
  { externalId: 'p17', title: 'Limites Saudáveis', speaker: 'Henry Cloud', description: 'Urgência como regra destrói equipes: como estabelecer limites.', duration: '28 min', categoryIds: ['resiliencia-saude-bemestar'], year: 2022 },
  { externalId: 'p18', title: 'Equipes que se Apoiam', speaker: 'Liz Wiseman', description: 'Em semanas difíceis, apoio mútuo faz toda a diferença.', duration: '26 min', categoryIds: ['resiliencia-saude-bemestar'], year: 2023 },

  // Propósito, Visão, Legado e Impacto
  { externalId: 'p19', title: 'Propósito que Move', speaker: 'Simon Sinek', description: 'Quando o time sabe por que o trabalho importa, tudo muda.', duration: '33 min', categoryIds: ['proposito-visao-legado'], year: 2023 },
  { externalId: 'p20', title: 'Visão Compartilhada', speaker: 'Bill Hybels', description: 'Criar uma visão que orienta escolhas e une pessoas.', duration: '30 min', categoryIds: ['proposito-visao-legado'], year: 2022 },
  { externalId: 'p21', title: 'Valores Sob Pressão', speaker: 'Albert Tate', description: 'Os valores só são reais quando testados nos momentos difíceis.', duration: '27 min', categoryIds: ['proposito-visao-legado'], year: 2023 },
];

async function main() {
  console.log('Seeding 21 palestras...');

  for (const p of PALESTRAS) {
    await prisma.palestra.upsert({
      where: { externalId: p.externalId },
      update: {
        title: p.title,
        speaker: p.speaker,
        description: p.description,
        duration: p.duration,
        categoryIds: p.categoryIds,
        year: p.year,
      },
      create: {
        externalId: p.externalId,
        title: p.title,
        speaker: p.speaker,
        description: p.description,
        duration: p.duration,
        categoryIds: p.categoryIds,
        year: p.year,
      },
    });
    console.log(`  ✓ ${p.externalId}: ${p.title}`);
  }

  console.log('Palestras seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
