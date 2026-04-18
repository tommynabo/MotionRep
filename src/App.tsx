import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Layout from './components/Layout';
import Generator from './components/Generator';
import Database from './components/Database';
import VideoDetail from './components/VideoDetail';
import Configuration from './components/Configuration';
import { CurationPage } from './components/CurationPage';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <BrowserRouter>
      <Layout onLogout={() => setIsLoggedIn(false)}>
        <Routes>
          <Route path="/" element={<Navigate to="/generador" replace />} />
          <Route path="/curator" element={<CurationPage />} />
          <Route path="/generador" element={<Generator />} />
          <Route path="/curator" element={<CurationPage />} />
          <Route path="/base" element={<Database />} />
          <Route path="/base/:id" element={<VideoDetail />} />
          <Route path="/configuracion" element={<Configuration />} />
          <Route path="*" element={<Navigate to="/generador" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
