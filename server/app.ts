import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRouter from './routes/api.js';

const app = express();

// CORS: allow same-origin in production (Vercel) and localhost in dev
// VERCEL_URL    = unique per-deployment URL (changes every deploy)
// VERCEL_PROJECT_PRODUCTION_URL = stable production alias
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '',
  process.env.ALLOWED_ORIGIN ?? '',
].filter(Boolean);

// Matches any preview URL of the same Vercel project
const vercelPreviewPattern = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? new RegExp(`^https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\./g, '\\.')}$`)
  : null;

app.use(cors({
  origin: (origin, cb) => {
    // allow server-to-server calls (no origin) and listed origins
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // allow any *.vercel.app URL that belongs to this project
    if (origin.endsWith('.vercel.app')) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// All API routes under /api
app.use('/api', apiRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
