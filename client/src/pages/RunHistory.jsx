import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ClipboardList } from 'lucide-react';
import TopBar, { OutlineBtn } from '../components/TopBar';

const STATUS_FILTERS = [
  { key: 'all',    label: 'All' },
  { key: 'passed', label: 'Passed' },
  { key: 'failed', label: 'Failed' },
  { key: 'running',label: 'Running' },
];

const REGION_PILLS = [
  { key: 'all',     label: 'All Regions' },
  { key: 'poland',  label: '🇵🇱 Poland' },
  { key: 'turkey',  label: '🇹🇷 Turkey' },
  { key: 'germany', label: '🇩🇪 Germany' },
  { key: 'brazil',  label: '🇧🇷 Brazil' },
];

function FilterPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 14px', borderRadius: 99,
        border: '1px solid ' + (active ? '#2563eb' : '#e2e8f0'),
        background: active ? '#dbeafe' : '#ffffff',
        color: active ? '#1d4ed8' : '#64748b',
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}

function PassBar({ passed, total }) {
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 50, height: 4, background: '#fee2e2', borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ width: pct + '%', height: '100%', background: '#16a34a', borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>{pct}%</span>
    </div>
  );
}

export default function RunHistory() {
  const [runs,         setRuns]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/runs')
      .then(r => r.json())
      .then(d => { setRuns(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const regionOptions = [
    { key: 'all', label: 'All Regions' },
    ...Array.from(
      new Map(runs.filter(r => r.region).map(r => [r.region, r.region_label])).entries()
    ).map(([key, label]) => ({ key, label: label || key })),
  ];

  const filtered = runs.filter(r => {
    const statusOk = statusFilter === 'all' || r.status === statusFilter;
    const regionOk = regionFilter === 'all' || r.region === regionFilter;
    return statusOk && regionOk;
  });

  const thStyle = {
    padding: '9px 16px', fontSize: 9, fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left',
    background: '#f8fafc', whiteSpace: 'nowrap',
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <RefreshCw size={22} color="#94a3b8" className="spin" />
    </div>
  );

  return (
    <>
      <TopBar
        title="Run History"
        subtitle={`${runs.length} total runs`}
        actions={
          <OutlineBtn onClick={() => fetch('/api/runs').then(r => r.json()).then(setRuns)}>
            <RefreshCw size={12} /> Refresh
          </OutlineBtn>
        }
      />

      <div style={{ padding: 24 }}>
        {/* Filter pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {STATUS_FILTERS.map(f => (
            <FilterPill key={f.key} label={f.label} active={statusFilter === f.key} onClick={() => setStatusFilter(f.key)} />
          ))}
          <div style={{ width: 1, background: '#e2e8f0', margin: '0 4px' }} />
          {regionOptions.map(r => (
            <FilterPill key={r.key} label={r.label} active={regionFilter === r.key} onClick={() => setRegionFilter(r.key)} />
          ))}
        </div>

        {/* Table */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', color: '#94a3b8' }}>
              <ClipboardList size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
              <div style={{ fontSize: 13 }}>No runs match the current filters</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={thStyle}>Run</th>
                    <th style={thStyle}>Test</th>
                    <th style={thStyle}>Pass Rate</th>
                    <th style={thStyle}>Steps</th>
                    <th style={thStyle}>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(run => {
                    const pass = run.status === 'passed';
                    const fail = run.status === 'failed';
                    const totalTests = run.total_tests || (run.passed + run.failed) || 1;
                    return (
                      <tr
                        key={run.id}
                        onClick={() => navigate('/runs/' + run.id)}
                        style={{ cursor: 'pointer', borderBottom: '1px solid #f8fafc', transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#94a3b8', fontWeight: 600 }}>
                            #{run.id}
                          </div>
                          <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 2 }}>
                            {new Date(run.started_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#0f172a', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {run.environment || 'OTM Test Run'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                            <span style={{ fontSize: 10, color: '#94a3b8' }}>
                              {new Date(run.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {run.region && (
                              <span style={{
                                fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3,
                                background: '#f1f5f9', color: '#64748b',
                              }}>
                                {run.region_label || run.region}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <PassBar passed={run.passed || 0} total={totalTests} />
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>
                          {run.total_tests || '—'}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#475569' }}>
                              {run.duration_ms ? (run.duration_ms / 1000).toFixed(1) + 's' : '—'}
                            </span>
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                              background: pass ? '#dcfce7' : fail ? '#fee2e2' : '#f1f5f9',
                              color: pass ? '#15803d' : fail ? '#b91c1c' : '#64748b',
                            }}>
                              {run.status.toUpperCase()}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
