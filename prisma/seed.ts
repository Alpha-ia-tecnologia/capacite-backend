import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@capacite.com' },
    update: {},
    create: {
      name: 'Administrador CAPACITE',
      email: 'admin@capacite.com',
      passwordHash: adminPassword,
      organization: 'CAPACITE',
      organizationType: 'EMPRESA',
      role: 'Administrador',
      isAdmin: true,
    },
  });
  console.log(`Admin user created: ${admin.email}`);

  // Create demo user
  const demoPassword = await bcrypt.hash('demo123', 12);
  const demo = await prisma.user.upsert({
    where: { email: 'demo@empresa.com' },
    update: {},
    create: {
      name: 'Usuário Demo',
      email: 'demo@empresa.com',
      passwordHash: demoPassword,
      organization: 'Empresa Demo',
      organizationType: 'EMPRESA',
      role: 'Gerente',
      location: 'São Paulo, SP',
    },
  });
  console.log(`Demo user created: ${demo.email}`);

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
