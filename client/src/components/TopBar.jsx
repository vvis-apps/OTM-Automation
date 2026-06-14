import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Download, RefreshCw, Play } from 'lucide-react';
import { useRunContext } from '../context/RunContext';

const PAGE_INFO = {
  '/':         { title: 'Dashboard',     subtitle: 'OTM Sanity Test Automation' },
  '/live':     { title: 'Live Run',      subtitle: 'Real-time test execution monitor' },
  '/runs':     { title: 'Run History',   subtitle: 'All past test executions' },
  '/registry': { title: 'Test Registry', subtitle: 'Poland Region' },
};

const btn = {
  outline: {
    padding: '6px 14px', fontSize: 12, fontWeight: 600,
    border: '1px solid #e2e8f0', borderRadius: 8,
    background: '#ffffff', color: '#475569', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
  },
};

export default function TopBar() {
  const location = useLocation();
  const navigate  = useNavigate();
  const { runStatus } = useRunContext();
  const [busy, setBusy] = useState(false);

  const isRunning = runStatus === 'running';
  const info = PAGE_INFO[location.pathname]
    || (location.pathname.startsWith('/registry') ? { title: 'Test Registry', subtitle: 'Region view' }
      : { title: 'OTM Portal', subtitle: '' });

  async function triggerRun() {
    if (isRunning || busy) return;
    setBusy(true);
    try {
      await fetch('/api/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suite: 'all', testCase: 'all' }),
      });
      navigate('/live');
    } catch (_) {}
    setBusy(false);
  }

  return (
    <div style={{ height: 52, background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', lineHeight: 1.2 }}>{info.title}</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{info.subtitle}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button style={btn.outline}><Download size={13} /> Export</button>
        <button style={btn.outline} onClick={() => window.location.reload()}><RefreshCw size={13} /> Refresh</button>
        <button
          onClick={triggerRun}
          disabled={isRunning || busy}
          style={{
            padding: '6px 16px', fontSize: 12, fontWeight: 600,
            border: 'none', borderRadius: 8,
            background: isRunning ? '#93c5fd' : '#2563eb', color: '#ffffff',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: isRunning ? 0.8 : 1,
          }}>
          {isRunning
            ? <><RefreshCw size={13} className="spin" /> Running…</>
            : <><Play size={13} /> Run Tests</>}
        </button>
      </div>
    </div>
  );
}
