import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Layout from './components/Layout';
import Generator from './components/Generator';
import Database from './components/Database';
import VideoDetail from './components/VideoDetail';
import Configuration from './components/Configuration';
import PromptTester from './components/PromptTester';

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
          <Route path="/generador" element={<Generator />} />
          <Route path="/base" element={<Database />} />
          <Route path="/base/:id" element={<VideoDetail />} />
          <Route path="/configuracion" element={<Configuration />} />
          <Route path="/test-prompts" element={<PromptTester />} />
          <Route path="*" element={<Navigate to="/generador" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
