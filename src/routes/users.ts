import { Router, Response } from 'express';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';

const router = Router();

// All routes require authentication + admin
router.use(authenticate);
router.use(requireAdmin);

import bcrypt from 'bcryptjs';

// POST /api/users - Create new user (admin)
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, organization, organizationType, role, phone } = req.body;

    // Check if email exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ error: 'E-mail já cadastrado' });
      return;
    }

    const passwordHash = await bcrypt.hash(password || 'capacite2025', 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        organization: organization || 'N/A',
        organizationType: (organizationType ? organizationType.toUpperCase() : 'EMPRESA') as 'EMPRESA' | 'ESCOLA' | 'IGREJA',
        role,
        phone,
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

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

// GET /api/users - List all users (admin)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { search, sort = 'createdAt', order = 'desc', page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where = search
      ? {
          OR: [
            { name: { contains: search as string, mode: 'insensitive' as const } },
            { email: { contains: search as string, mode: 'insensitive' as const } },
            { organization: { contains: search as string, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          organization: true,
          organizationType: true,
          role: true,
          isAdmin: true,
          streakDays: true,
          lastActiveDate: true,
          createdAt: true,
          _count: {
            select: { diagnosticos: true, trilhas: true, goldStars: true },
          },
        },
        orderBy: { [sort as string]: order },
        skip,
        take: limitNum,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

// GET /api/users/:id - Get user details (admin)
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id as string },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        organization: true,
        organizationType: true,
        role: true,
        location: true,
        isAdmin: true,
        streakDays: true,
        lastActiveDate: true,
        createdAt: true,
        diagnosticos: {
          select: {
            id: true,
            priority1Category: true,
            priority2Category: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        trilhas: {
          select: {
            id: true,
            name: true,
            type: true,
            createdAt: true,
          },
        },
        goldStars: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

// PATCH /api/users/:id - Update user (admin)
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, role, isAdmin } = req.body;

    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data: {
        ...(name !== undefined && { name }),
        ...(role !== undefined && { role }),
        ...(isAdmin !== undefined && { isAdmin }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isAdmin: true,
      },
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// DELETE /api/users/:id - Delete user (admin)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    // Prevent self-deletion
    if (req.params.id as string === req.user!.id) {
      res.status(400).json({ error: 'Você não pode excluir sua própria conta' });
      return;
    }

    await prisma.user.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir usuário' });
  }
});

export default router;
