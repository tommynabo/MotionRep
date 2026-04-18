import { supabase } from '../lib/supabase.js';

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

interface MuscleWikiSearchResult {
  results?: {
    id: number;
    name: string;
    videos?: MuscleWikiVideo[];
  }[];
}

/**
 * Fetches a publicly accessible reference video URL for the given exercise from MuscleWiki.
 *
 * Flow:
 *   1. Search MuscleWiki for the exercise by name → get the best-matching exercise ID.
 *   2. Fetch exercise detail → extract the best video (male gender, matching camera angle).
 *   3. Download the video binary (MuscleWiki stream endpoints require the API key header).
 *   4. Upload to Supabase Storage `reference-videos` bucket (public read, upsert to avoid re-downloading).
 *   5. Return the public Supabase URL — accessible by the KIE API without auth headers.
 *
 * Throws a descriptive error if the exercise is not found or has no videos, so the pipeline
 * can abort cleanly with a developer-facing message rather than wasting API credits.
 *
 * Requires env vars:
 *   - MUSCLEWIKI_API_KEY
 * Requires Supabase Storage:
 *   - Bucket `reference-videos` with public read access enabled.
 *
 * @param exerciseName  Exercise name to search — use the English name (name_en) when available.
 * @param cameraAngle   Our camera angle label (e.g. "Lateral 90°") to select the matching video.
 */
export async function fetchReferenceVideoUrl(
  exerciseName: string,
  cameraAngle?: string,
): Promise<string> {
  const apiKey = process.env.MUSCLEWIKI_API_KEY;
  if (!apiKey) {
    throw new Error('MUSCLEWIKI_API_KEY is not set in environment variables');
  }

  // ── Step 1: Search for the exercise (returns full data including videos) ──
  const searchUrl = new URL(`${MUSCLEWIKI_API_BASE}/search`);
  searchUrl.searchParams.set('q', exerciseName);
  searchUrl.searchParams.set('limit', '3');

  const searchRes = await fetch(searchUrl.toString(), {
    headers: muscleWikiHeaders(),
  });

  if (!searchRes.ok) {
    const body = await searchRes.text();
    throw new Error(
      `MuscleWiki search failed (HTTP ${searchRes.status}) for "${exerciseName}": ${body}`,
    );
  }

  const searchData = (await searchRes.json()) as MuscleWikiSearchResult;

  if (!searchData.results?.length) {
    throw new Error(
      `No MuscleWiki exercise found matching "${exerciseName}". ` +
        `A developer must add a reference video for this exercise manually.`,
    );
  }

  const best = searchData.results[0];
  console.log(
    `[MuscleWiki] Matched "${best.name}" (id: ${best.id}) for query "${exerciseName}"`,
  );

  // The search endpoint returns the full exercise data including videos —
  // no second /exercises/{id} call needed.
  if (!best.videos?.length) {
    throw new Error(
      `Exercise "${exerciseName}" (MuscleWiki id: ${best.id}) has no videos. ` +
        `A developer must add a reference video for this exercise manually.`,
    );
  }

  // ── Step 2: Select the best video (male gender, matching camera angle) ────
  const anglePreference = preferredAngle(cameraAngle);

  // Prefer male-gender videos; fall back to any if none are labelled male.
  const maleVideos = best.videos.filter(
    (v) => !v.gender || v.gender.toLowerCase() === 'male',
  );
  const candidates = maleVideos.length > 0 ? maleVideos : best.videos;

  /**
   * Check both the `angle` field and the URL/filename for the angle keyword.
   * MuscleWiki filenames follow the pattern: {gender}-{Category}-{slug}-{angle}.mp4
   */
  const matchesAngle = (v: MuscleWikiVideo, keyword: string): boolean => {
    if (v.angle?.toLowerCase().includes(keyword)) return true;
    try {
      const filename = new URL(v.url).pathname.split('/').pop() ?? '';
      return filename.toLowerCase().includes(keyword);
    } catch {
      return v.url.toLowerCase().includes(keyword);
    }
  };

  const selected: MuscleWikiVideo | undefined =
    candidates.find((v) => matchesAngle(v, anglePreference)) ??
    candidates.find((v) => matchesAngle(v, 'front')) ??
    candidates[0];

  if (!selected?.url) {
    throw new Error(
      `No valid video URL found for exercise "${exerciseName}" in MuscleWiki response. ` +
        `A developer must add a reference video for this exercise manually.`,
    );
  }

  console.log(
    `[MuscleWiki] Selected video (angle: ${selected.angle ?? 'unknown'}): ${selected.url}`,
  );

  // ── Step 3: Download the video (MuscleWiki streams require the API key) ───
  const videoRes = await fetch(selected.url, {
    headers: muscleWikiHeaders(),
  });

  if (!videoRes.ok) {
    throw new Error(
      `Failed to download MuscleWiki reference video (HTTP ${videoRes.status}): ${selected.url}`,
    );
  }

  const videoBuffer = await videoRes.arrayBuffer();

  // ── Step 4: Upload to Supabase Storage (upsert — skips re-download on retries) ─
  const storagePath = `musclewiki/${best.id}-${anglePreference}.mp4`;

  const { error: uploadError } = await supabase.storage
    .from('reference-videos')
    .upload(storagePath, videoBuffer, {
      contentType: 'video/mp4',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(
      `Failed to upload reference video to Supabase Storage: ${uploadError.message}`,
    );
  }

  const { data: publicUrlData } = supabase.storage
    .from('reference-videos')
    .getPublicUrl(storagePath);

  if (!publicUrlData?.publicUrl) {
    throw new Error('Failed to get public URL from Supabase Storage for the reference video');
  }

  console.log(`[MuscleWiki] Reference video cached at: ${publicUrlData.publicUrl}`);
  return publicUrlData.publicUrl;
}
