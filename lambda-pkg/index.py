"""
MotionREP Video Processing Lambda Handler
Processes YouTube videos: downloads → detects exercise range → cuts → uploads to Supabase
"""

import json
import subprocess
import os
import sys
import tempfile
import urllib.request
import boto3
import requests
from datetime import datetime
from typing import Dict, Any

# Initialize clients
innertube_handler = None

FFMPEG_PATH = '/tmp/ffmpeg'
FFMPEG_URL = 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz'

MEDIAPIPE_DIR = '/tmp/site-packages-mediapipe'
OPENCV_DIR = '/tmp/site-packages-opencv'


def ensure_dependencies_available():
    """Download FFmpeg, MediaPipe, and OpenCV to /tmp if not present"""
    ensure_ffmpeg_available()
    ensure_mediapipe_available()
    ensure_opencv_available()
    
    # Add to Python path for imports
    if MEDIAPIPE_DIR not in sys.path:
        sys.path.insert(0, MEDIAPIPE_DIR)
    if OPENCV_DIR not in sys.path:
        sys.path.insert(0, OPENCV_DIR)


def ensure_ffmpeg_available():
    """Download FFmpeg to /tmp if not already present"""
    if os.path.exists(FFMPEG_PATH) and os.path.getsize(FFMPEG_PATH) > 70e6:
        print(f'[Lambda] FFmpeg already available at {FFMPEG_PATH}')
        return
    
    print('[Lambda] Downloading FFmpeg to /tmp...')
    try:
        # Download tar.xz
        tar_path = '/tmp/ffmpeg.tar.xz'
        urllib.request.urlretrieve(FFMPEG_URL, tar_path)
        print(f'[Lambda] Downloaded FFmpeg ({os.path.getsize(tar_path) / 1e6:.1f}MB)')
        
        # Extract
        subprocess.run(['tar', '-xf', tar_path, '-C', '/tmp'], check=True, capture_output=True)
        
        # Find and move binary
        subprocess.run(['find', '/tmp', '-name', 'ffmpeg', '-type', 'f', '-exec', 'mv', '{}', FFMPEG_PATH, ';'],
                      check=True, capture_output=True)
        
        # Make executable
        os.chmod(FFMPEG_PATH, 0o755)
        print(f'[Lambda] FFmpeg ready at {FFMPEG_PATH}')
        
        # Cleanup
        subprocess.run(['rm', '-f', tar_path], capture_output=True)
        subprocess.run(['rm', '-rf', '/tmp/ffmpeg-*'], shell=True, capture_output=True)
    except Exception as e:
        print(f'[Lambda] ⚠️ FFmpeg download failed: {str(e)}')
        raise ValueError(f'Cannot download FFmpeg: {str(e)}')


def ensure_mediapipe_available():
    """Download MediaPipe wheel to /tmp if not present"""
    if os.path.exists(MEDIAPIPE_DIR) and os.path.getsize(MEDIAPIPE_DIR) > 100e6:
        print(f'[Lambda] MediaPipe already available at {MEDIAPIPE_DIR}')
        return
    
    print('[Lambda] Downloading MediaPipe to /tmp...')
    try:
        # Use pip to download MediaPipe wheel
        subprocess.run([
            sys.executable, '-m', 'pip', 'install', 
            'mediapipe==0.10.5', 
            f'--target={MEDIAPIPE_DIR}',
            '--no-cache-dir',
            '--quiet'
        ], check=True, capture_output=True, timeout=120)
        print(f'[Lambda] MediaPipe ready at {MEDIAPIPE_DIR}')
    except Exception as e:
        print(f'[Lambda] ⚠️ MediaPipe download failed: {str(e)}')
        raise ValueError(f'Cannot download MediaPipe: {str(e)}')


def ensure_opencv_available():
    """Download OpenCV wheel to /tmp if not present"""
    if os.path.exists(OPENCV_DIR) and os.path.getsize(OPENCV_DIR) > 50e6:
        print(f'[Lambda] OpenCV already available at {OPENCV_DIR}')
        return
    
    print('[Lambda] Downloading OpenCV to /tmp...')
    try:
        # Use pip to download OpenCV headless
        subprocess.run([
            sys.executable, '-m', 'pip', 'install', 
            'opencv-python-headless==4.8.1.78', 
            f'--target={OPENCV_DIR}',
            '--no-cache-dir',
            '--quiet'
        ], check=True, capture_output=True, timeout=120)
        print(f'[Lambda] OpenCV ready at {OPENCV_DIR}')
    except Exception as e:
        print(f'[Lambda] ⚠️ OpenCV download failed: {str(e)}')
        raise ValueError(f'Cannot download OpenCV: {str(e)}')


