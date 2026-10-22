import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { authenticateToken } from '../auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = 'upload_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7) + ext;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export const uploadRoutes = Router();

uploadRoutes.post('/', authenticateToken, upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  return res.json({
    message: 'Arquivo enviado com sucesso!',
    url: fileUrl,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size
  });
});
