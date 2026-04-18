const MUSCLEWIKI_API_BASE = 'https://api.musclewiki.com';

function muscleWikiHeaders(): Record<string, string> {
  return {
    'X-API-Key': process.env.MUSCLEWIKI_API_KEY ?? '',
  };
}

/** Maps our camera angle name to the MuscleWiki angle keyword used in filenames. */
function preferredAngle(cameraAngle?: string): string {
  if (!cameraAngle) return 'front';
  const lower = cameraAngle.toLowerCase();
  if (lower.includes('lateral') || lower.includes('side') || lower.includes('90')) return 'side';
  if (lower.includes('posterior') || lower.includes('rear') || lower.includes('back')) return 'back';
  return 'front';
}

interface MuscleWikiVideo {
  url: string;
  angle?: string;
  gender?: string;
}

interface MuscleWikiSearchResponse {
  results?: {
    id: number;
    name: string;
    videos?: MuscleWikiVideo[];
  }[];
}

/**
 * Try a single search term against /search. Returns first result with videos, or null.
 */
async function trySearch(
  term: string,
): Promise<{ id: number; name: string; videos: MuscleWikiVideo[] } | null> {
  const url = new URL(`${MUSCLEWIKI_API_BASE}/search`);
  url.searchParams.set('q', term);
  url.searchParams.set('limit', '5');

  let res: Response;
  try {
    res = await fetch(url.toString(), { headers: muscleWikiHeaders() });
  } catch (err) {
    throw new Error(`MuscleWiki network error for "${term}": ${(err as Error).message}`);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MuscleWiki search HTTP ${res.status} for "${term}": ${body}`);
  }

  const data = (await res.json()) as MuscleWikiSearchResponse;
  const match = data.results?.find((r) => (r.videos?.length ?? 0) > 0);
  if (match && match.videos?.length) {
    return { id: match.id, name: match.name, videos: match.videos };
  }
  return null;
}

/**
 * Constructs the proxy URL for a MuscleWiki video filename.
 * Our /api/video-proxy/:filename endpoint streams it on-demand with the API key,
 * so KIE can access it as a plain public URL — no storage bucket required.
 */
function buildProxyUrl(filename: string): string {
  const appUrl =
    (process.env.APP_URL ?? '').replace(/\/$/, '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001');
  return `${appUrl}/api/video-proxy/${encodeURIComponent(filename)}`;
}

/**
 * Finds a reference exercise video on MuscleWiki and returns a publicly accessible proxy URL.
 *
 * Search strategy — tries progressively simpler queries until a match is found:
 *   1. Full name          (e.g. "Flat Barbell Bench Press")
 *   2. Drop first word    (e.g. "Barbell Bench Press")
 *   3. Drop first 2 words (e.g. "Bench Press")
 *
 * The returned URL points to our /api/video-proxy/:filename endpoint which streams the
 * MuscleWiki video on-demand with the API key — no Supabase Storage bucket needed.
 *
 * @param exerciseName  English exercise name (use name_en from DB when available).
 * @param cameraAngle   Camera angle label to pick the matching video angle.
 */
export async function fetchReferenceVideoUrl(
  exerciseName: string,
  cameraAngle?: string,
): Promise<string> {
  if (!process.env.MUSCLEWIKI_API_KEY) {
    throw new Error('MUSCLEWIKI_API_KEY is not set in environment variables');
  }

  // ── Step 1: Search with progressively simplified terms ───────────────────
  const words = exerciseName.trim().split(/\s+/).filter(Boolean);

  // Full name first, then drop one word from the front each time.
  // Stop at 2-word minimum to avoid overly generic single-word searches.
  const searchTerms: string[] = [];
  for (let i = 0; i <= Math.max(0, words.length - 2); i++) {
    searchTerms.push(words.slice(i).join(' '));
  }
  const uniqueTerms = [...new Set(searchTerms)];

  let match: { id: number; name: string; videos: MuscleWikiVideo[] } | null = null;
  let matchedTerm = '';

  for (const term of uniqueTerms) {
    console.log(`[MuscleWiki] Searching: "${term}"`);
    match = await trySearch(term);
    if (match) {
      matchedTerm = term;
      break;
    }
  }

  if (!match) {
    throw new Error(
      `No MuscleWiki exercise found matching "${exerciseName}" ` +
        `(tried: ${uniqueTerms.map((t) => `"${t}"`).join(', ')}). ` +
        `A developer must add a reference video for this exercise manually.`,
    );
  }

  console.log(
    `[MuscleWiki] Matched "${match.name}" (id: ${match.id}) via search term "${matchedTerm}"`,
  );

  // ── Step 2: Select the best video (male gender + matching angle) ──────────
  const anglePreference = preferredAngle(cameraAngle);

  const maleVideos = match.videos.filter(
    (v) => !v.gender || v.gender.toLowerCase() === 'male',
  );
  const candidates = maleVideos.length > 0 ? maleVideos : match.videos;

  const matchesAngle = (v: MuscleWikiVideo, keyword: string): boolean => {
    if (v.angle?.toLowerCase().includes(keyword)) return true;
    const urlFilename = v.url.split('/').pop() ?? '';
    return urlFilename.toLowerCase().includes(keyword);
  };

  const selected: MuscleWikiVideo | undefined =
    candidates.find((v) => matchesAngle(v, anglePreference)) ??
    candidates.find((v) => matchesAngle(v, 'front')) ??
    candidates[0];

  if (!selected?.url) {
    throw new Error(
      `MuscleWiki exercise "${match.name}" has no usable video URL. ` +
        `A developer must add a reference video for this exercise manually.`,
    );
  }

  console.log(
    `[MuscleWiki] Selected video angle "${selected.angle ?? 'unknown'}": ${selected.url}`,
  );

  // ── Step 3: Return proxy URL — no download/upload required ───────────────
  const filename = selected.url.split('/').pop();
  if (!filename || !filename.endsWith('.mp4')) {
    throw new Error(`Unexpected MuscleWiki video URL format: ${selected.url}`);
  }

  const proxyUrl = buildProxyUrl(filename);
  console.log(`[MuscleWiki] Proxy URL: ${proxyUrl}`);
  return proxyUrl;
}