def lambda_handler(event, context):
    """
    Main Lambda handler - processes video cutting requests
    
    Expected event body:
    {
        "youtubeUrl": "https://youtu.be/...",
        "exerciseId": "uuid",
        "angleId": "front" (optional),
        "supabaseKey": "service_role_key",
        "callbackUrl": "https://vercel-app.com/api/webhook/video-processed"
    }
    """
    try:
        # Ensure all dependencies are available (download if needed)
        print('[Lambda] Ensuring dependencies are available (FFmpeg, MediaPipe, OpenCV)...')
        ensure_dependencies_available()
        
        # Parse request
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])
        else:
            body = event

        youtube_url = body.get('youtubeUrl')
        exercise_id = body.get('exerciseId')
        angle_id = body.get('angleId')
        supabase_key = body.get('supabaseKey')
        callback_url = body.get('callbackUrl')
        supabase_url = body.get('supabaseUrl', os.getenv('SUPABASE_URL'))

        # Validation
        if not all([youtube_url, exercise_id, supabase_key, callback_url, supabase_url]):
            return error_response(400, 'Missing required parameters')

        print(f'[Lambda] Processing video for exercise: {exercise_id}')
        print(f'[Lambda] YouTube URL: {youtube_url}')

        # Get direct MP4 URL from YouTube
        print('[Lambda] Extracting direct MP4 URL from YouTube...')
        mp4_url = extract_youtube_mp4(youtube_url)

        # Download video to /tmp
        print('[Lambda] Downloading video from YouTube...')
        video_path = download_video(mp4_url)

        # Detect exercise range using MediaPipe
        print('[Lambda] Detecting exercise range with MediaPipe...')
        exercise_range = detect_exercise_range(video_path)

        # Cut video with FFmpeg
        print(f'[Lambda] Cutting video from {exercise_range["start_time"]:.2f}s to {exercise_range["end_time"]:.2f}s...')
        cut_video_path = cut_video(video_path, exercise_range['start_time'], exercise_range['end_time'])

        # Upload to Supabase Storage
        print('[Lambda] Uploading cut video to Supabase Storage...')
        storage_url = upload_to_supabase(
            cut_video_path,
            exercise_id,
            angle_id,
            supabase_url,
            supabase_key
        )

        # Prepare webhook payload
        webhook_payload = {
            'success': True,
            'exerciseId': exercise_id,
            'videoUrl': storage_url,
            'reference_video_start_time': exercise_range['start_time'],
            'reference_video_end_time': exercise_range['end_time'],
            'reference_video_duration': exercise_range['duration'],
            'processedAt': datetime.utcnow().isoformat()
        }

        # Call webhook to update Vercel
        print(f'[Lambda] Calling webhook: {callback_url}')
        webhook_response = call_webhook(callback_url, webhook_payload)

        # Clean up
        cleanup_temp_files([video_path, cut_video_path])

        print('[Lambda] ✅ Video processing completed successfully')
        return success_response(200, webhook_payload)

    except Exception as e:
        error_msg = str(e)
        print(f'[Lambda] ❌ Error: {error_msg}')
        
        # Call webhook with error
        try:
            error_payload = {
                'success': False,
                'exerciseId': body.get('exerciseId'),
                'error': error_msg,
                'failedAt': datetime.utcnow().isoformat()
            }
            call_webhook(body.get('callbackUrl'), error_payload)
        except:
            pass  # Webhook call failed, already logged main error

        return error_response(500, f'Video processing failed: {error_msg}')


def extract_youtube_mp4(youtube_url: str) -> str:
    """Extract direct MP4 URL from YouTube using Innertube API (pure Python, no external binaries)"""
    try:
        from pytube import YouTube
        yt = YouTube(youtube_url)
        stream = yt.streams.filter(progressive=True, file_extension='mp4').first()
        if not stream:
            stream = yt.streams.filter(file_extension='mp4').first()
        if not stream:
            raise ValueError('No MP4 stream found')
        return stream.url
    except ImportError:
        # Fallback: use basic regex + requests (minimal dependency)
        print('[Lambda] pytube not available, using fallback extraction')
        raise ValueError('YouTube extraction requires pytube library in Lambda layer')


def download_video(mp4_url: str, max_size: int = 500_000_000) -> str:
    """Download video to /tmp directory"""
    video_path = '/tmp/input_video.mp4'
    
    try:
        urllib.request.urlretrieve(mp4_url, video_path)
        size = os.path.getsize(video_path)
        
        if size > max_size:
            raise ValueError(f'Video too large: {size / 1e6:.1f}MB (max 500MB)')
        
        print(f'[Lambda] Video downloaded: {size / 1e6:.1f}MB')
        return video_path
    except Exception as e:
        raise ValueError(f'Failed to download video: {str(e)}')


