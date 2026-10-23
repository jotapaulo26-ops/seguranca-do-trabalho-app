import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initDatabase } from './db.js';
import { authRoutes } from './routes/authRoutes.js';
import { roleRoutes } from './routes/roleRoutes.js';
import { userRoutes } from './routes/userRoutes.js';
import { employeeRoutes } from './routes/employeeRoutes.js';
import { riskRoutes } from './routes/riskRoutes.js';
import { documentRoutes } from './routes/documentRoutes.js';
import { dashboardRoutes } from './routes/dashboardRoutes.js';
import { auditRoutes } from './routes/auditRoutes.js';
import { settingRoutes } from './routes/settingRoutes.js';
import { uploadRoutes } from './routes/uploadRoutes.js';
import { brigadeRoutes } from './routes/brigadeRoutes.js';
import { publicRoutes } from './routes/publicRoutes.js';
import { trackingRoutes } from './routes/trackingRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB schema & seeds
initDatabase();

export const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-device-id']
}));

// Generous payload limits for digital signatures and base64 canvas data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static uploads folder
const uploadsDir = path.resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SegTrabalho API', time: new Date().toISOString() });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/risks', riskRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/brigade', brigadeRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/tracking', trackingRoutes);

export default app;
