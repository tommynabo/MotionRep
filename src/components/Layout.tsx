import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Dumbbell, FolderOpen, Settings, LogOut, FlaskConical } from 'lucide-react';
import Logo from './Logo';

interface LayoutProps {
  children: ReactNode;
  onLogout: () => void;
}

export default function Layout({ children, onLogout }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/generador', label: 'Generador', icon: Dumbbell },
    { path: '/base', label: 'Base de Datos', icon: FolderOpen },
    { path: '/configuracion', label: 'Configuración', icon: Settings },
    { path: '/test-prompts', label: 'Test Prompts', icon: FlaskConical },
  ];

  return (
    <div className="min-h-screen flex bg-dark-bg text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-dark-surface border-r border-dark-border flex flex-col fixed inset-y-0 left-0 z-20">
        <div className="h-20 flex items-center px-6 border-b border-dark-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-dark-bg border border-dark-border rounded-xl flex items-center justify-center shadow-[0_0_10px_rgba(0,255,102,0.1)]">
              <Logo className="w-5 h-5 text-neon-green" />
            </div>
            <span className="font-bold text-lg tracking-tight">MotionREP</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-neon-green/10 text-neon-green border border-neon-green/20 shadow-[inset_0_0_10px_rgba(0,255,102,0.05)]'
                    : 'text-zinc-400 hover:text-white hover:bg-dark-bg border border-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-neon-green' : 'text-zinc-500'}`} />
                <span className="font-medium text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-dark-border">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 min-h-screen relative">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-neon-green/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-neon-blue/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
