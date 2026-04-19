#!/bin/bash
set -e

echo "📦 Building Split Lambda Layers Strategy"
echo "========================================"

# Layer 1: MediaPipe + NumPy (Foundation)
echo -e "\n🔵 LAYER 1: MediaPipe Foundation"
mkdir -p layer1/opt/python/lib/python3.11/site-packages
cd layer1/opt/python/lib/python3.11/site-packages

# Create symlinks from original (faster than copy)
ln -s /Users/tomas/Downloads/DOCUMENTOS/MotionREP/layer-build/opt/python/lib/python3.11/site-packages/mediapipe . 2>/dev/null || cp -r /Users/tomas/Downloads/DOCUMENTOS/MotionREP/layer-build/opt/python/lib/python3.11/site-packages/mediapipe .
cp -r /Users/tomas/Downloads/DOCUMENTOS/MotionREP/layer-build/opt/python/lib/python3.11/site-packages/numpy . 2>/dev/null || true
cp -r /Users/tomas/Downloads/DOCUMENTOS/MotionREP/layer-build/opt/python/lib/python3.11/site-packages/absl . 2>/dev/null || true
cp -r /Users/tomas/Downloads/DOCUMENTOS/MotionREP/layer-build/opt/python/lib/python3.11/site-packages/flatbuffers . 2>/dev/null || true
cp -r /Users/tomas/Downloads/DOCUMENTOS/MotionREP/layer-build/opt/python/lib/python3.11/site-packages/protobuf.* . 2>/dev/null || true
cp /Users/tomas/Downloads/DOCUMENTOS/MotionREP/layer-build/opt/python/lib/python3.11/site-packages/protobuf.py . 2>/dev/null || true

cd /Users/tomas/Downloads/DOCUMENTOS/MotionREP/layer-build

du -sh layer1/opt/
zip -r -q lambda-layer-1-foundation.zip layer1/opt/
ls -lh lambda-layer-1-foundation.zip

# Layer 2: OpenCV + FFmpeg + Requests
echo -e "\n🟢 LAYER 2: Processing Tools"
mkdir -p layer2/opt/bin layer2/opt/python/lib/python3.11/site-packages

# Copy OpenCV
cp -r /Users/tomas/Downloads/DOCUMENTOS/MotionREP/layer-build/opt/python/lib/python3.11/site-packages/cv2 layer2/opt/python/lib/python3.11/site-packages/ 2>/dev/null || true

# Copy requests and pytube
cp -r /Users/tomas/Downloads/DOCUMENTOS/MotionREP/layer-build/opt/python/lib/python3.11/site-packages/requests layer2/opt/python/lib/python3.11/site-packages/ 2>/dev/null || true
cp -r /Users/tomas/Downloads/DOCUMENTOS/MotionREP/layer-build/opt/python/lib/python3.11/site-packages/pytube layer2/opt/python/lib/python3.11/site-packages/ 2>/dev/null || true
cp -r /Users/tomas/Downloads/DOCUMENTOS/MotionREP/layer-build/opt/python/lib/python3.11/site-packages/chardet layer2/opt/python/lib/python3.11/site-packages/ 2>/dev/null || true
cp -r /Users/tomas/Downloads/DOCUMENTOS/MotionREP/layer-build/opt/python/lib/python3.11/site-packages/urllib3 layer2/opt/python/lib/python3.11/site-packages/ 2>/dev/null || true
cp -r /Users/tomas/Downloads/DOCUMENTOS/MotionREP/layer-build/opt/python/lib/python3.11/site-packages/idna layer2/opt/python/lib/python3.11/site-packages/ 2>/dev/null || true
cp -r /Users/tomas/Downloads/DOCUMENTOS/MotionREP/layer-build/opt/python/lib/python3.11/site-packages/certifi layer2/opt/python/lib/python3.11/site-packages/ 2>/dev/null || true

# Copy google dependencies (used by mediapipe)
cp -r /Users/tomas/Downloads/DOCUMENTOS/MotionREP/layer-build/opt/python/lib/python3.11/site-packages/google layer2/opt/python/lib/python3.11/site-packages/ 2>/dev/null || true

# Copy FFmpeg (if exists in opt/bin)
if [ -f /Users/tomas/Downloads/DOCUMENTOS/MotionREP/layer-build/opt/bin/ffmpeg ]; then
  cp /Users/tomas/Downloads/DOCUMENTOS/MotionREP/layer-build/opt/bin/ffmpeg layer2/opt/bin/
fi

du -sh layer2/opt/
zip -r -q lambda-layer-2-tools.zip layer2/opt/
ls -lh lambda-layer-2-tools.zip

echo -e "\n✓ Split layers complete!"
unzip -l lambda-layer-1-foundation.zip | tail -1
unzip -l lambda-layer-2-tools.zip | tail -1

