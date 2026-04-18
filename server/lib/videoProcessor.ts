/**
 * Video Processing Service
 * Handles: download → pose detection → cutting → upload to Supabase
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { getDirectMp4Url } from '../services/videoExtractor.js';

const execAsync = promisify(exec);

// Get __dirname for ES modules - with fallback for environments where import.meta.url may not be available
const __dirname = (() => {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch (err) {
    // Fallback: use process.cwd() if import.meta.url is not available
    console.warn('[VideoProcessor] Warning: import.meta.url not available, using process.cwd()');
    return process.cwd();
  }
})();

export interface ExerciseRange {
  startFrame: number;
  endFrame: number;
  startTime: number;
  endTime: number;
  duration: number;
}

interface ProcessResult {
  url: string;
  exerciseRange: ExerciseRange;
}

/**
 * Full pipeline:
 * 1. Download MP4 from YouTube URL
 * 2. Detect exercise range using Python/MediaPipe (if available locally)
 * 3. Cut video to that range using ffmpeg (if available locally)
 * 4. Upload to Supabase Storage (if cut video), or use YouTube URL directly
 * 5. Return storage URL
 * 
 * Fallback: If in serverless environment (Vercel), returns full YouTube URL.
 * Video processing (pose detection + cutting) should run on a dedicated backend.
 */
export async function processAndCutExerciseVideo(
  youtubeUrl: string,
  exerciseId: string,
  angleId?: string
): Promise<ProcessResult> {
  // Check if we're in a serverless environment
  // VERCEL environment variable is set when running on Vercel
  const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;
  
  if (isServerless) {
    console.log('[VideoProcessor] Serverless environment detected - using fallback mode');
    console.log('[VideoProcessor] Returning full YouTube URL (video cutting disabled in serverless)');
    return {
      url: youtubeUrl,
      exerciseRange: {
        startFrame: 0,
        endFrame: -1,
        startTime: 0,
        endTime: -1,
        duration: -1,
      },
    };
  }

  // Full processing pipeline with Python + FFmpeg (local environment)
  return await processAndCutExerciseVideoFull(youtubeUrl, exerciseId, angleId);
}

async function processAndCutExerciseVideoFull(
  youtubeUrl: string,
  exerciseId: string,
  angleId?: string
): Promise<ProcessResult> {
  const tempDir = path.join('/tmp', `exercise_${Date.now()}`);
  
  try {
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Step 1: Download MP4
    console.log('[VideoProcessor] Downloading MP4 from', youtubeUrl);
    const mp4Url = await getDirectMp4Url(youtubeUrl);
    const inputPath = path.join(tempDir, 'input.mp4');
    await downloadFile(mp4Url, inputPath);
    console.log('[VideoProcessor] Downloaded to', inputPath, '- Size:', fs.statSync(inputPath).size);
    
    // Step 2: Detect exercise range
    console.log('[VideoProcessor] Detecting exercise range with MediaPipe...');
    const exerciseRange = await detectExerciseRange(inputPath);
    console.log('[VideoProcessor] Detected range:', {
      startTime: exerciseRange.startTime.toFixed(2),
      endTime: exerciseRange.endTime.toFixed(2),
      duration: exerciseRange.duration.toFixed(2),
    });
    
    // Step 3: Cut video
    console.log('[VideoProcessor] Cutting video with FFmpeg...');
    const outputPath = path.join(tempDir, 'cut.mp4');
    await cutVideoWithFFmpeg(inputPath, outputPath, exerciseRange.startTime, exerciseRange.endTime);
    console.log('[VideoProcessor] Cut video ready - Size:', fs.statSync(outputPath).size);
    
    // Step 4: Upload to Supabase Storage
    console.log('[VideoProcessor] Uploading to Supabase Storage...');
    const storageUrl = await uploadToSupabase(outputPath, exerciseId, angleId);
    console.log('[VideoProcessor] Successfully uploaded:', storageUrl);
    
    return { url: storageUrl, exerciseRange };
  } finally {
    // Cleanup temp files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('[VideoProcessor] Cleaned up temp files');
    }
  }
}

async function detectExerciseRange(videoPath: string): Promise<ExerciseRange> {
  const scriptPath = path.join(__dirname, '../scripts/detect_exercise.py');
  
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Python script not found: ${scriptPath}`);
  }
  
  try {
    console.log('[DetectExercise] Executing Python script...');
    const { stdout, stderr } = await execAsync(
      `python3 "${scriptPath}" "${videoPath}"`,
      {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 5 * 60 * 1000, // 5 minute timeout
      }
    );
    
    if (stderr) {
      console.log('[DetectExercise] Python output:', stderr);
    }
    
    const result = JSON.parse(stdout);
    
    if (result.error) {
      throw new Error(`Python script error: ${result.error}`);
    }
    
    return {
      startFrame: result.start_frame,
      endFrame: result.end_frame,
      startTime: result.start_time,
      endTime: result.end_time,
      duration: result.duration,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[DetectExercise] Failed:', message);
    throw new Error(`Failed to detect exercise range: ${message}`);
  }
}

async function cutVideoWithFFmpeg(
  inputPath: string,
  outputPath: string,
  startTime: number,
  endTime: number
): Promise<void> {
  const duration = endTime - startTime;
  
  // Use copy codec for fast cutting (no re-encoding)
  const cmd = `ffmpeg -i "${inputPath}" -ss ${startTime} -t ${duration} -c:v copy -c:a copy "${outputPath}" -y 2>&1`;
  
  try {
    console.log('[FFmpeg] Command:', cmd);
    const { stdout } = await execAsync(cmd, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 10 * 60 * 1000, // 10 minute timeout
    });
    console.log('[FFmpeg] Success - Last output:', stdout.slice(-100));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[FFmpeg] Failed:', message);
    throw new Error(`FFmpeg cutting failed: ${message}`);
  }
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
  console.log('[Download] Fetching from:', url);
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`);
  }
  
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
  console.log('[Download] Saved:', outputPath);
}

async function uploadToSupabase(
  filePath: string,
  exerciseId: string,
  angleId?: string
): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  const fileName = `${exerciseId}${angleId ? `_${angleId}` : ''}_${Date.now()}.mp4`;
  const bucketName = 'exercise-reference-videos';
  
  console.log('[Supabase] Creating/checking bucket:', bucketName);
  
  // Ensure bucket exists
  try {
    await supabase.storage.createBucket(bucketName, {
      public: true,
      allowedMimeTypes: ['video/mp4'],
      fileSizeLimit: 104857600, // 100MB
    });
    console.log('[Supabase] Bucket created');
  } catch (err) {
    // Bucket might already exist
    const errMsg = err instanceof Error ? err.message : String(err);
    if (!errMsg.includes('already')) {
      console.log('[Supabase] Bucket check:', errMsg);
    }
  }
  
  // Upload file
  console.log('[Supabase] Uploading file:', fileName);
  const fileData = fs.readFileSync(filePath);
  
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(fileName, fileData, {
      contentType: 'video/mp4',
      cacheControl: '3600',
      upsert: false,
    });
  
  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }
  
  console.log('[Supabase] File uploaded:', data);
  
  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(bucketName)
    .getPublicUrl(fileName);
  
  return publicUrl;
}
