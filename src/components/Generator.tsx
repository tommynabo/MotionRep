import { useState, useEffect, useRef, FormEvent } from 'react';
import { Search, Video, Sparkles, Loader2, Camera, AlignLeft, CheckCircle, AlertCircle } from 'lucide-react';

interface Exercise { id: string; name: string; category: string; }
interface CameraAngle { id: string; name: string; }
type GenerationStatus = 'pending' | 'image_done' | 'completed' | 'failed';
interface GenerationResult { id: string; status: GenerationStatus; image_url?: string; video_url?: string; error_message?: string; }

const POLL_INTERVAL = 4000; // ms

export default function Generator() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [angles, setAngles] = useState<CameraAngle[]>([]);
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [selectedAngleId, setSelectedAngleId] = useState('');
  const [observations, setObservations] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<0 | 1 | 2>(0);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load exercises and angles on mount
  useEffect(() => {
    fetch('/api/exercises').then(r => r.json()).then(setExercises).catch(console.error);
    fetch('/api/angles').then(r => r.json()).then((data: CameraAngle[]) => {
      setAngles(data);
      if (data.length > 0) setSelectedAngleId(data[0].id);
    }).catch(console.error);
  }, []);

  // Filter exercises as user types
  useEffect(() => {
    if (!exerciseQuery.trim()) { setFilteredExercises([]); setShowDropdown(false); return; }
    const q = exerciseQuery.toLowerCase();
    setFilteredExercises(exercises.filter(e => e.name.toLowerCase().includes(q)).slice(0, 8));
    setShowDropdown(true);
  }, [exerciseQuery, exercises]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Poll generation status
  const startPolling = (id: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/generate/${id}`);
        const data: GenerationResult = await res.json();
        setResult(data);
        if (data.status === 'image_done') setGenerationStep(2);
        if (data.status === 'completed' || data.status === 'failed') {
          stopPolling();
          setIsGenerating(false);
          setGenerationStep(0);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, POLL_INTERVAL);
  };

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  useEffect(() => () => stopPolling(), []);

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedExercise || !selectedAngleId) return;
    setApiError(null);
    setResult(null);
    setIsGenerating(true);
    setGenerationStep(1);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercise_id: selectedExercise.id, angle_id: selectedAngleId, user_observations: observations }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al iniciar la generación');
      setResult({ id: data.generation_id, status: 'pending' });
      startPolling(data.generation_id);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Error desconocido');
      setIsGenerating(false);
      setGenerationStep(0);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Generador de Vídeos IA</h1>
        <p className="text-zinc-400 mt-2">Configura los parámetros para generar un nuevo ejercicio.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 shadow-lg">
            <form onSubmit={handleGenerate} className="space-y-6">

              {/* Exercise search with autocomplete */}
              <div className="space-y-2" ref={dropdownRef}>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <Search className="w-3 h-3" /> Buscar Ejercicio
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={exerciseQuery}
                    onChange={e => { setExerciseQuery(e.target.value); setSelectedExercise(null); }}
                    placeholder="Ej. Curl de Bíceps, Sentadilla..."
                    className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-neon-green focus:border-neon-green transition-colors"
                  />
                  {showDropdown && filteredExercises.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-dark-surface border border-dark-border rounded-xl shadow-xl overflow-hidden">
                      {filteredExercises.map(ex => (
                        <button key={ex.id} type="button"
                          className="w-full text-left px-4 py-2.5 hover:bg-dark-bg transition-colors"
                          onClick={() => { setSelectedExercise(ex); setExerciseQuery(ex.name); setShowDropdown(false); }}
                        >
                          <span className="text-white text-sm font-medium">{ex.name}</span>
                          <span className="ml-2 text-xs text-zinc-500">{ex.category}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedExercise && (
                  <p className="text-xs text-neon-green flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {selectedExercise.name} seleccionado</p>
                )}
              </div>

              {/* Camera angle select (dynamic) */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <Camera className="w-3 h-3" /> Ángulo de Cámara
                </label>
                <div className="relative">
                  <select
                    value={selectedAngleId}
                    onChange={e => setSelectedAngleId(e.target.value)}
                    className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-xl text-white appearance-none focus:outline-none focus:ring-1 focus:ring-neon-green focus:border-neon-green transition-colors"
                  >
                    {angles.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-zinc-500">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                  </div>
                </div>
              </div>

              {/* Observations */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <AlignLeft className="w-3 h-3" /> Observaciones Técnicas <span className="text-zinc-600 lowercase">(Opcional)</span>
                </label>
                <textarea
                  rows={4}
                  value={observations}
                  onChange={e => setObservations(e.target.value)}
                  placeholder="Ej. Mantener espalda recta, bajar lento..."
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-neon-green focus:border-neon-green transition-colors resize-none"
                />
              </div>

              {apiError && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{apiError}
                </div>
              )}

              <button
                type="submit"
                disabled={isGenerating || !selectedExercise || !selectedAngleId}
                className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl text-sm font-bold text-black bg-neon-green hover:bg-[#00e65c] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-bg focus:ring-neon-green transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(0,255,102,0.3)] mt-4"
              >
                {isGenerating ? (<><Loader2 className="w-5 h-5 animate-spin" />Procesando...</>) : (<><Sparkles className="w-5 h-5" />Generar Vídeo</>)}
              </button>
            </form>
          </div>
        </div>

        {/* Preview Column */}
        <div className="lg:col-span-7">
          <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 shadow-lg h-full min-h-[500px] flex flex-col">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Video className="w-4 h-4" /> Vista Previa
            </h3>

            <div className="flex-1 bg-dark-bg border border-dark-border border-dashed rounded-xl flex flex-col items-center justify-center relative overflow-hidden">
              {/* Idle state */}
              {!isGenerating && !result && (
                <div className="text-center p-6">
                  <div className="w-16 h-16 bg-dark-surface rounded-full flex items-center justify-center mx-auto mb-4 border border-dark-border">
                    <Video className="w-6 h-6 text-zinc-600" />
                  </div>
                  <p className="text-zinc-500 font-medium">Esperando configuración...</p>
                  <p className="text-zinc-600 text-sm mt-1">Rellena el formulario para generar un vídeo.</p>
                </div>
              )}

              {/* Loading overlay */}
              {isGenerating && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-bg/80 backdrop-blur-sm z-10">
                  <div className="relative w-24 h-24 mb-6">
                    <div className="absolute inset-0 rounded-full border-t-2 border-neon-green animate-spin"></div>
                    <div className="absolute inset-2 rounded-full border-r-2 border-neon-blue animate-spin animation-delay-150"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-neon-green animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-3 text-center w-full max-w-xs">
                    <div className={`transition-opacity duration-300 ${generationStep >= 1 ? 'opacity-100' : 'opacity-30'}`}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-300">1. Generando Imagen base...</span>
                        {generationStep > 1 && <span className="text-neon-green">✓</span>}
                      </div>
                      <div className="h-1 w-full bg-dark-surface rounded-full mt-2 overflow-hidden">
                        <div className={`h-full bg-neon-green transition-all duration-[20000ms] ease-out ${generationStep >= 1 ? 'w-full' : 'w-0'}`} />
                      </div>
                    </div>
                    <div className={`transition-opacity duration-300 ${generationStep >= 2 ? 'opacity-100' : 'opacity-30'}`}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-300">2. Animando Vídeo...</span>
                      </div>
                      <div className="h-1 w-full bg-dark-surface rounded-full mt-2 overflow-hidden">
                        <div className={`h-full bg-neon-blue transition-all duration-[60000ms] ease-out ${generationStep >= 2 ? 'w-full' : 'w-0'}`} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Completed: show video */}
              {result?.status === 'completed' && result.video_url && (
                <div className="w-full h-full flex flex-col">
                  <video controls autoPlay loop className="w-full h-full object-contain rounded-xl" src={result.video_url} />
                </div>
              )}

              {/* Image done: show image while video generates */}
              {result?.status === 'image_done' && result.image_url && !isGenerating && (
                <img src={result.image_url} alt="Generated pose" className="w-full h-full object-contain rounded-xl opacity-80" />
              )}

              {/* Failed state */}
              {result?.status === 'failed' && (
                <div className="text-center p-6">
                  <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                  <p className="text-red-400 font-medium">Error en la generación</p>
                  <p className="text-zinc-500 text-sm mt-1">{result.error_message ?? 'Inténtalo de nuevo'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
