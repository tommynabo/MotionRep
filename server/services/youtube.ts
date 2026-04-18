/**
 * YouTube Data API v3 — Legal video search service.
 * Filters exclusively for Creative Commons (CC-BY) licensed videos,
 * which may be freely used as motion-transfer reference material.
 * Requires: YOUTUBE_API_KEY environment variable.
 */

const YOUTUBE_SEARCH_BASE = 'https://www.googleapis.com/youtube/v3/search';

export interface YouTubeCandidate {
  videoId: string;
  title: string;
  thumbnail: string;
  youtubeUrl: string;
}

/**
 * Search YouTube for exercise reference videos filtered to Creative Commons license only.
 * Returns the top 5 results (videoId, title, thumbnail, full YouTube URL).
 */
export async function searchExerciseVideos(exerciseName: string): Promise<YouTubeCandidate[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY environment variable is not set');
  }

  const params = new URLSearchParams({
    part: 'snippet',
    q: `${exerciseName} exercise tutorial`,
    type: 'video',
    videoLicense: 'creativeCommon',
    videoDuration: 'short',
    maxResults: '5',
    relevanceLanguage: 'en',
    key: apiKey,
  });

  const res = await fetch(`${YOUTUBE_SEARCH_BASE}?${params.toString()}`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    items?: Array<{
      id: { videoId: string };
      snippet: {
        title: string;
        thumbnails: {
          medium?: { url: string };
          default?: { url: string };
        };
      };
    }>;
    error?: { message: string };
  };

  if (json.error) {
    throw new Error(`YouTube API error: ${json.error.message}`);
  }

  if (!json.items || json.items.length === 0) {
    return [];
  }

  return json.items.map((item) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    thumbnail:
      item.snippet.thumbnails.medium?.url ??
      item.snippet.thumbnails.default?.url ??
      '',
    youtubeUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
  }));
}
