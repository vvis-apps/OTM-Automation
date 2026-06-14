import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Pencil, Trash2, CheckCircle2, XCircle, Clock } from 'lucide-react';

const REGION_LABELS = { poland: '🇵🇱 Poland', turkey: '🇹🇷 Turkey', germany: '🇩🇪 Germany', brazil: '🇧🇷 Brazil' };

function StepPill({ label, type }) {
  const map = {
    login:   { bg: '#dbeafe', color: '#1d4ed8' },
    role:    { bg: '#ede9fe', color: '#6d28d9' },
    api:     { bg: '#dcfce7', color: '#15803d' },
    ui:      { bg: '#ffedd5', color: '#c2410c' },
    ref:     { bg: '#f3e8ff', color: '#7e22ce' },
    default: { bg: '#f1f5f9', color: '#475569' },
  };
  const s = map[type] || map.default;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: s.bg, color: s.color }}>
      {label}
    </span>
  );
}

function PhaseGroup({ label, color, steps }) {
  if (!steps.length) return null;
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</div>
      {steps.map((name, i) => (
        <div key={i} style={{ fontSize: 11, color: '#64748b', paddingLeft: 8, marginBottom: 3, display: 'flex', gap: 6 }}>
          <span style={{ color: '#cbd5e1', fontFamily: 'monospace', flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
          <span>{name}</span>
        </div>
      ))}
    </div>
  );
}

function derivePills(steps) {
  if (!steps || !steps.length) return [];
  const s = steps.map(x => x.toLowerCase()).join(' ');
  const pills = [];
  if (s.includes('login') || s.includes('sign in') || s.includes('username'))
    pills.push({ label: 'Login', type: 'login' });
  if (s.includes('role') || s.includes('planner') || s.includes('save and close'))
    pills.push({ label: 'Role switch', type: 'role' });
  if (s.includes('t1') || s.includes('wmservlet') || s.includes('transmissionack'))
    pills.push({ label: 'Send T1', type: 'api' });
  if (s.includes('t2') || s.includes('delivery note') || s.includes('send t2'))
    pills.push({ label: 'Send T2', type: 'api' });
  if (s.includes('order release') || s.includes('search') || s.includes('indicator') || s.includes('planning'))
    pills.push({ label: 'OTM UI verify', type: 'ui' });
  if (s.includes('reference') || s.includes('refnum') || s.includes('delivery_note_number'))
    pills.push({ label: 'Ref numbers', type: 'ref' });
  return pills.length ? pills : [{ label: 'Login', type: 'login' }];
}

export default function RegionRegistry() {
  const { region }  = useParams();
  const navigate    = useNavigate();
  const [suites,    setSuites]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState({});
  const [cases,     setCases]     = useState({});
  const [stepsOpen,   setStepsOpen]   = useState({});
  const [stepsData,   setStepsData]   = useState({});
  const [stepsLoad,   setStepsLoad]   = useState({});
  const [confirm,   setConfirm]   = useState(null);

  const fetchSuites = useCallback(() => {
    fetch('/api/registry/' + region + '/suites')
      .then(r => r.json())
      .then(d => { setSuites(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [region]);

  useEffect(() => { setLoading(true); setSuites([]); setExpanded({}); setCases({}); fetchSuites(); }, [fetchSuites]);

  const fetchCases = id => {
    fetch('/api/registry/suites/' + id + '/cases')
      .then(r => r.json())
      .then(d => setCases(p => ({ ...p, [id]: d })));
  };

  const toggleExpand = id => {
    const will = !expanded[id];
    setExpanded(p => ({ ...p, [id]: will }));
    if (will && !cases[id]) fetchCases(id);
  };

  const toggleSteps = tc => {
    const will = !stepsOpen[tc.id];
    setStepsOpen(p => ({ ...p, [tc.id]: will }));
    if (will && !stepsData[tc.id]) {
      setStepsLoad(p => ({ ...p, [tc.id]: true }));
      fetch('/api/registry/cases/' + tc.id + '/latest-steps')
        .then(r => r.json())
        .then(d => { setStepsData(p => ({ ...p, [tc.id]: d })); setStepsLoad(p => ({ ...p, [tc.id]: false })); })
        .catch(() => setStepsLoad(p => ({ ...p, [tc.id]: false })));
    }
  };

  const runTest = async tc => {
    setConfirm(null);
    await fetch('/api/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suite: region, region, testCase: tc.name }),
    });
    navigate('/live');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #2563eb', borderTopColor: 'transparent' }} className="spin" />
      </div>
    );
  }

  const regionLabel = REGION_LABELS[region] || region;
  const totalCases  = suites.reduce((s, x) => s + (x.case_count || 0), 0);

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#0f172a' }}>{regionLabel}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>{suites.length} suite{suites.length !== 1 ? 's' : ''} · {totalCases} test case{totalCases !== 1 ? 's' : ''}</div>
        </div>
        <button style={{ padding: '7px 16px', fontSize: 12, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          + Add Suite
        </button>
      </div>

      {suites.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          No suites yet — click <strong style={{ color: '#2563eb' }}>+ Add Suite</strong> to create one
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {suites.map(suite => {
          const open       = !!expanded[suite.id];
          const suiteCases = cases[suite.id] || [];

          return (
            <div key={suite.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
              {/* Suite header */}
              <div
                onClick={() => toggleExpand(suite.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: 16, color: '#94a3b8', display: 'inline-block', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', lineHeight: 1 }}>›</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{suite.name}</div>
                  {suite.description && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{suite.description}</div>}
                </div>
                <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{suite.case_count} case{suite.case_count !== 1 ? 's' : ''}</span>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: '#dcfce7', color: '#15803d', flexShrink: 0 }}>Active</span>
                <Pencil size={13} color="#94a3b8" style={{ cursor: 'pointer', flexShrink: 0 }} onClick={e => e.stopPropagation()} />
                <Trash2 size={13} color="#94a3b8" style={{ cursor: 'pointer', flexShrink: 0 }} onClick={e => e.stopPropagation()} />
              </div>

              {/* Test cases */}
              {open && (
                <div style={{ borderTop: '1px solid #f8fafc' }}>
                  {suiteCases.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>No test cases yet</div>
                  ) : (
                    suiteCases.map((tc, ti) => {
                      const stOpen    = !!stepsOpen[tc.id];
                      const tcSteps   = stepsData[tc.id] || [];
                      const tcLoading = !!stepsLoad[tc.id];
                      const hasRun    = !!tc.last_run_status;
                      const allPass   = tc.last_run_status === 'passed';
                      const lastRunAt = tc.last_run_at ? new Date(tc.last_run_at).toLocaleString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : null;
                      const q = Math.ceil(tcSteps.length / 4);

                      return (
                        <div key={tc.id}>
                          <div style={{ padding: '12px 18px', borderTop: '1px solid #f8fafc', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            {/* Number */}
                            <div style={{ width: 22, height: 22, borderRadius: 4, background: '#dbeafe', color: '#1d4ed8', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                              {ti + 1}
                            </div>
                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{tc.name}</div>
                              {tc.description && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{tc.description}</div>}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                                {derivePills(tc.steps).map((p, i) => <StepPill key={i} label={p.label} type={p.type} />)}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 3, background: hasRun ? (allPass ? '#dcfce7' : '#fee2e2') : '#f1f5f9', color: hasRun ? (allPass ? '#15803d' : '#b91c1c') : '#94a3b8' }}>
                                  {hasRun ? (allPass ? 'PASSED' : 'FAILED') : 'NO RUN'}
                                </span>
                                {lastRunAt && <span style={{ fontSize: 10, color: '#94a3b8' }}>{lastRunAt}</span>}
                                <span style={{ fontSize: 10, color: '#94a3b8' }}>{(tc.steps && tc.steps.length) || tcSteps.length || '—'} steps</span>
                              </div>
                            </div>
                            {/* Buttons */}
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <button onClick={() => toggleSteps(tc)}
                                style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, border: '1px solid #e2e8f0', borderRadius: 7, background: stOpen ? '#f1f5f9' : '#fff', color: '#475569', cursor: 'pointer' }}>
                                Steps {stOpen ? '▲' : '▼'}
                              </button>
                              <button onClick={() => setConfirm(tc)}
                                style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 7, background: '#2563eb', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Play size={10} /> Run
                              </button>
                            </div>
                          </div>

                          {/* Steps panel */}
                          {stOpen && (
                            <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '16px 18px' }}>
                              {tcLoading ? (
                                <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #94a3b8', borderTopColor: '#2563eb' }} className="spin" />
                                  Loading steps…
                                </div>
                              ) : tcSteps.length === 0 ? (
                                <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No run data yet — run this test first.</div>
                              ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                  <PhaseGroup label="Login"            color="#2563eb" steps={tcSteps.slice(0, q).map(s => s.name)} />
                                  <PhaseGroup label="Role Switch"      color="#7c3aed" steps={tcSteps.slice(q, q * 2).map(s => s.name)} />
                                  <PhaseGroup label="API (T1 / T2)"   color="#0891b2" steps={tcSteps.slice(q * 2, q * 3).map(s => s.name)} />
                                  <PhaseGroup label="OTM UI / Ref Nums" color="#16a34a" steps={tcSteps.slice(q * 3).map(s => s.name)} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 360, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>Run Test Case</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>{confirm.name}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirm(null)} style={{ flex: 1, padding: '8px', fontSize: 13, fontWeight: 600, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => runTest(confirm)} style={{ flex: 1, padding: '8px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Play size={13} /> Run Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
