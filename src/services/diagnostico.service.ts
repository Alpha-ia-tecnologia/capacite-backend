import prisma from '../lib/prisma';
import { calculateDiagnostico } from '../lib/scoring';
import { generateDevolutiva, generateTrilhaSuggestions } from './deepseek.service';
import { checkAndAwardStars } from './gamificacao.service';

interface CreateDiagnosticoData {
  userId: string;
  answers: Record<string, number>;
  organizationType: string;
  organizationName: string;
}

export async function createDiagnostico(data: CreateDiagnosticoData) {
  const { userId, answers, organizationType, organizationName } = data;

  // Calculate scores
  const result = calculateDiagnostico(answers);

  // Generate AI devolutiva
  let devolutiva: string | null = null;
  try {
    devolutiva = await generateDevolutiva(result.ranking, organizationType, organizationName);
  } catch (error) {
    console.error('Failed to generate devolutiva:', error);
  }

  // Generate trilha suggestions
  let suggestedTrilhas: object | undefined = undefined;
  try {
    suggestedTrilhas = await generateTrilhaSuggestions(
      result.priority1,
      result.priority2,
      organizationType
    );
  } catch (error) {
    console.error('Failed to generate trilha suggestions:', error);
  }

  // Save to database
  const diagnostico = await prisma.diagnostico.create({
    data: {
      userId,
      answers,
      categoryScores: result.categoryScores,
      categoryGaps: result.categoryGaps,
      priority1Category: result.priority1,
      priority2Category: result.priority2,
      devolutiva,
      suggestedTrilhas,
    },
  });

  // Award gold star for completing diagnostic
  await checkAndAwardStars(userId);

  return {
    ...diagnostico,
    ranking: result.ranking,
  };
}

export async function getDiagnosticoById(diagnosticoId: string, userId: string) {
  const diagnostico = await prisma.diagnostico.findFirst({
    where: { id: diagnosticoId, userId },
    include: {
      trilhas: true,
      complementaryFiles: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          size: true,
          uploadedAt: true,
        },
      },
    },
  });

  if (!diagnostico) {
    throw new Error('Diagnóstico não encontrado');
  }

  return diagnostico;
}

export async function getUserDiagnosticos(userId: string) {
  return prisma.diagnostico.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      categoryScores: true,
      categoryGaps: true,
      priority1Category: true,
      priority2Category: true,
      devolutiva: true,
      suggestedTrilhas: true,
      createdAt: true,
      _count: {
        select: { trilhas: true },
      },
    },
  });
}

export async function getLatestDiagnostico(userId: string) {
  return prisma.diagnostico.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      trilhas: true,
    },
  });
}

export async function compareDiagnosticos(userId: string) {
  const diagnosticos = await prisma.diagnostico.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      categoryScores: true,
      categoryGaps: true,
      priority1Category: true,
      priority2Category: true,
      createdAt: true,
    },
  });

  if (diagnosticos.length < 2) {
    return { comparisons: null, message: 'É necessário ter pelo menos 2 diagnósticos para comparação.' };
  }

  const oldest = diagnosticos[0];
  const newest = diagnosticos[diagnosticos.length - 1];

  const oldScores = oldest.categoryScores as Record<string, number>;
  const newScores = newest.categoryScores as Record<string, number>;

  const evolution: Record<string, { before: number; after: number; change: number }> = {};

  for (const catId of Object.keys(newScores)) {
    evolution[catId] = {
      before: oldScores[catId] || 0,
      after: newScores[catId] || 0,
      change: (newScores[catId] || 0) - (oldScores[catId] || 0),
    };
  }

  return {
    oldest: { id: oldest.id, date: oldest.createdAt },
    newest: { id: newest.id, date: newest.createdAt },
    evolution,
    totalDiagnosticos: diagnosticos.length,
  };
}
