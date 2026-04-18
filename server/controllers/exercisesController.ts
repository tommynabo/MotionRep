import { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { searchExerciseVideos } from '../services/youtube.js';
import { processAndCutExerciseVideo } from '../lib/videoProcessor.js';

export async function listExercises(req: Request, res: Response): Promise<void> {
  const { q, category } = req.query as { q?: string; category?: string };

  let query = supabase
    .from('exercises')
    .select('id, name, category, base_technique, equipment, reference_video_url')
    .order('name');

  if (q) {
    query = query.ilike('name', `%${q}%`);
  }
  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.json(data);
}

export async function createExercise(req: Request, res: Response): Promise<void> {
  const { name, base_technique, category } = req.body as {
    name: string;
    base_technique?: string;
    category?: string;
  };

  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const { data, error } = await supabase
    .from('exercises')
    .insert({ name: name.trim(), base_technique: base_technique ?? '', category: category ?? 'General' })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json(data);
}

export async function deleteExercise(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const { error } = await supabase.from('exercises').delete().eq('id', id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(204).send();
}

/**
 * Search YouTube (CC-BY only) for candidate reference videos for an exercise.
 * Saves the top-3 results to the exercise's `candidate_videos` JSONB column.
 * POST /api/exercises/:id/search-candidates
 */
export async function searchCandidates(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const { data: exercise, error: fetchError } = await supabase
    .from('exercises')
    .select('id, name')
    .eq('id', id)
    .single();

  if (fetchError || !exercise) {
    res.status(404).json({ error: 'Exercise not found' });
    return;
  }

  let candidates;
  try {
    candidates = await searchExerciseVideos(exercise.name);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'YouTube search failed';
    res.status(502).json({ error: message });
    return;
  }

  const { error: updateError } = await supabase
    .from('exercises')
    .update({ candidate_videos: candidates })
    .eq('id', id);

  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }

  res.json({ candidates });
}

/**
 * Approve one of the candidate YouTube videos as the reference for an exercise.
 * Automatically:
 * 1. Detects exercise motion range (pose detection)
 * 2. Cuts the video to that range
 * 3. Uploads cut video to Supabase Storage
 * 4. Saves the storage URL as reference_video_url
 * 
 * PUT /api/exercises/:id/approve-video
 * Body: { youtubeUrl: string }
 */
export async function approveCandidate(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { youtubeUrl } = req.body as { youtubeUrl?: string };

  if (!youtubeUrl?.trim()) {
    res.status(400).json({ error: 'youtubeUrl is required' });
    return;
  }

  // Accept standard watch URLs and short youtu.be URLs only
  const isValidYouTubeUrl =
    /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}/.test(youtubeUrl) ||
    /^https:\/\/youtu\.be\/[A-Za-z0-9_-]{11}/.test(youtubeUrl);

  if (!isValidYouTubeUrl) {
    res.status(400).json({ error: 'youtubeUrl must be a valid YouTube watch or short URL' });
    return;
  }

  // Fetch exercise to get ID and name
  const { data: exercise, error: fetchError } = await supabase
    .from('exercises')
    .select('id, name')
    .eq('id', id)
    .single();

  if (fetchError || !exercise) {
    res.status(404).json({ error: 'Exercise not found' });
    return;
  }

  try {
    console.log(`[approveCandidate] Processing video for exercise: ${exercise.name}`);
    
    // Process video: detect -> cut -> upload
    const { url: processedVideoUrl, exerciseRange } = await processAndCutExerciseVideo(
      youtubeUrl.trim(),
      exercise.id
    );

    console.log(`[approveCandidate] Video processed. Updating exercise record...`);

    // Update exercise with processed video URL and timing info
    const { data, error: updateError } = await supabase
      .from('exercises')
      .update({
        reference_video_url: processedVideoUrl,
        reference_video_start_time: exerciseRange.startTime,
        reference_video_end_time: exerciseRange.endTime,
        reference_video_duration: exerciseRange.duration,
      })
      .eq('id', id)
      .select('id, name, reference_video_url, reference_video_duration')
      .single();

    if (updateError || !data) {
      res.status(500).json({ error: updateError?.message ?? 'Update failed' });
      return;
    }

    console.log(`[approveCandidate] Success! Approved video for ${exercise.name}`);
    res.json({
      ...data,
      processingInfo: {
        originalUrl: youtubeUrl,
        processedUrl: processedVideoUrl,
        detectedRange: exerciseRange,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Video processing failed';
    console.error('[approveCandidate] Error:', message);
    res.status(502).json({ 
      error: message,
      details: 'Failed to process and cut video. Ensure ffmpeg and Python (with mediapipe) are installed.',
    });
  }
}

