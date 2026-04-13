import { useState, useEffect } from 'react';
import { Plus, Save, Database as DatabaseIcon, Camera, Terminal, Trash2, Loader2, CheckCircle } from 'lucide-react';

interface Exercise { id: string; name: string; category: string; }
interface CameraAngle { id: string; name: string; prompt_modifier: string; }

export default function Configuration() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [angles, setAngles] = useState<CameraAngle[]>([]);
  const [newExercise, setNewExercise] = useState('');
  const [newExerciseCategory, setNewExerciseCategory] = useState('General');
  const [newAngle, setNewAngle] = useState('');
  const [newAngleModifier, setNewAngleModifier] = useState('');
  const [masterPrompt, setMasterPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/exercises').then(r => r.json()),
      fetch('/api/angles').then(r => r.json()),
      fetch('/api/config').then(r => r.json()),
    ]).then(([exData, angData, cfgData]) => {
      setExercises(exData);
      setAngles(angData);
      setMasterPrompt(cfgData.master_prompt ?? '');
      setLoading(false);
    }).catch(console.error);
  }, []);

  const addExercise = async () => {
    if (!newExercise.trim()) return;
    const res = await fetch('/api/exercises', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newExercise.trim(), category: newExerciseCategory }),
    });
    const data = await res.json();
    setExercises(prev => [...prev, data]);
    setNewExercise('');
  };

  const removeExercise = async (id: string) => {
    await fetch(`/api/exercises/${id}`, { method: 'DELETE' });
    setExercises(prev => prev.filter(e => e.id !== id));
  };

  const addAngle = async () => {
    if (!newAngle.trim()) return;
    const res = await fetch('/api/angles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newAngle.trim(), prompt_modifier: newAngleModifier.trim() }),
    });
    const data = await res.json();
    setAngles(prev => [...prev, data]);
    setNewAngle('');
    setNewAngleModifier('');
  };

  const removeAngle = async (id: string) => {
    await fetch(`/api/angles/${id}`, { method: 'DELETE' });
    setAngles(prev => prev.filter(a => a.id !== id));
  };

  const saveConfig = async () => {
    setSaving(true);
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'master_prompt', value: masterPrompt }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-neon-green animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ajustes del Sistema</h1>
        <p className="text-zinc-400 mt-2">Configura los parámetros globales y el prompt maestro.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Ejercicios */}
          <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 shadow-lg">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <DatabaseIcon className="w-4 h-4" /> Gestión de Ejercicios <span className="ml-auto text-zinc-600 text-xs lowercase normal-case">{exercises.length} total</span>
            </h3>
            <div className="flex gap-3 mb-2">
              <input type="text" value={newExercise} onChange={e => setNewExercise(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addExercise()}
                placeholder="Nombre del ejercicio..."
                className="flex-1 px-4 py-2.5 bg-dark-bg border border-dark-border rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-neon-green focus:border-neon-green transition-colors" />
              <button onClick={addExercise} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-dark-bg hover:bg-neon-green/10 text-neon-green border border-dark-border hover:border-neon-green/50 rounded-xl font-medium transition-colors">
                <Plus className="w-4 h-4" /> Añadir
              </button>
            </div>
            <input type="text" value={newExerciseCategory} onChange={e => setNewExerciseCategory(e.target.value)}
              placeholder="Categoría (ej. Brazos, Piernas...)"
              className="w-full mb-4 px-4 py-2 bg-dark-bg border border-dark-border rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-neon-green focus:border-neon-green transition-colors text-sm" />
            <div className="mt-2 max-h-48 overflow-y-auto space-y-1 pr-1">
              {exercises.map(ex => (
                <div key={ex.id} className="flex items-center justify-between px-3 py-1.5 bg-dark-bg border border-dark-border rounded-xl group">
                  <span className="text-xs text-zinc-300">{ex.name} <span className="text-zinc-600">· {ex.category}</span></span>
                  <button onClick={() => removeExercise(ex.id)} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Ángulos */}
          <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 shadow-lg">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Camera className="w-4 h-4" /> Gestión de Ángulos
            </h3>
            <div className="flex gap-3 mb-2">
              <input type="text" value={newAngle} onChange={e => setNewAngle(e.target.value)}
                placeholder="Nombre del ángulo..."
                className="flex-1 px-4 py-2.5 bg-dark-bg border border-dark-border rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-neon-blue focus:border-neon-blue transition-colors" />
              <button onClick={addAngle} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-dark-bg hover:bg-neon-blue/10 text-neon-blue border border-dark-border hover:border-neon-blue/50 rounded-xl font-medium transition-colors">
                <Plus className="w-4 h-4" /> Añadir
              </button>
            </div>
            <input type="text" value={newAngleModifier} onChange={e => setNewAngleModifier(e.target.value)}
              placeholder="Modificador de prompt (en inglés)..."
              className="w-full mb-4 px-4 py-2 bg-dark-bg border border-dark-border rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-neon-blue focus:border-neon-blue transition-colors text-sm" />
            <div className="space-y-1">
              {angles.map(ang => (
                <div key={ang.id} className="flex items-center justify-between px-3 py-1.5 bg-dark-bg border border-dark-border rounded-xl group">
                  <span className="text-xs text-zinc-300">{ang.name}</span>
                  <button onClick={() => removeAngle(ang.id)} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Prompt Maestro */}
        <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 shadow-lg flex flex-col h-full min-h-[500px]">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Terminal className="w-4 h-4" /> Ajuste de Prompt Maestro
          </h3>
          <p className="text-xs text-zinc-500 mb-4">
            Este prompt base se utilizará para generar las imágenes iniciales. Usa las variables{' '}
            <code className="text-neon-green bg-dark-bg px-1 py-0.5 rounded">{'{{ejercicio}}'}</code>,{' '}
            <code className="text-neon-blue bg-dark-bg px-1 py-0.5 rounded">{'{{angulo}}'}</code> y{' '}
            <code className="text-zinc-400 bg-dark-bg px-1 py-0.5 rounded">{'{{observaciones}}'}</code>.
          </p>
          <textarea
            className="flex-1 w-full px-4 py-4 bg-[#050505] border border-dark-border rounded-xl text-zinc-300 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-neon-green focus:border-neon-green transition-colors resize-none leading-relaxed"
            value={masterPrompt}
            onChange={e => setMasterPrompt(e.target.value)}
          />
          <div className="pt-6 mt-auto">
            <button onClick={saveConfig} disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-black bg-neon-green hover:bg-[#00e65c] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-bg focus:ring-neon-green transition-all hover:shadow-[0_0_20px_rgba(0,255,102,0.3)] disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? '¡Guardado!' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
