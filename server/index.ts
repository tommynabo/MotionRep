// Local development server only.
// In production (Vercel), api/index.ts is used instead.
import app from './app.js';

const PORT = Number(process.env.PORT ?? 3001);

app.listen(PORT, () => {
  console.log(`MotionREP API server running on http://localhost:${PORT}`);
});
