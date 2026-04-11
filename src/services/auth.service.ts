import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import prisma from '../lib/prisma';

interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  organization: string;
  organizationType: 'EMPRESA' | 'ESCOLA' | 'IGREJA';
  role?: string;
  location?: string;
}

interface LoginData {
  email: string;
  password: string;
}

function generateToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as string,
  } as jwt.SignOptions);
}

export async function register(data: RegisterData) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new Error('E-mail já cadastrado');
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      phone: data.phone,
      organization: data.organization,
      organizationType: data.organizationType,
      role: data.role,
      location: data.location,
    },
    select: {
      id: true,
      name: true,
      email: true,
      organization: true,
      organizationType: true,
      role: true,
      isAdmin: true,
      createdAt: true,
    },
  });

  const token = generateToken(user.id, user.email);

  return { user, token };
}

export async function login(data: LoginData) {
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    throw new Error('E-mail ou senha inválidos');
  }

  const validPassword = await bcrypt.compare(data.password, user.passwordHash);
  if (!validPassword) {
    throw new Error('E-mail ou senha inválidos');
  }

  // Update streak
  const now = new Date();
  const lastActive = user.lastActiveDate;
  let streakDays = user.streakDays;

  if (lastActive) {
    const diffDays = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      streakDays += 1;
    } else if (diffDays > 1) {
      streakDays = 1;
    }
    // diffDays === 0 means same day, keep streak
  } else {
    streakDays = 1;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveDate: now, streakDays },
  });

  const token = generateToken(user.id, user.email);

  const { passwordHash: _, ...userWithoutPassword } = user;

  return {
    user: { ...userWithoutPassword, streakDays },
    token,
  };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      organization: true,
      organizationType: true,
      role: true,
      location: true,
      avatarUrl: true,
      isAdmin: true,
      streakDays: true,
      lastActiveDate: true,
      createdAt: true,
      goldStars: {
        select: { type: true, earnedAt: true },
      },
      _count: {
        select: {
          diagnosticos: true,
          trilhas: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  return user;
}

export async function updateProfile(
  userId: string,
  data: { name?: string; phone?: string; role?: string; location?: string; avatarUrl?: string }
) {
  return prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      organization: true,
      organizationType: true,
      role: true,
      location: true,
      avatarUrl: true,
      isAdmin: true,
      streakDays: true,
      createdAt: true,
    },
  });
}
