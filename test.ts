import { PrismaClient } from '@prisma/client';
import { getUserTrilhas } from './src/services/trilhas.service';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log("No users found");
    return;
  }
  
  console.log("Testing for user:", user.email);
  
  const trilhas = await prisma.trilha.findMany({ where: { userId: user.id } });
  console.log("Raw Trilhas in DB:", trilhas.length);
  trilhas.forEach(t => console.log(`- ID: ${t.id}, Name: ${t.name}, Type: ${t.type}`));
  
  const result = await getUserTrilhas(user.id);
  console.log("Result from getUserTrilhas:", result.length);
  result.forEach(t => console.log(`- Name: ${t.name}, Progress:`, t.progress));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
