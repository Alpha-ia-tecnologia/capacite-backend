import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate, AuthRequest } from '../middleware/auth';
import { env } from '../config/env';
import prisma from '../lib/prisma';

const router = Router();
router.use(authenticate);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, env.UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg',
      'text/plain',
      'text/csv',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'));
    }
  },
});

// POST /api/files/upload/:diagnosticoId - Upload complementary file
router.post('/upload/:diagnosticoId', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Nenhum arquivo enviado' });
      return;
    }

    // Verify diagnostico belongs to user
    const diagnostico = await prisma.diagnostico.findFirst({
      where: { id: req.params.diagnosticoId as string, userId: req.user!.id },
    });

    if (!diagnostico) {
      res.status(404).json({ error: 'Diagnóstico não encontrado' });
      return;
    }

    const file = await prisma.complementaryFile.create({
      data: {
        userId: req.user!.id,
        diagnosticoId: req.params.diagnosticoId as string,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });

    res.status(201).json(file);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao fazer upload';
    res.status(500).json({ error: message });
  }
});

// GET /api/files/diagnostico/:diagnosticoId - List files for a diagnostico
router.get('/diagnostico/:diagnosticoId', async (req: AuthRequest, res: Response) => {
  try {
    const files = await prisma.complementaryFile.findMany({
      where: {
        diagnosticoId: req.params.diagnosticoId as string,
        userId: req.user!.id,
      },
      orderBy: { uploadedAt: 'desc' },
    });

    res.json(files);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar arquivos' });
  }
});

// DELETE /api/files/:id - Delete a file
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const file = await prisma.complementaryFile.findFirst({
      where: { id: req.params.id as string, userId: req.user!.id },
    });

    if (!file) {
      res.status(404).json({ error: 'Arquivo não encontrado' });
      return;
    }

    await prisma.complementaryFile.delete({ where: { id: req.params.id as string } });

    // Try to delete physical file (non-blocking)
    const fs = await import('fs/promises');
    try {
      await fs.unlink(path.join(env.UPLOAD_DIR, file.filename));
    } catch {
      // File may not exist on disk, that's ok
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir arquivo' });
  }
});

export default router;
