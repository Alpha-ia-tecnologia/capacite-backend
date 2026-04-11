import prisma from '../lib/prisma';
import { checkAndAwardStars } from './gamificacao.service';

interface CreateTrilhaData {
  userId: string;
  diagnosticoId?: string;
  name: string;
  description?: string;
  type: 'IMPACTO' | 'APROFUNDAMENTO' | 'CUSTOM';
  palestraIds: string[];
}

export async function createTrilha(data: CreateTrilhaData) {
  // Prevent duplicates: check if a trilha with the same name + type already exists for this user
  const existing = await prisma.trilha.findFirst({
    where: {
      userId: data.userId,
      name: data.name,
      type: data.type,
    },
  });

  if (existing) {
    // Return the existing trilha instead of creating a duplicate
    return existing;
  }

  const trilha = await prisma.trilha.create({
    data: {
      userId: data.userId,
      diagnosticoId: data.diagnosticoId,
      name: data.name,
      description: data.description,
      type: data.type,
      palestraIds: data.palestraIds,
    },
  });

  // Create progress entries for each palestra
  await prisma.trilhaProgress.createMany({
    data: data.palestraIds.map((palestraId) => ({
      trilhaId: trilha.id,
      userId: data.userId,
      palestraId,
      watched: false,
    })),
  });

  return trilha;
}

export async function getUserTrilhas(userId: string) {
  const trilhas = await prisma.trilha.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' }, // oldest first so we keep originals
    include: {
      progress: {
        select: {
          palestraId: true,
          watched: true,
          watchedAt: true,
        },
      },
    },
  });

  // Deduplicate: keep the first (oldest) trilha per name+type, delete the rest
  const seen = new Map<string, typeof trilhas[0]>();
  const duplicateIds: string[] = [];

  for (const trilha of trilhas) {
    const key = `${trilha.name}::${trilha.type}`;
    if (seen.has(key)) {
      duplicateIds.push(trilha.id);
    } else {
      seen.set(key, trilha);
    }
  }

  // Silently remove duplicates from DB
  if (duplicateIds.length > 0) {
    await prisma.trilhaProgress.deleteMany({
      where: { trilhaId: { in: duplicateIds } },
    });
    await prisma.trilha.deleteMany({
      where: { id: { in: duplicateIds } },
    });
  }

  const uniqueTrilhas = [...seen.values()];

  return uniqueTrilhas.map((trilha) => {
    const totalPalestras = (trilha.palestraIds as string[]).length;
    const watchedCount = trilha.progress.filter((p) => p.watched).length;

    return {
      ...trilha,
      totalPalestras,
      watchedCount,
      progressPercent: totalPalestras > 0 ? Math.round((watchedCount / totalPalestras) * 100) : 0,
      isComplete: watchedCount === totalPalestras && totalPalestras > 0,
    };
  });
}

export async function getTrilhaById(trilhaId: string, userId: string) {
  const trilha = await prisma.trilha.findFirst({
    where: { id: trilhaId, userId },
    include: {
      progress: true,
      diagnostico: {
        select: { id: true, createdAt: true },
      },
    },
  });

  if (!trilha) {
    throw new Error('Trilha não encontrada');
  }

  const totalPalestras = (trilha.palestraIds as string[]).length;
  const watchedCount = trilha.progress.filter((p) => p.watched).length;

  return {
    ...trilha,
    totalPalestras,
    watchedCount,
    progressPercent: totalPalestras > 0 ? Math.round((watchedCount / totalPalestras) * 100) : 0,
    isComplete: watchedCount === totalPalestras && totalPalestras > 0,
  };
}

export async function markPalestraWatched(
  trilhaId: string,
  palestraId: string,
  userId: string,
  watched: boolean
) {
  const progress = await prisma.trilhaProgress.upsert({
    where: {
      trilhaId_palestraId: { trilhaId, palestraId },
    },
    update: {
      watched,
      watchedAt: watched ? new Date() : null,
    },
    create: {
      trilhaId,
      userId,
      palestraId,
      watched,
      watchedAt: watched ? new Date() : null,
    },
  });

  // Check for gamification milestones
  await checkAndAwardStars(userId);

  return progress;
}

export async function deleteTrilha(trilhaId: string, userId: string) {
  const trilha = await prisma.trilha.findFirst({
    where: { id: trilhaId, userId },
  });

  if (!trilha) {
    throw new Error('Trilha não encontrada');
  }

  await prisma.trilha.delete({ where: { id: trilhaId } });

  return { success: true };
}
