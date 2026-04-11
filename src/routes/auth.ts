import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate, AuthRequest } from '../middleware/auth';
import * as authService from '../services/auth.service';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  phone: z.string().optional(),
  organization: z.string().min(2, 'Nome da organização é obrigatório'),
  organizationType: z.enum(['EMPRESA', 'ESCOLA', 'IGREJA']),
  role: z.string().optional(),
  location: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  role: z.string().optional(),
  location: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao registrar';
    const status = message === 'E-mail já cadastrado' ? 409 : 500;
    res.status(status).json({ error: message });
  }
});

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao fazer login';
    res.status(401).json({ error: message });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const profile = await authService.getProfile(req.user!.id);
    res.json(profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar perfil';
    res.status(404).json({ error: message });
  }
});

// PATCH /api/auth/me
router.patch('/me', authenticate, validate(updateProfileSchema), async (req: AuthRequest, res: Response) => {
  try {
    const profile = await authService.updateProfile(req.user!.id, req.body);
    res.json(profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar perfil';
    res.status(500).json({ error: message });
  }
});

export default router;
