import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function FilterPill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 20,
      border: `1px solid ${active ? '#2563eb' : '#e2e8f0'}`,
      background: active ? '#dbeafe' : '#ffffff',
      color: active ? '#1d4ed8' : '#64748b',
      cursor: 'pointer', transition: 'all 0.15s',
    }}>{label}</button>
  );
}

function MiniBar({ pct }) {
  const green = Math.min(100, Math.round(pct));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 50, height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: green + '%', background: '#16a34a', height: '100%' }} />
        <div style={{ width: (100 - green) + '%', background: '#dc2626', height: '100%' }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#475569', fontWeight: 600 }}>{green}%</span>
    </div>
  );
}

const FILTERS = [
  { key: 'all',    label: 'All' },
  { key: 'passed', label: 'Passed' },
  { key: 'failed', label: 'Failed' },
  { key: 'poland', label: '🇵🇱 Poland', isRegion: true },
  { key: 'turkey', label: '🇹🇷 Turkey', isRegion: true },
];

const FLAG = { poland: '🇵🇱', turkey: '🇹🇷', germany: '🇩🇪', brazil: '🇧🇷' };

const TH = { fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' };

export default function RunHistory() {
  const [runs, setRuns]     = useState([]);
  const [loading, setLoad]  = useState(true);
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/runs').then(r => r.json()).then(d => { setRuns(d); setLoad(false); }).catch(() => setLoad(false));
  }, []);

  const filtered = runs.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'passed' || filter === 'failed') return r.status === filter;
    return r.region === filter;
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #2563eb', borderTopColor: 'transparent' }} className="spin" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {FILTERS.map(f => <FilterPill key={f.key} label={f.label} active={filter === f.key} onClick={() => setFilter(f.key)} />)}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 130px 80px 100px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '8px 20px', gap: 0 }}>
          {['RUN', 'TEST', 'PASS RATE', 'TESTS', 'DURATION'].map(h => <div key={h} style={TH}>{h}</div>)}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8', fontSize: 13 }}>No runs match current filter</div>
        ) : (
          filtered.map(run => {
            const passRate = run.total_tests > 0
              ? Math.round((run.passed / run.total_tests) * 100)
              : run.status === 'passed' ? 100 : 0;
            const flag = FLAG[run.region] || '';
            return (
              <div key={run.id}
                onClick={() => navigate('/runs/' + run.id)}
                style={{ display: 'grid', gridTemplateColumns: '80px 1fr 130px 80px 100px', gap: 0, padding: '11px 20px', borderBottom: '1px solid #f8fafc', cursor: 'pointer', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>#{run.id}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{run.environment || 'OTM Test'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{new Date(run.started_at).toLocaleDateString()}</span>
                    {run.region && (
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: '#dbeafe', color: '#1d4ed8', fontWeight: 600 }}>
                        {flag} {run.region_label || run.region}
                      </span>
                    )}
                  </div>
                </div>
                <MiniBar pct={passRate} />
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#475569' }}>{run.total_tests || '—'}</div>
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#475569' }}>{run.duration_ms ? (run.duration_ms / 1000).toFixed(1) + 's' : '—'}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
