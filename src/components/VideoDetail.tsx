import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Download, Loader2, AlertCircle, Camera,
  AlignLeft, Terminal, ChevronDown, ChevronUp, Link, CheckCircle,
} from 'lucide-react';

interface Generation {
  id: string;
  status: 'pending' | 'prompting' | 'image_done' | 'animating' | 'completed' | 'failed';
  image_url?: string;
  video_url?: string;
  error_message?: string;
  final_prompt_used?: string;
  user_observations?: string;
  created_at: string;
  exercises?: { name: string; category: string };
  camera_angles?: { name: string };
}

export default function VideoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [gen, setGen] = useState<Generation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/generate/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('Generación no encontrada');
        return r.json();
      })
      .then((data: Generation) => { setGen(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [id]);

  const handleDownload = () => {
    if (!gen?.video_url) return;
    const a = document.createElement('a');
    a.href = gen.video_url;
    a.download = `${gen.exercises?.name ?? 'video'}.mp4`;
    a.target = '_blank';
    a.click();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const formatDate = (str: string) =>
    new Date(str).toLocaleString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 text-neon-green animate-spin" />
    </div>
  );

  if (error || !gen) return (
    <div className="space-y-4">
      <button onClick={() => navigate('/base')} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm">
        <ArrowLeft className="w-4 h-4" /> Volver a Base de Datos
      </button>
      <div className="flex items-center gap-3 text-red-400 bg-red-900/20 border border-red-800/40 rounded-2xl p-6">
        <AlertCircle className="w-6 h-6 flex-shrink-0" /> {error ?? 'Generación no encontrada'}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => navigate('/base')} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm mb-3">
            <ArrowLeft className="w-4 h-4" /> Volver a Base de Datos
          </button>
          <h1 className="text-3xl font-bold tracking-tight">{gen.exercises?.name ?? 'Ejercicio'}</h1>
          <p className="text-zinc-400 mt-1 text-sm">
            {formatDate(gen.created_at)} · {gen.exercises?.category}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-4 py-2 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors"
          >
            {copied ? <CheckCircle className="w-4 h-4 text-neon-green" /> : <Link className="w-4 h-4" />}
            {copied ? '¡Copiado!' : 'Copiar enlace'}
          </button>
          <button
            onClick={handleDownload}
            disabled={!gen.video_url}
            className="flex items-center gap-2 px-4 py-2 bg-neon-green text-black font-bold rounded-xl text-sm hover:bg-[#00e65c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" /> Descargar vídeo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video / Preview — takes 2/3 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-dark-surface border border-dark-border rounded-2xl overflow-hidden aspect-video flex items-center justify-center">
            {gen.status === 'completed' && gen.video_url ? (
              <video
                controls
                autoPlay
                loop
                muted
                className="w-full h-full object-contain"
                src={gen.video_url}
              />
            ) : gen.image_url ? (
              <img src={gen.image_url} alt={gen.exercises?.name} className="w-full h-full object-contain opacity-80" />
            ) : gen.status === 'failed' ? (
              <div className="text-center p-6">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <p className="text-red-400 font-medium">Error en la generación</p>
                <p className="text-zinc-500 text-sm mt-1">{gen.error_message ?? 'Inténtalo de nuevo'}</p>
              </div>
            ) : (
              <div className="text-center">
                <Loader2 className="w-10 h-10 text-neon-green animate-spin mx-auto mb-3" />
                <p className="text-zinc-400 text-sm">Generando...</p>
              </div>
            )}
          </div>

          {/* Prompt panel */}
          {gen.final_prompt_used && (
            <div className="border border-dark-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPrompt(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-dark-surface hover:bg-dark-bg transition-colors text-xs"
              >
                <span className="flex items-center gap-2 text-zinc-400 font-semibold uppercase tracking-wider">
                  <Terminal className="w-3 h-3" /> Prompt generado por Claude
                </span>
                {showPrompt ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
              </button>
              {showPrompt && (
                <pre className="px-4 py-3 text-xs text-zinc-400 font-mono whitespace-pre-wrap leading-relaxed bg-[#050505] border-t border-dark-border max-h-64 overflow-y-auto">
                  {gen.final_prompt_used}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Metadata panel — takes 1/3 */}
        <div className="space-y-4">
          {/* Status */}
          <div className="bg-dark-surface border border-dark-border rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Estado</h3>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
              gen.status === 'completed'
                ? 'bg-neon-green/20 text-neon-green border border-neon-green/30'
                : gen.status === 'failed'
                  ? 'bg-red-900/30 text-red-400 border border-red-800/30'
                  : 'bg-yellow-900/30 text-yellow-400 border border-yellow-800/30'
            }`}>
              {gen.status === 'completed' ? '✓ Completado'
                : gen.status === 'failed' ? '✗ Error'
                : '⏳ En proceso'}
            </span>
          </div>

          {/* Angle */}
          <div className="bg-dark-surface border border-dark-border rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" /> Ángulo de Cámara
            </h3>
            <p className="text-white font-medium">{gen.camera_angles?.name ?? '—'}</p>
          </div>

          {/* Observations */}
          <div className="bg-dark-surface border border-dark-border rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <AlignLeft className="w-3.5 h-3.5" /> Observaciones
            </h3>
            <p className="text-zinc-300 text-sm leading-relaxed">
              {gen.user_observations?.trim() ? gen.user_observations : <span className="text-zinc-600 italic">Sin observaciones</span>}
            </p>
          </div>

          {/* Unique URL */}
          <div className="bg-dark-surface border border-dark-border rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5" /> URL única
            </h3>
            <p className="text-zinc-500 text-xs font-mono break-all leading-relaxed">{window.location.href}</p>
            <button
              onClick={handleCopyLink}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 bg-dark-bg hover:bg-zinc-800 border border-dark-border rounded-lg text-xs text-zinc-300 transition-colors"
            >
              {copied ? <CheckCircle className="w-3.5 h-3.5 text-neon-green" /> : <Link className="w-3.5 h-3.5" />}
              {copied ? '¡Enlace copiado!' : 'Copiar enlace'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
