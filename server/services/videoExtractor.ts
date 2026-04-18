/**
 * Video URL extractor for YouTube CC-BY videos.
 * Uses youtubei.js (pure Node.js, no external binaries required).
 * Resolves a direct MP4 URL that can be passed to KIE video AI models
 * (Kling motion-control / Seedance) as the reference video.
 *
 * Install: npm install youtubei.js
 */

import { Innertube } from 'youtubei.js';

/** Extract the 11-character YouTube video ID from any standard YouTube URL. */
function extractVideoId(youtubeUrl: string): string {
  // Supports: https://www.youtube.com/watch?v=ID and https://youtu.be/ID
  const watchMatch = youtubeUrl.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];

  const shortMatch = youtubeUrl.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  throw new Error(`Cannot extract video ID from URL: ${youtubeUrl}`);
}

/**
 * Resolve a direct MP4 stream URL from a YouTube watch URL.
 * Prefers the highest-quality progressive MP4 stream that contains
 * both audio and video in a single file (no muxing required).
 *
 * @param youtubeUrl - Full YouTube URL (watch?v= or youtu.be/ format)
 * @returns Direct URL to an MP4 stream suitable for AI video models
 */
export async function getDirectMp4Url(youtubeUrl: string): Promise<string> {
  const videoId = extractVideoId(youtubeUrl);

  const youtube = await Innertube.create({
    // Disable cache to always get fresh stream tokens
    cache: undefined,
    generate_session_locally: true,
  });

  const info = await youtube.getBasicInfo(videoId);

  // Progressive formats have both video + audio in one stream (no muxing).
  // Filter to MP4 only and sort by resolution descending.
  const formats = info.streaming_data?.formats ?? [];
  const mp4Formats = formats
    .filter((f) => f.mime_type?.includes('video/mp4'))
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));

  if (mp4Formats.length === 0) {
    // Fallback: try adaptive video-only formats (still an .mp4 URL — KIE can handle it)
    const adaptiveFormats = info.streaming_data?.adaptive_formats ?? [];
    const adaptiveMp4 = adaptiveFormats
      .filter((f) => f.mime_type?.includes('video/mp4'))
      .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));

    if (adaptiveMp4.length === 0) {
      throw new Error(`No MP4 stream found for YouTube video: ${videoId}`);
    }

    const url = adaptiveMp4[0].decipher(youtube.session.player);
    if (!url) throw new Error(`Failed to decipher adaptive MP4 URL for video: ${videoId}`);
    return url;
  }

  const url = mp4Formats[0].decipher(youtube.session.player);
  if (!url) throw new Error(`Failed to decipher MP4 URL for video: ${videoId}`);
  return url;
}
