import { useState, useEffect, useRef } from 'react';
import { FlaskConical, Play, Search, CheckCircle, XCircle, Loader2, ChevronDown } from 'lucide-react';

interface Exercise { id: string; name: string; category: string; }
interface CameraAngle { id: string; name: string; }

interface PromptMeta {
  imagePromptLength: number;
  videoPromptLength: number;
  imagePromptBudget: number;
  videoPromptBudget: number;
  imagePromptOk: boolean;
  videoPromptOk: boolean;
  exerciseName: string;
  cameraAngle: string;
  checks: {
    shirtless: boolean;
    logo: boolean;
    whiteBackground: boolean;
    seamlessContinuity: boolean;
    tenSeconds: boolean;
    fourReps: boolean;
  };
}

interface PromptResult {
  imagePrompt: string;
  videoPrompt: string;
  meta: PromptMeta;
}

const CHECK_LABELS: Record<keyof PromptMeta['checks'], string> = {
  shirtless: 'Sin camiseta',
  logo: 'Logo en muslo',
  whiteBackground: 'Fondo blanco',
  seamlessContinuity: 'Sin cortes',
  tenSeconds: '10 segundos',
  fourReps: '4 repeticiones',
};

function CharBar({ length, budget, ok }: { length: number; budget: number; ok: boolean }) {
  const pct = Math.min((length / budget) * 100, 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex-1 h-1.5 bg-dark-bg rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${ok ? 'bg-neon-green' : 'bg-red-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={ok ? 'text-zinc-400' : 'text-red-400'}>
        {length} / {budget}
      </span>
    </div>
  );
}

function PromptCard({
  title,
  subtitle,
  color,
  prompt,
  length,
  budget,
  ok,
}: {
  title: string;
  subtitle: string;
  color: string;
  prompt: string;
  length: number;
  budget: number;
  ok: boolean;
}) {
  return (
    <div className="flex flex-col bg-dark-surface border border-dark-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className={`px-5 py-4 border-b border-dark-border`}>
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs font-bold uppercase tracking-widest ${color}`}>{title}</span>
          {ok
            ? <span className="flex items-center gap-1 text-neon-green text-xs"><CheckCircle className="w-3.5 h-3.5" /> OK</span>
            : <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle className="w-3.5 h-3.5" /> Demasiado largo</span>
          }
        </div>
        <p className="text-zinc-500 text-xs">{subtitle}</p>
        <div className="mt-2">
          <CharBar length={length} budget={budget} ok={ok} />
        </div>
      </div>
      {/* Prompt text */}
      <div className="flex-1 p-5 overflow-y-auto max-h-[520px]">
        <pre className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap font-mono">{prompt}</pre>
      </div>
    </div>
  );
}

export default function PromptTester() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [angles, setAngles] = useState<CameraAngle[]>([]);
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [selectedAngleId, setSelectedAngleId] = useState('');
  const [observations, setObservations] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PromptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/exercises').then(r => r.json()).then(d => setExercises(Array.isArray(d) ? d : [])).catch(console.error);
    fetch('/api/angles').then(r => r.json()).then((d: unknown) => {
      const list = Array.isArray(d) ? (d as CameraAngle[]) : [];
      setAngles(list);
      if (list.length > 0) setSelectedAngleId(list[0].id);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!exerciseQuery.trim()) { setFilteredExercises([]); setShowDropdown(false); return; }
    const q = exerciseQuery.toLowerCase();
    setFilteredExercises(exercises.filter(e => e.name.toLowerCase().includes(q)).slice(0, 8));
    setShowDropdown(true);
  }, [exerciseQuery, exercises]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleRun() {
    if (!selectedExercise || !selectedAngleId) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/test-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercise_id: selectedExercise.id, angle_id: selectedAngleId, user_observations: observations }),
      });
      const data = await res.json() as PromptResult & { error?: string };
      if (!res.ok) { setError(data.error ?? 'Error desconocido'); return; }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red');
    } finally {
      setLoading(false);
    }
  }

  const checks = result?.meta.checks;

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-dark-surface border border-dark-border rounded-xl flex items-center justify-center">
          <FlaskConical className="w-5 h-5 text-neon-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Test de Prompts</h1>
          <p className="text-zinc-500 text-sm">Genera y revisa los prompts sin gastar créditos en imágenes ni vídeo</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-dark-surface border border-dark-border rounded-2xl p-5 flex flex-col sm:flex-row gap-4 items-end">
        {/* Exercise search */}
        <div className="flex-1 min-w-0" ref={dropdownRef}>
          <label className="block text-xs text-zinc-500 mb-1.5 font-medium uppercase tracking-wider">Ejercicio</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={exerciseQuery}
              onChange={e => setExerciseQuery(e.target.value)}
              placeholder="Buscar ejercicio..."
              className="w-full pl-9 pr-4 py-2.5 bg-dark-bg border border-dark-border rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-neon-blue/50"
            />
            {showDropdown && filteredExercises.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-dark-surface border border-dark-border rounded-xl overflow-hidden z-30 shadow-xl">
                {filteredExercises.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => { setSelectedExercise(ex); setExerciseQuery(ex.name); setShowDropdown(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-neon-blue/10 hover:text-neon-blue transition-colors"
                  >
                    {ex.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedExercise && (
            <p className="mt-1 text-xs text-neon-blue/70">✓ {selectedExercise.name}</p>
          )}
        </div>

        {/* Angle selector */}
        <div className="w-52">
          <label className="block text-xs text-zinc-500 mb-1.5 font-medium uppercase tracking-wider">Ángulo de cámara</label>
          <div className="relative">
            <select
              value={selectedAngleId}
              onChange={e => setSelectedAngleId(e.target.value)}
              className="w-full appearance-none px-4 py-2.5 pr-9 bg-dark-bg border border-dark-border rounded-xl text-sm text-white focus:outline-none focus:border-neon-blue/50"
            >
              {angles.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          </div>
        </div>

        {/* Observations */}
        <div className="flex-1 min-w-0">
          <label className="block text-xs text-zinc-500 mb-1.5 font-medium uppercase tracking-wider">Observaciones (opcional)</label>
          <input
            type="text"
            value={observations}
            onChange={e => setObservations(e.target.value)}
            placeholder="ej. énfasis en control excéntrico..."
            className="w-full px-4 py-2.5 bg-dark-bg border border-dark-border rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-neon-blue/50"
          />
        </div>

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={!selectedExercise || !selectedAngleId || loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-neon-blue/10 border border-neon-blue/30 text-neon-blue rounded-xl font-semibold text-sm hover:bg-neon-blue/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</>
            : <><Play className="w-4 h-4" /> Run</>
          }
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Checks summary */}
      {result && checks && (
        <div className="bg-dark-surface border border-dark-border rounded-2xl px-5 py-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-3">Verificaciones clave</p>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(checks) as [keyof typeof checks, boolean][]).map(([key, ok]) => (
              <span
                key={key}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                  ok
                    ? 'bg-neon-green/10 border-neon-green/20 text-neon-green'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}
              >
                {ok ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                {CHECK_LABELS[key]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 3-column prompt display */}
      {result && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <PromptCard
            title="Imagen 1 — GPT Image 1.5"
            subtitle="Genera la pose, fondo blanco y logo en el pantalón"
            color="text-neon-green"
            prompt={result.imagePrompt}
            length={result.meta.imagePromptLength}
            budget={result.meta.imagePromptBudget}
            ok={result.meta.imagePromptOk}
          />
          <PromptCard
            title="Imagen 2 — Flux Kontext"
            subtitle="Face swap usando la foto de referencia del modelo"
            color="text-yellow-400"
            prompt={"[Prompt fijo — no generado por Claude]\n\nIMAGEN 1 (inputImages[0]): foto generada del ejercicio\nIMAGEN 2 (inputImages[1]): foto de referencia del modelo\n\nAcción: extrae la cara/cabeza/pelo de la IMAGEN 2 y reemplaza\nla cara del atleta en la IMAGEN 1. Todo lo demás (pose,\nequipamiento, fondo, logo en pantalón) se preserva intacto."}
            length={0}
            budget={2950}
            ok={true}
          />
          <PromptCard
            title="Vídeo — Seedance 2.0"
            subtitle="Anima 4 repeticiones continuas en 10 segundos"
            color="text-neon-blue"
            prompt={result.videoPrompt}
            length={result.meta.videoPromptLength}
            budget={result.meta.videoPromptBudget}
            ok={result.meta.videoPromptOk}
          />
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <FlaskConical className="w-12 h-12 text-zinc-700 mb-4" />
          <p className="text-zinc-500 text-sm">Selecciona un ejercicio y un ángulo, luego pulsa <strong className="text-zinc-400">Run</strong></p>
          <p className="text-zinc-600 text-xs mt-1">Claude generará los prompts — sin gastar créditos KIE</p>
        </div>
      )}
    </div>
  );
}
