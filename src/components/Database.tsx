import { useState, useEffect } from 'react';
import { Play, Download, RefreshCw, Clock, Loader2, AlertCircle, Trash2 } from 'lucide-react';

interface Generation {
  id: string;
  status: 'pending' | 'image_done' | 'completed' | 'failed';
  image_url?: string;
  video_url?: string;
  created_at: string;
  exercises?: { name: string; category: string };
  camera_angles?: { name: string };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  return `Hace ${Math.floor(hours / 24)} días`;
}

export default function Database() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Generation | null>(null);

  const loadGenerations = () => {
    setLoading(true);
    fetch('/api/generations')
      .then(r => r.json())
      .then((data: unknown) => {
        setGenerations(Array.isArray(data) ? (data as Generation[]) : []);
        setLoading(false);
      })
      .catch(err => { setError(err instanceof Error ? err.message : 'Error de red'); setLoading(false); });
  };

  useEffect(() => { loadGenerations(); }, []);

  const handleDelete = async (id: string) => {
    await fetch(`/api/generations/${id}`, { method: 'DELETE' });
    setGenerations(prev => prev.filter(g => g.id !== id));
    if (selectedVideo?.id === id) setSelectedVideo(null);
  };

  const handleDownload = (url: string, name: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.mp4`;
    a.target = '_blank';
    a.click();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 text-neon-green animate-spin" />
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-3 text-red-400 bg-red-900/20 border border-red-800/40 rounded-2xl p-6">
      <AlertCircle className="w-6 h-6" /> {error}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Historial de Generaciones</h1>
          <p className="text-zinc-400 mt-2">Explora y gestiona los vídeos generados previamente.</p>
        </div>
        <button onClick={loadGenerations} className="flex items-center gap-2 px-4 py-2 bg-dark-surface border border-dark-border rounded-xl text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors text-sm">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {generations.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">No hay generaciones aún. ¡Genera tu primer vídeo!</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {generations.map((gen) => (
            <div key={gen.id} className="bg-dark-surface border border-dark-border rounded-2xl overflow-hidden group hover:border-neon-green/50 transition-colors">
              {/* Thumbnail / Status Area */}
              <div className="relative aspect-video bg-dark-bg overflow-hidden">
                {gen.image_url ? (
                  <img src={gen.image_url} alt={gen.exercises?.name}
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-300 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {gen.status === 'pending' || gen.status === 'image_done'
                      ? <Loader2 className="w-8 h-8 text-neon-green animate-spin" />
                      : gen.status === 'failed'
                        ? <AlertCircle className="w-8 h-8 text-red-400" />
                        : null}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-dark-surface via-transparent to-transparent" />

                {/* Play overlay for completed videos */}
                {gen.status === 'completed' && gen.video_url && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button onClick={() => setSelectedVideo(gen)}
                      className="w-12 h-12 bg-neon-green/90 text-black rounded-full flex items-center justify-center pl-1 hover:scale-110 transition-transform shadow-[0_0_20px_rgba(0,255,102,0.5)]">
                      <Play className="w-5 h-5 fill-current" />
                    </button>
                  </div>
                )}

                <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />{timeAgo(gen.created_at)}
                </div>
                <div className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-bold ${
                  gen.status === 'completed' ? 'bg-neon-green/20 text-neon-green border border-neon-green/30'
                  : gen.status === 'failed' ? 'bg-red-900/30 text-red-400 border border-red-800/30'
                  : 'bg-yellow-900/30 text-yellow-400 border border-yellow-800/30'
                }`}>
                  {gen.status === 'completed' ? '✓ Listo' : gen.status === 'failed' ? '✗ Error' : '⏳ En proceso'}
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <h3 className="font-bold text-lg text-white mb-1">{gen.exercises?.name ?? 'Ejercicio desconocido'}</h3>
                <p className="text-sm text-zinc-400 mb-4">Ángulo: <span className="text-zinc-300">{gen.camera_angles?.name ?? '-'}</span></p>

                <div className="flex items-center gap-2 pt-4 border-t border-dark-border">
                  <button
                    disabled={gen.status !== 'completed' || !gen.video_url}
                    onClick={() => setSelectedVideo(gen)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-dark-bg hover:bg-zinc-800 border border-dark-border rounded-lg text-sm font-medium text-zinc-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    <Play className="w-4 h-4" /> Reproducir
                  </button>
                  <button
                    disabled={!gen.video_url}
                    onClick={() => gen.video_url && handleDownload(gen.video_url, gen.exercises?.name ?? 'video')}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-dark-bg hover:bg-zinc-800 border border-dark-border rounded-lg text-sm font-medium text-zinc-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    <Download className="w-4 h-4" /> Descargar
                  </button>
                  <button
                    onClick={() => handleDelete(gen.id)}
                    className="flex-none flex items-center justify-center w-10 h-10 bg-dark-bg hover:bg-red-900/20 hover:text-red-400 hover:border-red-800/40 border border-dark-border rounded-lg text-zinc-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Modal */}
      {selectedVideo?.video_url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setSelectedVideo(null)}>
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <video controls autoPlay className="w-full rounded-2xl shadow-2xl" src={selectedVideo.video_url} />
            <button onClick={() => setSelectedVideo(null)}
              className="absolute -top-4 -right-4 w-8 h-8 bg-dark-surface border border-dark-border rounded-full text-zinc-400 hover:text-white flex items-center justify-center transition-colors">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
