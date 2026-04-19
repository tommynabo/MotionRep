import React, { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, AlertCircle, CheckCircle, Play, X, Search, Camera, Loader2 } from 'lucide-react';

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

interface ApprovedVideoResponse {
  id: string;
  name: string;
  reference_video_url: string;
  reference_video_duration: number | null;
  reference_video_start_time?: number | null;
  reference_video_end_time?: number | null;
  processingInfo?: {
    originalUrl: string;
    processedUrl: string;
    detectedRange: { duration: number; startTime: number; endTime: number } | null;
    fallbackMode: boolean;
    processingQueued: boolean;
    message: string;
  };
}

export function CurationPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [angles, setAngles] = useState<CameraAngle[]>([]);
  
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [selectedAngleId, setSelectedAngleId] = useState('');
  
  const [candidates, setCandidates] = useState<YouTubeCandidate[]>([]);
  const [approvedVideo, setApprovedVideo] = useState<YouTubeCandidate | null>(null);
  const [approvedVideoResponse, setApprovedVideoResponse] = useState<ApprovedVideoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedVideoPreview, setSelectedVideoPreview] = useState<YouTubeCandidate | null>(null);

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
    setApprovedVideoResponse(null);
    
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
      
      const dbResponse = await res.json() as ApprovedVideoResponse;
      const selectedExercise = exercises.find(e => e.id === selectedExerciseId);
      
      // Keep the candidate for display (title, thumbnail)
      setApprovedVideo(candidate);
      // Store the DB response (includes timing data and processing info)
      setApprovedVideoResponse(dbResponse);
      
      // Show status message
      const statusMsg = dbResponse.processingInfo?.fallbackMode
        ? `✅ Video aprobado para ${selectedExercise?.name} (URL fallback)`
        : `✅ Video aprobado para ${selectedExercise?.name} (procesado y cortado)`;
      
      setSuccess(statusMsg);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    }
  };

  const handleRejectCandidate = (videoId: string) => {
    setCandidates(prev => prev.filter(c => c.videoId !== videoId));
  };

  const selectedExercise = exercises.find(e => e.id === selectedExerciseId);

  // Clear success toast after 4 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Video Curation</h1>
        <p className="text-zinc-400 mt-2">Find and approve Creative Commons exercise videos as reference for motion transfer</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Search Controls - Left Column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 shadow-lg">
            <form onSubmit={(e) => { e.preventDefault(); handleSearchCandidates(); }} className="space-y-6">
              {/* Exercise select */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <Search className="w-3 h-3" /> Seleccionar Ejercicio
                </label>
                <select
                  value={selectedExerciseId}
                  onChange={(e) => setSelectedExerciseId(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-xl text-white appearance-none focus:outline-none focus:ring-1 focus:ring-neon-green focus:border-neon-green transition-colors"
                >
                  <option value="">Elige un ejercicio...</option>
                  {exercises.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-zinc-500">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                </div>
              </div>

              {/* Camera angle select */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <Camera className="w-3 h-3" /> Ángulo de Cámara (Opcional)
                </label>
                <select
                  value={selectedAngleId}
                  onChange={(e) => setSelectedAngleId(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-xl text-white appearance-none focus:outline-none focus:ring-1 focus:ring-neon-green focus:border-neon-green transition-colors"
                >
                  <option value="">Cualquier ángulo...</option>
                  {angles.map(an => (
                    <option key={an.id} value={an.id}>{an.name}</option>
                  ))}
                </select>
              </div>

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                </div>
              )}

              {/* Search button */}
              <button
                type="submit"
                disabled={!selectedExerciseId || loading}
                className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl text-sm font-bold text-black bg-neon-green hover:bg-[#00e65c] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-bg focus:ring-neon-green transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(0,255,102,0.3)] mt-4"
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Buscando...</>
                ) : (
                  <><Search className="w-5 h-5" /> BUSCAR 5 VÍDEOS</>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Candidates Grid - Right Column */}
        <div className="lg:col-span-7">
          {candidates.length > 0 ? (
            <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 shadow-lg space-y-4 h-full">
              <div>
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                  {candidates.length} Candidatos Encontrados
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2 gap-3">
                  {candidates.map((candidate) => (
                    <div key={candidate.videoId} className="bg-dark-bg border border-dark-border rounded-xl overflow-hidden hover:border-neon-green/50 transition-colors">
                      {/* Thumbnail with play button overlay */}
                      <div className="relative w-full aspect-video bg-dark-bg overflow-hidden cursor-pointer group">
                        <img
                          src={candidate.thumbnail}
                          alt={candidate.title}
                          className="w-full h-full object-cover group-hover:brightness-75 transition-all"
                        />
                        <button
                          onClick={() => setSelectedVideoPreview(candidate)}
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Ver vídeo"
                        >
                          <div className="w-12 h-12 bg-neon-green rounded-full flex items-center justify-center shadow-lg">
                            <Play className="w-6 h-6 text-black fill-black" />
                          </div>
                        </button>
                      </div>

                      {/* Title */}
                      <div className="p-3 border-t border-dark-border">
                        <p className="text-xs font-medium text-zinc-300 line-clamp-2">
                          {candidate.title}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="px-3 pb-3 flex gap-2">
                        <button
                          onClick={() => handleApproveCandidates(candidate)}
                          className="flex-1 px-2 py-2 bg-neon-green/10 text-neon-green text-xs font-semibold rounded-lg hover:bg-neon-green/20 transition flex items-center justify-center gap-1 border border-neon-green/30"
                          title="Aprobar vídeo"
                        >
                          <ThumbsUp className="w-3 h-3" /> Aprobar
                        </button>
                        <button
                          onClick={() => handleRejectCandidate(candidate.videoId)}
                          className="flex-1 px-2 py-2 bg-red-500/10 text-red-400 text-xs font-semibold rounded-lg hover:bg-red-500/20 transition flex items-center justify-center gap-1 border border-red-500/30"
                          title="Rechazar vídeo"
                        >
                          <ThumbsDown className="w-3 h-3" /> Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Approved Video Display */}
              {approvedVideo && approvedVideoResponse && (
                <div className="mt-6 pt-6 border-t border-dark-border space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-neon-green" />
                    <h4 className="text-sm font-bold text-neon-green">Video Aprobado</h4>
                  </div>
                  <div className="bg-dark-bg rounded-lg p-3 border border-neon-green/20 space-y-2">
                    <p className="text-xs text-zinc-400">{approvedVideo.title}</p>
                    <a
                      href={approvedVideo.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-neon-green hover:underline break-all block"
                    >
                      {approvedVideo.youtubeUrl}
                    </a>
                    
                    {/* Processing Status */}
                    <div className="bg-dark-bg/50 rounded p-2 text-xs text-zinc-300 space-y-1">
                      {/* Status Indicator */}
                      {approvedVideoResponse.processingInfo?.processingQueued ? (
                        <p className="font-semibold text-yellow-400 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          ⏳ Procesando en Lambda (1-2 min)
                        </p>
                      ) : approvedVideoResponse.processingInfo?.fallbackMode ? (
                        <p className="font-semibold text-orange-400">
                          ⚠️ Fallback Mode (URL no procesada)
                        </p>
                      ) : (
                        <p className="font-semibold text-neon-green">
                          ✅ Procesado y cortado
                        </p>
                      )}
                      
                      {/* Show timing info if available */}
                      {approvedVideoResponse.reference_video_duration !== null && approvedVideoResponse.reference_video_duration !== undefined && approvedVideoResponse.reference_video_duration > 0 ? (
                        <div className="space-y-0.5">
                          <p>📹 Duración: <span className="text-neon-green">{approvedVideoResponse.reference_video_duration.toFixed(2)}s</span></p>
                          {approvedVideoResponse.reference_video_start_time !== null && approvedVideoResponse.reference_video_start_time !== undefined && (
                            <>
                              <p>▶️ Inicio: <span className="text-neon-green">{approvedVideoResponse.reference_video_start_time.toFixed(2)}s</span></p>
                              <p>⏹️ Fin: <span className="text-neon-green">{(approvedVideoResponse.reference_video_end_time ?? 0).toFixed(2)}s</span></p>
                            </>
                          )}
                        </div>
                      ) : approvedVideoResponse.processingInfo?.processingQueued ? (
                        <p className="text-zinc-400 text-xs">Esperando procesamiento de Lambda...</p>
                      ) : (
                        <p className="text-zinc-400 text-xs">⏳ Timing no disponible (URL completa)</p>
                      )}
                      
                      {approvedVideoResponse.processingInfo?.message && (
                        <p className="text-zinc-400 italic text-xs">{approvedVideoResponse.processingInfo.message}</p>
                      )}
                    </div>
                    
                    <p className="text-xs text-neon-green/70">✅ Listo para el Generador</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 shadow-lg h-full flex flex-col items-center justify-center min-h-[500px]">
              <div className="w-16 h-16 bg-dark-bg rounded-full flex items-center justify-center mb-4 border border-dark-border">
                <Search className="w-6 h-6 text-zinc-600" />
              </div>
              <p className="text-zinc-500 font-medium">Esperando búsqueda...</p>
              <p className="text-zinc-600 text-sm mt-1">Busca vídeos para ver candidatos aquí</p>
            </div>
          )}
        </div>
      </div>

      {/* Success Toast */}
      {success && (
        <div className="fixed bottom-6 right-6 flex items-center gap-3 bg-neon-green/10 border border-neon-green/30 rounded-xl px-4 py-3 text-neon-green text-sm font-medium animate-in slide-in-from-bottom-4">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Video Preview Modal */}
      {selectedVideoPreview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-surface border border-dark-border rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-dark-border">
              <h3 className="text-sm font-bold text-zinc-300 line-clamp-1">{selectedVideoPreview.title}</h3>
              <button
                onClick={() => setSelectedVideoPreview(null)}
                className="p-1.5 hover:bg-dark-bg rounded-lg transition text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Video Player */}
            <div className="bg-black aspect-video flex items-center justify-center">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${selectedVideoPreview.videoId}?autoplay=1`}
                title={selectedVideoPreview.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-dark-border flex gap-3">
              <button
                onClick={() => handleApproveCandidates(selectedVideoPreview)}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-black bg-neon-green hover:bg-[#00e65c] transition-all"
              >
                <ThumbsUp className="w-4 h-4" /> Aprobar este vídeo
              </button>
              <button
                onClick={() => {
                  handleRejectCandidate(selectedVideoPreview.videoId);
                  setSelectedVideoPreview(null);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all"
              >
                <ThumbsDown className="w-4 h-4" /> Rechazar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
