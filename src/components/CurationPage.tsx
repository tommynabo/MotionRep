import React, { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, AlertCircle, CheckCircle } from 'lucide-react';

interface Exercise {
  id: string;
  name: string;
  equipment?: string;
}

interface CameraAngle {
  id: string;
  name: string;
}

interface YouTubeCandidate {
  videoId: string;
  title: string;
  thumbnail: string;
  youtubeUrl: string;
}

export function CurationPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [angles, setAngles] = useState<CameraAngle[]>([]);
  
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [selectedAngleId, setSelectedAngleId] = useState('');
  
  const [candidates, setCandidates] = useState<YouTubeCandidate[]>([]);
  const [approvedVideo, setApprovedVideo] = useState<YouTubeCandidate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load exercises and angles on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [exRes, anRes] = await Promise.all([
          fetch('/api/exercises'),
          fetch('/api/angles'),
        ]);
        
        if (!exRes.ok || !anRes.ok) throw new Error('Failed to load data');
        
        const exData = await exRes.json();
        const anData = await anRes.json();
        
        setExercises(Array.isArray(exData) ? exData : []);
        setAngles(Array.isArray(anData) ? anData : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      }
    };
    
    loadData();
  }, []);

  const handleSearchCandidates = async () => {
    if (!selectedExerciseId) {
      setError('Select an exercise first');
      return;
    }
    
    setLoading(true);
    setError('');
    setCandidates([]);
    setApprovedVideo(null);
    
    try {
      const res = await fetch(`/api/exercises/${selectedExerciseId}/search-candidates`, {
        method: 'POST',
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Search failed');
      }
      
      const { candidates } = await res.json();
      setCandidates(candidates || []);
      
      if (!candidates || candidates.length === 0) {
        setError('No CC-BY videos found for this exercise');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveCandidates = async (candidate: YouTubeCandidate) => {
    if (!selectedExerciseId) {
      setError('No exercise selected');
      return;
    }
    
    try {
      const res = await fetch(`/api/exercises/${selectedExerciseId}/approve-video`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl: candidate.youtubeUrl }),
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Approval failed');
      }
      
      const selectedExercise = exercises.find(e => e.id === selectedExerciseId);
      setApprovedVideo(candidate);
      setSuccess(`✅ Video aprobado para ${selectedExercise?.name}`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    }
  };

  const handleRejectCandidate = (videoId: string) => {
    setCandidates(prev => prev.filter(c => c.videoId !== videoId));
  };

  const selectedExercise = exercises.find(e => e.id === selectedExerciseId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">📹 Video Curation</h1>
          <p className="text-slate-600">Find and approve Creative Commons exercise videos as motion reference</p>
        </div>

        {/* Error Toast */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-red-800">{error}</div>
          </div>
        )}

        {/* Success Toast */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-green-800">{success}</div>
          </div>
        )}

        {/* Search Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Exercise
              </label>
              <select
                value={selectedExerciseId}
                onChange={(e) => setSelectedExerciseId(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose an exercise...</option>
                {exercises.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Camera Angle (optional)
              </label>
              <select
                value={selectedAngleId}
                onChange={(e) => setSelectedAngleId(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Any angle...</option>
                {angles.map(an => (
                  <option key={an.id} value={an.id}>{an.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleSearchCandidates}
            disabled={!selectedExerciseId || loading}
            className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Searching...' : 'BUSCAR 5 VÍDEOS'}
          </button>
        </div>

        {/* Candidates Grid */}
        {candidates.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              {candidates.length} Candidatos Encontrados
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {candidates.map((candidate) => (
                <div key={candidate.videoId} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition">
                  {/* Thumbnail */}
                  <div className="relative w-full aspect-video bg-slate-200 overflow-hidden">
                    <img
                      src={candidate.thumbnail}
                      alt={candidate.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Title */}
                  <div className="p-3">
                    <p className="text-sm font-medium text-slate-900 line-clamp-2">
                      {candidate.title}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="p-3 border-t border-slate-200 flex gap-2">
                    <button
                      onClick={() => handleApproveCandidates(candidate)}
                      className="flex-1 px-3 py-2 bg-green-100 text-green-700 font-semibold rounded-lg hover:bg-green-200 transition flex items-center justify-center gap-1"
                      title="Approve this video"
                    >
                      <ThumbsUp className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectCandidate(candidate.videoId)}
                      className="flex-1 px-3 py-2 bg-red-100 text-red-700 font-semibold rounded-lg hover:bg-red-200 transition flex items-center justify-center gap-1"
                      title="Reject this video"
                    >
                      <ThumbsDown className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approved Video Display */}
        {approvedVideo && (
          <div className="bg-white rounded-lg shadow-sm border border-green-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-bold text-green-700">Video Aprobado</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <img
                  src={approvedVideo.thumbnail}
                  alt="Approved"
                  className="w-full rounded-lg border border-slate-200"
                />
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-slate-600 mb-2">
                  <strong>Título:</strong> {approvedVideo.title}
                </p>
                <p className="text-sm text-slate-600 mb-4">
                  <strong>URL:</strong>{' '}
                  <a
                    href={approvedVideo.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all"
                  >
                    {approvedVideo.youtubeUrl}
                  </a>
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Ejercicio:</strong> {selectedExercise?.name}
                </p>
                <p className="text-sm text-green-600 mt-4">
                  ✅ Listo para usar en el Generador de Vídeos
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