def detect_exercise_range(video_path: str) -> Dict[str, float]:
    """Call detect_exercise.py to find exercise motion range"""
    try:
        script_path = '/var/task/detect_exercise_lambda.py'  # Lambda deployment path
        
        result = subprocess.run(
            ['python3', script_path, video_path],
            capture_output=True,
            text=True,
            timeout=300  # 5 minutes timeout
        )
        
        if result.returncode != 0:
            raise ValueError(f'detect_exercise.py failed: {result.stderr}')
        
        # Parse JSON output
        output = json.loads(result.stdout)
        
        return {
            'start_time': float(output['start_time']),
            'end_time': float(output['end_time']),
            'duration': float(output['duration']),
            'start_frame': int(output['start_frame']),
            'end_frame': int(output['end_frame'])
        }
    except json.JSONDecodeError as e:
        raise ValueError(f'detect_exercise.py output invalid JSON: {str(e)}')
    except subprocess.TimeoutExpired:
        raise ValueError('detect_exercise.py timeout (exceeded 5 minutes)')
    except Exception as e:
        raise ValueError(f'Exercise detection failed: {str(e)}')


def cut_video(input_path: str, start_time: float, end_time: float) -> str:
    """Cut video using FFmpeg (fast copy codec, no re-encoding)"""
    output_path = '/tmp/output_video.mp4'
    
    try:
        cmd = [
            FFMPEG_PATH,  # Use full path to FFmpeg
            '-i', input_path,
            '-ss', str(start_time),
            '-to', str(end_time),
            '-c', 'copy',  # Copy codec - no re-encoding, fast
            '-y',  # Overwrite
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        
        if result.returncode != 0:
            raise ValueError(f'FFmpeg failed: {result.stderr}')
        
        size = os.path.getsize(output_path)
        print(f'[Lambda] Video cut successfully: {size / 1e6:.1f}MB')
        return output_path
    except subprocess.TimeoutExpired:
        raise ValueError('FFmpeg timeout (exceeded 2 minutes)')
    except Exception as e:
        raise ValueError(f'Video cutting failed: {str(e)}')


def upload_to_supabase(
    file_path: str,
    exercise_id: str,
    angle_id: str | None,
    supabase_url: str,
    supabase_key: str
) -> str:
    """Upload cut video to Supabase Storage"""
    try:
        # Prepare bucket path
        timestamp = int(datetime.utcnow().timestamp() * 1000)
        filename = f'{exercise_id}{"_" + angle_id if angle_id else ""}_{timestamp}.mp4'
        bucket_name = 'exercise-reference-videos'
        
        # Read file
        with open(file_path, 'rb') as f:
            file_data = f.read()
        
        # Upload to Supabase Storage
        storage_url = f'{supabase_url}/storage/v1/object/{bucket_name}/{filename}'
        headers = {
            'Authorization': f'Bearer {supabase_key}',
            'Content-Type': 'video/mp4'
        }
        
        response = requests.post(storage_url, data=file_data, headers=headers)
        
        if response.status_code not in [200, 201]:
            raise ValueError(f'Supabase upload failed: {response.status_code} {response.text}')
        
        # Return public URL
        public_url = f'{supabase_url}/storage/v1/object/public/{bucket_name}/{filename}'
        print(f'[Lambda] Video uploaded: {public_url}')
        return public_url
    except Exception as e:
        raise ValueError(f'Supabase upload failed: {str(e)}')


def call_webhook(callback_url: str, payload: Dict[str, Any]) -> Dict:
    """POST webhook callback to Vercel with processing results"""
    try:
        headers = {
            'Content-Type': 'application/json',
            'X-Lambda-Authorization': os.getenv('LAMBDA_WEBHOOK_SECRET', '')
        }
        
        response = requests.post(
            callback_url,
            json=payload,
            headers=headers,
            timeout=10
        )
        
        if response.status_code not in [200, 201, 202]:
            raise ValueError(f'Webhook failed: {response.status_code} {response.text}')
        
        print(f'[Lambda] Webhook delivered: {response.status_code}')
        return response.json()
    except Exception as e:
        print(f'[Lambda] ⚠️ Webhook call failed: {str(e)}')
        # Don't raise - webhook failure shouldn't fail the entire job
        return {'success': False, 'error': str(e)}


def cleanup_temp_files(file_paths: list):
    """Remove temporary files"""
    for path in file_paths:
        try:
            if path and os.path.exists(path):
                os.remove(path)
                print(f'[Lambda] Cleaned up: {path}')
        except Exception as e:
            print(f'[Lambda] Failed to cleanup {path}: {str(e)}')


def success_response(status_code: int, data: Dict) -> Dict:
    """Format Lambda response"""
    return {
        'statusCode': status_code,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps(data)
    }


def error_response(status_code: int, message: str) -> Dict:
    """Format error response"""
    return {
        'statusCode': status_code,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({'success': False, 'error': message})
    }
