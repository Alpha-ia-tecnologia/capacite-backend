import { PrismaClient } from '@prisma/client';
import { getUserTrilhas, createTrilha } from './src/services/trilhas.service';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  
  // 1. Create a trilha
  console.log("Creating trilha...");
  const t1 = await createTrilha({
    userId: user.id,
    name: "Test Trilha 1",
    type: "IMPACTO",
    palestraIds: ["p1", "p2"]
  });
  console.log("Created T1:", t1.id);
  
  const inDb1 = await prisma.trilha.findMany({ where: { userId: user.id } });
  console.log("Total in DB after 1:", inDb1.length);
  
  const get1 = await getUserTrilhas(user.id);
  console.log("getUserTrilhas returns:", get1.length);
  
  const inDbAfter = await prisma.trilha.findMany({ where: { userId: user.id } });
  console.log("Total in DB after getUserTrilhas:", inDbAfter.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
