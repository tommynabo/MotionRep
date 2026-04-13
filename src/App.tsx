import { useState } from 'react';
import Login from './components/Login';
import Layout from './components/Layout';
import Generator from './components/Generator';
import Database from './components/Database';
import Configuration from './components/Configuration';

export type View = 'generator' | 'database' | 'config';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState<View>('generator');

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <Layout 
      currentView={currentView} 
      onNavigate={setCurrentView} 
      onLogout={() => setIsLoggedIn(false)}
    >
      {currentView === 'generator' && <Generator />}
      {currentView === 'database' && <Database />}
      {currentView === 'config' && <Configuration />}
    </Layout>
  );
}
