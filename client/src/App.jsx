import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RunProvider } from './context/RunContext';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Home from './pages/Home';
import LiveRun from './pages/LiveRun';
import RunHistory from './pages/RunHistory';
import RunDetail from './pages/RunDetail';
import TestDetail from './pages/TestDetail';
import Registry from './pages/Registry';
import RegionRegistry from './pages/RegionRegistry';
import TestCaseDetail from './pages/TestCaseDetail';
import Analytics from './pages/Analytics';

export default function App() {
  return (
    <BrowserRouter>
      <RunProvider>
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f8fafc' }}>
          <Sidebar />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            <TopBar />
            <main style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f8fafc' }}>
              <Routes>
                <Route path="/"                   element={<Home />} />
                <Route path="/live"               element={<LiveRun />} />
                <Route path="/runs"               element={<RunHistory />} />
                <Route path="/runs/:id"           element={<RunDetail />} />
                <Route path="/tests/:id"          element={<TestDetail />} />
                <Route path="/registry"           element={<Registry />} />
                <Route path="/registry/:region"   element={<RegionRegistry />} />
                <Route path="/registry/cases/:id" element={<TestCaseDetail />} />
                <Route path="/analytics"          element={<Analytics />} />
              </Routes>
            </main>
          </div>
        </div>
      </RunProvider>
    </BrowserRouter>
  );
}
