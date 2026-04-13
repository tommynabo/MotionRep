// Vercel Serverless Function entry point.
// Exports the Express app — Vercel wraps it as a serverless handler.
// All /api/* routes are rewritten here via vercel.json.
import app from '../server/app.js';

export default app;
