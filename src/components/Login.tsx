import { Lock, Mail } from 'lucide-react';
import Logo from './Logo';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4">
      <div className="w-full max-w-md bg-dark-surface border border-dark-border rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-neon-green/20 rounded-full blur-[60px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-neon-blue/20 rounded-full blur-[60px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-dark-bg border border-dark-border rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(0,255,102,0.15)]">
            <Logo className="w-8 h-8 text-neon-green" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">MotionREP</h1>
          <p className="text-zinc-400 text-sm mt-2">Generador de Vídeos IA</p>
        </div>

        <form 
          className="relative z-10 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            onLogin();
          }}
        >
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider ml-1">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-zinc-500" />
              </div>
              <input 
                type="email" 
                required
                defaultValue="admin@fitaistudio.com"
                className="block w-full pl-10 pr-3 py-3 border border-dark-border rounded-xl bg-dark-bg text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-neon-green focus:border-neon-green transition-colors"
                placeholder="tu@email.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider ml-1">Contraseña</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-zinc-500" />
              </div>
              <input 
                type="password" 
                required
                defaultValue="password123"
                className="block w-full pl-10 pr-3 py-3 border border-dark-border rounded-xl bg-dark-bg text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-neon-green focus:border-neon-green transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-black bg-neon-green hover:bg-[#00e65c] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-bg focus:ring-neon-green transition-all hover:shadow-[0_0_20px_rgba(0,255,102,0.4)] mt-8"
          >
            Acceder
          </button>
        </form>
      </div>
    </div>
  );
}
