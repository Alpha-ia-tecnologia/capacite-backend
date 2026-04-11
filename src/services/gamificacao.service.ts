import prisma from '../lib/prisma';

type GoldStarType =
  | 'DIAGNOSTICO_COMPLETO'
  | 'PRIMEIRA_PALESTRA'
  | 'TRILHA_COMPLETA'
  | 'DIAGNOSTICO_6MESES'
  | 'TRES_TRILHAS';

export async function getUserGoldStars(userId: string) {
  return prisma.goldStar.findMany({
    where: { userId },
    orderBy: { earnedAt: 'asc' },
  });
}

export async function awardGoldStar(userId: string, type: GoldStarType) {
  // Check if already earned
  const existing = await prisma.goldStar.findUnique({
    where: { userId_type: { userId, type } },
  });

  if (existing) {
    return null; // Already earned
  }

  return prisma.goldStar.create({
    data: { userId, type },
  });
}

export async function checkAndAwardStars(userId: string) {
  const awarded: GoldStarType[] = [];

  // 1. DIAGNOSTICO_COMPLETO - Has at least one diagnostico
  const diagnosticoCount = await prisma.diagnostico.count({ where: { userId } });
  if (diagnosticoCount >= 1) {
    const star = await awardGoldStar(userId, 'DIAGNOSTICO_COMPLETO');
    if (star) awarded.push('DIAGNOSTICO_COMPLETO');
  }

  // 2. PRIMEIRA_PALESTRA - Has watched at least one palestra
  const watchedCount = await prisma.trilhaProgress.count({
    where: { userId, watched: true },
  });
  if (watchedCount >= 1) {
    const star = await awardGoldStar(userId, 'PRIMEIRA_PALESTRA');
    if (star) awarded.push('PRIMEIRA_PALESTRA');
  }

  // 3. TRILHA_COMPLETA - Has completed at least one trilha
  const trilhas = await prisma.trilha.findMany({
    where: { userId },
    include: { progress: true },
  });

  const completedTrilhas = trilhas.filter((trilha) => {
    const total = (trilha.palestraIds as string[]).length;
    const watched = trilha.progress.filter((p) => p.watched).length;
    return total > 0 && watched === total;
  });

  if (completedTrilhas.length >= 1) {
    const star = await awardGoldStar(userId, 'TRILHA_COMPLETA');
    if (star) awarded.push('TRILHA_COMPLETA');
  }

  // 4. DIAGNOSTICO_6MESES - Has a diagnostico older than 6 months AND a newer one
  if (diagnosticoCount >= 2) {
    const diagnosticos = await prisma.diagnostico.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });

    const first = diagnosticos[0].createdAt;
    const last = diagnosticos[diagnosticos.length - 1].createdAt;
    const sixMonthsMs = 6 * 30 * 24 * 60 * 60 * 1000;

    if (last.getTime() - first.getTime() >= sixMonthsMs) {
      const star = await awardGoldStar(userId, 'DIAGNOSTICO_6MESES');
      if (star) awarded.push('DIAGNOSTICO_6MESES');
    }
  }

  // 5. TRES_TRILHAS - Has completed 3 different trilhas
  if (completedTrilhas.length >= 3) {
    const star = await awardGoldStar(userId, 'TRES_TRILHAS');
    if (star) awarded.push('TRES_TRILHAS');
  }

  return awarded;
}

export async function getGamificacaoSummary(userId: string) {
  const [goldStars, user, trilhas, watchedTotal] = await Promise.all([
    prisma.goldStar.findMany({ where: { userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { streakDays: true, lastActiveDate: true },
    }),
    prisma.trilha.findMany({
      where: { userId },
      include: { progress: true },
    }),
    prisma.trilhaProgress.count({ where: { userId, watched: true } }),
  ]);

  const completedTrilhas = trilhas.filter((trilha) => {
    const total = (trilha.palestraIds as string[]).length;
    const watched = trilha.progress.filter((p) => p.watched).length;
    return total > 0 && watched === total;
  });

  return {
    goldStars: goldStars.map((s) => ({ type: s.type, earnedAt: s.earnedAt })),
    totalStars: goldStars.length,
    streakDays: user?.streakDays || 0,
    lastActiveDate: user?.lastActiveDate,
    totalPalestrasAssistidas: watchedTotal,
    totalTrilhasCompletas: completedTrilhas.length,
    totalTrilhas: trilhas.length,
  };
}

export async function updateStreak(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streakDays: true, lastActiveDate: true },
  });

  if (!user) return;

  const now = new Date();
  const lastActive = user.lastActiveDate;
  let streakDays = user.streakDays;

  if (lastActive) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastDay = new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate());
    const diffDays = Math.floor((today.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      streakDays += 1;
    } else if (diffDays > 1) {
      streakDays = 1;
    }
    // Same day: keep streak
  } else {
    streakDays = 1;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveDate: now, streakDays },
  });

  return streakDays;
}
