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
    // Falls back to full YouTube URL if Python/FFmpeg not available (serverless)
    // Or queues job to external Lambda worker if configured
    const { url: processedVideoUrl, exerciseRange } = await processAndCutExerciseVideo(
      youtubeUrl.trim(),
      exercise.id
    );

    // Duration indicators:
    // > 0: fully processed (local or Lambda completed)
    // = 0: processing queued (Lambda job queued, awaiting webhook callback)
    // = -1: fallback mode (no Lambda, serverless only)
    const isFullyProcessed = exerciseRange.duration > 0;
    const isProcessingQueued = exerciseRange.duration === 0;
    const isFallbackMode = exerciseRange.duration === -1;
    
    const statusMessage = isFullyProcessed
      ? 'processed'
      : isProcessingQueued
      ? 'queued'
      : 'fallback';
    
    console.log(`[approveCandidate] Video ${statusMessage}. Updating exercise record...`);

    // Update exercise with video URL and timing info (if available)
    const updateData: any = {
      reference_video_url: processedVideoUrl,
    };

    // Only set timing columns if fully processed
    if (isFullyProcessed) {
      updateData.reference_video_start_time = exerciseRange.startTime;
      updateData.reference_video_end_time = exerciseRange.endTime;
      updateData.reference_video_duration = exerciseRange.duration;
    }
    // If queued or fallback, timing columns remain NULL (will be set by webhook or stay null)

    const { data, error: updateError } = await supabase
      .from('exercises')
      .update(updateData)
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
        detectedRange: isFullyProcessed ? exerciseRange : null,
        fallbackMode: isFallbackMode,
        processingQueued: isProcessingQueued,
        message: isFullyProcessed
          ? 'Video processed and cut to exercise range'
          : isProcessingQueued
          ? 'Video processing queued - Lambda worker will cut and update. Check back in ~1-2 minutes.'
          : 'Serverless mode: using full YouTube URL. Video cutting not available.',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Video processing failed';
    console.error('[approveCandidate] Error:', message);
    res.status(502).json({ 
      error: message,
      details: 'For best results, ensure ffmpeg and Python (with mediapipe) are installed in your environment.',
    });
  }
}

/**
 * Webhook handler for Lambda video processing callback
 * Called by AWS Lambda after video has been cut and uploaded to Supabase Storage
 * 
 * Expected body:
 * {
 *   "success": true,
 *   "exerciseId": "uuid",
 *   "videoUrl": "https://supabase.../3_1703251428000.mp4",
 *   "reference_video_start_time": 1.5,
 *   "reference_video_end_time": 40.1,
 *   "reference_video_duration": 38.6
 * }
 */
export async function handleVideoProcessedWebhook(req: Request, res: Response): Promise<void> {
  try {
    const { success, exerciseId, videoUrl, reference_video_start_time, reference_video_end_time, reference_video_duration, error } = req.body;

    // Verify webhook signature (optional - add if using LAMBDA_WEBHOOK_SECRET)
    // const lambdaSecret = process.env.LAMBDA_WEBHOOK_SECRET;
    // if (lambdaSecret) {
    //   const signature = req.headers['x-lambda-signature'];
    //   // Verify signature logic here
    // }

    if (!exerciseId) {
      res.status(400).json({ error: 'exerciseId is required' });
      return;
    }

    // Check if processing failed
    if (!success || error) {
      console.log(`[Webhook] Video processing failed for exercise ${exerciseId}: ${error || 'unknown error'}`);
      
      // Update exercise with error status
      await supabase
        .from('exercises')
        .update({
          notes: `Video processing failed: ${error || 'unknown error'}`,
        })
        .eq('id', exerciseId);

      res.status(200).json({ 
        success: false, 
        message: 'Processing failure recorded' 
      });
      return;
    }

    // Processing succeeded - update exercise with processed video and timing data
    console.log(`[Webhook] Updating exercise ${exerciseId} with processed video`);
    
    const { error: updateError } = await supabase
      .from('exercises')
      .update({
        reference_video_url: videoUrl,
        reference_video_start_time,
        reference_video_end_time,
        reference_video_duration,
      })
      .eq('id', exerciseId);

    if (updateError) {
      console.error(`[Webhook] Failed to update exercise: ${updateError.message}`);
      res.status(500).json({ 
        error: 'Database update failed',
        details: updateError.message 
      });
      return;
    }

    console.log(`[Webhook] ✅ Exercise ${exerciseId} updated successfully. Duration: ${reference_video_duration.toFixed(2)}s`);
    res.status(200).json({ 
      success: true, 
      message: 'Exercise updated successfully',
      exerciseId,
      duration: reference_video_duration,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Webhook] Error:', message);
    res.status(500).json({ 
      error: 'Webhook processing failed',
      details: message,
    });
  }
}

