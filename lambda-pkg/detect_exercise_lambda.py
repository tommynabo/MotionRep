#!/usr/bin/env python3
"""
Pose Detection for Exercise Range Identification (Lambda Edition)
Uses MediaPipe to detect when exercise motion starts and ends in a video.
Optimized for AWS Lambda environment with /tmp storage.
"""

import sys
import os

# Add MediaPipe and OpenCV from /tmp (downloaded at Lambda runtime)
if os.path.exists('/tmp/site-packages-mediapipe'):
    sys.path.insert(0, '/tmp/site-packages-mediapipe')
if os.path.exists('/tmp/site-packages-opencv'):
    sys.path.insert(0, '/tmp/site-packages-opencv')

import cv2
import mediapipe as mp
import json
import numpy as np
from collections import deque


def detect_exercise_range(video_path, min_movement_threshold=0.08, window_size=5):
    """
    Analyzes video and detects exercise motion range.
    Returns: {start_frame, end_frame, start_time, end_time, duration}
    """
    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        min_detection_confidence=0.7,
        min_tracking_confidence=0.5
    )
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {'error': f'Cannot open video: {video_path}'}
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    frames_data = []
    frame_count = 0
    movement_window = deque(maxlen=window_size)
    
    print(f"Analyzing video: {total_frames} frames @ {fps} FPS", file=sys.stderr)
    
    while frame_count < total_frames:
        ret, frame = cap.read()
        if not ret:
            break
        
        # Resize for faster processing
        frame_resized = cv2.resize(frame, (480, 360))
        rgb_frame = cv2.cvtColor(frame_resized, cv2.COLOR_BGR2RGB)
        
        # Detect poses
        results = pose.process(rgb_frame)
        
        movement = 0
        has_pose = False
        
        if results.pose_landmarks:
            has_pose = True
            movement = calculate_movement(results.pose_landmarks)
        
        # Track movement with windowing
        movement_window.append(movement)
        smoothed_movement = np.mean(list(movement_window)) if movement_window else 0
        
        frames_data.append({
            'frame': frame_count,
            'time': frame_count / fps,
            'movement': movement,
            'smoothed': smoothed_movement,
            'has_pose': has_pose
        })
        
        frame_count += 1
        
        # Progress logging
        if frame_count % max(1, total_frames // 10) == 0:
            print(f"Progress: {frame_count}/{total_frames}", file=sys.stderr)
    
    cap.release()
    pose.close()
    
    # Find exercise range
    start_frame, end_frame = find_exercise_range(frames_data, min_movement_threshold)
    
    if start_frame is None or end_frame is None:
        print("Warning: Could not find exercise motion, using full video", file=sys.stderr)
        start_frame = 0
        end_frame = total_frames - 1
    
    start_time = start_frame / fps
    end_time = end_frame / fps
    duration = end_time - start_time
    
    print(f"Detected: {start_frame}→{end_frame} ({start_time:.2f}s→{end_time:.2f}s, {duration:.2f}s)", file=sys.stderr)
    
    return {
        'start_frame': int(start_frame),
        'end_frame': int(end_frame),
        'start_time': float(start_time),
        'end_time': float(end_time),
        'duration': float(duration),
        'total_frames': int(total_frames),
        'fps': float(fps)
    }


def calculate_movement(pose_landmarks):
    """
    Calculate movement magnitude from pose landmarks.
    Uses extremities (arms, legs, torso) to detect exercise motion.
    
    Mediapipe pose landmarks: 0-32
    Key points for exercise detection:
    - Shoulders: 11, 12
    - Elbows: 13, 14
    - Wrists: 15, 16
    - Hips: 23, 24
    - Knees: 25, 26
    - Ankles: 27, 28
    """
    if not pose_landmarks or len(pose_landmarks) == 0:
        return 0.0
    
    # Key joint indices for upper + lower body movement
    key_indices = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
    
    movements = []
    for idx in key_indices:
        if idx < len(pose_landmarks):
            lm = pose_landmarks[idx]
            # Combine x, y, z movement with confidence weighting
            if lm.visibility > 0.5:  # Only count visible joints
                joint_movement = (abs(lm.x) + abs(lm.y)) * lm.z
                movements.append(joint_movement)
    
    return float(np.mean(movements)) if movements else 0.0


def find_exercise_range(frames_data, min_threshold=0.08):
    """
    Find continuous range of exercise motion.
    Filters out:
    - Beginning: Setup/adjustment phase (low movement)
    - End: Cool-down or wind-down (fading movement)
    """
    if not frames_data:
        return None, None
    
    smoothed_movements = [f['smoothed'] for f in frames_data]
    
    # Find frames above threshold
    active_indices = [i for i, m in enumerate(smoothed_movements) if m > min_threshold]
    
    if not active_indices:
        print(f"Warning: No frames above threshold {min_threshold}", file=sys.stderr)
        return 0, len(frames_data) - 1
    
    # Get first and last active frame
    start_idx = active_indices[0]
    end_idx = active_indices[-1]
    
    # Look back/forward a few frames to catch motion start/stop smoothly
    start_idx = max(0, start_idx - 5)
    end_idx = min(len(frames_data) - 1, end_idx + 5)
    
    return start_idx, end_idx


if __name__ == '__main__':
    if len(sys.argv) < 2:
        error = {
            'error': 'Missing video_path argument',
            'usage': 'python detect_exercise_lambda.py <video_path>'
        }
        print(json.dumps(error))
        sys.exit(1)
    
    video_path = sys.argv[1]
    
    try:
        result = detect_exercise_range(video_path)
        print(json.dumps(result))
    except Exception as e:
        error = {
            'error': str(e),
            'video_path': video_path
        }
        print(json.dumps(error), file=sys.stderr)
        sys.exit(1)
