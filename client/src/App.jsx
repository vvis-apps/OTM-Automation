import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import LiveRun from './pages/LiveRun';
import RunHistory from './pages/RunHistory';
import RunDetail from './pages/RunDetail';
import TestDetail from './pages/TestDetail';
import RegionRegistry from './pages/RegionRegistry';
import TestCaseDetail from './pages/TestCaseDetail';

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>
          <main style={{ flex: 1, overflowY: 'auto' }}>
            <Routes>
              <Route path="/"                     element={<Home />} />
              <Route path="/live"                 element={<LiveRun />} />
              <Route path="/runs"                 element={<RunHistory />} />
              <Route path="/runs/:id"             element={<RunDetail />} />
              <Route path="/tests/:id"            element={<TestDetail />} />
              <Route path="/registry"             element={<Navigate to="/registry/poland" replace />} />
              <Route path="/registry/:region"     element={<RegionRegistry />} />
              <Route path="/registry/cases/:id"   element={<TestCaseDetail />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
