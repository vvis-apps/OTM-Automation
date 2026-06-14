import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Play, FlaskConical, ListChecks, CheckCircle2, XCircle, Clock, X, Pencil, Trash2 } from 'lucide-react';
import TopBar, { OutlineBtn, PrimaryBtn } from '../components/TopBar';

const REGION_META = {
  poland:  { flag: '🇵🇱', name: 'Poland',  sub: 'Europe · OTM v24' },
  turkey:  { flag: '🇹🇷', name: 'Turkey',  sub: 'Europe · OTM v24' },
  germany: { flag: '🇩🇪', name: 'Germany', sub: 'Europe · OTM v24' },
  brazil:  { flag: '🇧🇷', name: 'Brazil',  sub: 'LATAM · OTM v23' },
};

const STEP_PILLS = [
  { label: 'Login',        bg: '#dbeafe', color: '#1d4ed8' },
  { label: 'Role switch',  bg: '#ede9fe', color: '#6d28d9' },
  { label: 'Send T1',      bg: '#dcfce7', color: '#15803d' },
  { label: 'Send T2',      bg: '#dcfce7', color: '#15803d' },
  { label: 'OTM UI verify',bg: '#ffedd5', color: '#c2410c' },
  { label: 'Ref numbers',  bg: '#f3e8ff', color: '#7e22ce' },
];

const PHASE_GROUPS = [
  { label: 'Login', color: '#2563eb', steps: ['Navigate to OTM', 'Enter username', 'Enter password', 'Click login', 'Verify homepage'] },
  { label: 'Role Switch', color: '#7c3aed', steps: ['Open role selector', 'Select POLAND_PLANNER', 'Confirm role change', 'Verify dashboard'] },
  { label: 'SAP Integration', color: '#0891b2', steps: ['Send T1 initial order', 'Verify T1 response', 'Send T2 delivery note', 'Verify T2 response', 'Wait for OTM sync'] },
  { label: 'OTM Verification', color: '#16a34a', steps: ['Search order', 'Open order detail', 'Verify 6 reference numbers', 'Capture screenshot'] },
];

function StepPill({ label, bg, color }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: bg, color, flexShrink: 0 }}>
      {label}
    </span>
  );
}

function LastRunBadge({ status, date, steps }) {
  const pass = status === 'passed' || status === 'PASSED';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <span style={{
        fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
        background: pass ? '#dcfce7' : '#fee2e2',
        color: pass ? '#15803d' : '#b91c1c',
      }}>
        {pass ? 'PASSED' : 'FAILED'}
      </span>
      {date && <span style={{ fontSize: 10, color: '#94a3b8' }}>{date}</span>}
      {steps && <span style={{ fontSize: 10, color: '#94a3b8' }}>· {steps} steps</span>}
    </div>
  );
}

function StepsGrid({ steps }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
      padding: '14px 16px', background: '#f8fafc', borderTop: '1px solid #f1f5f9',
    }}>
      {PHASE_GROUPS.map(group => (
        <div key={group.label}>
          <div style={{ fontSize: 10, fontWeight: 700, color: group.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            {group.label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {group.steps.map((s, i) => (
              <div key={i} style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: group.color, flexShrink: 0 }} />
                {s}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LatestStepsPanel({ steps, loading }) {
  if (loading) return (
    <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#94a3b8', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
      <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #94a3b8', borderTopColor: '#3b82f6' }} className="spin" />
      Loading steps…
    </div>
  );

  if (!steps || steps.length === 0) return (
    <div style={{ padding: '10px 16px', fontSize: 11, color: '#94a3b8', fontStyle: 'italic', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
      No run data yet — run this test first to see steps.
    </div>
  );

  return (
    <div style={{ background: '#f8fafc', borderTop: '1px solid #f1f5f9', padding: '10px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        Latest run — {steps.length} steps
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, padding: '3px 0' }}>
            <span style={{ width: 20, textAlign: 'right', color: '#cbd5e1', fontFamily: 'monospace', flexShrink: 0 }}>{i + 1}</span>
            {s.status === 'passed' ? <CheckCircle2 size={12} color="#16a34a" />
             : s.status === 'failed' ? <XCircle size={12} color="#dc2626" />
             : <Clock size={12} color="#cbd5e1" />}
            <span style={{ flex: 1, color: s.status === 'failed' ? '#dc2626' : '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.name}
            </span>
            {s.duration_ms != null && (
              <span style={{ fontSize: 10, color: '#cbd5e1', fontFamily: 'monospace', flexShrink: 0 }}>
                {(s.duration_ms / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TestCaseCard({ tc, onRun }) {
  const [stepsView, setStepsView]     = useState(null); // null | 'definition' | 'latest'
  const [latestSteps, setLatestSteps] = useState(null);
  const [stepsLoading, setStepsLoading] = useState(false);

  const toggleSteps = (view) => {
    if (stepsView === view) { setStepsView(null); return; }
    setStepsView(view);
    if (view === 'latest' && !latestSteps) {
      setStepsLoading(true);
      fetch('/api/registry/cases/' + tc.id + '/latest-steps')
        .then(r => r.json())
        .then(d => { setLatestSteps(d); setStepsLoading(false); })
        .catch(() => setStepsLoading(false));
    }
  };

  const caseNum = tc.id || 1;

  return (
    <div style={{ borderTop: '1px solid #f8fafc' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px' }}>
        {/* Number badge */}
        <div style={{
          width: 24, height: 24, borderRadius: 6, flexShrink: 0,
          background: '#dbeafe', color: '#1d4ed8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, marginTop: 1,
        }}>
          {caseNum}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#334155' }}>{tc.name}</div>
          {tc.description && (
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{tc.description}</div>
          )}

          {/* Step pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {STEP_PILLS.map(p => <StepPill key={p.label} {...p} />)}
          </div>

          {/* Last run status */}
          <div style={{ marginTop: 8 }}>
            <LastRunBadge status="PASSED" date="14/06/2026 01:19" steps="43" />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
          <button
            onClick={() => toggleSteps('latest')}
            style={{
              padding: '5px 12px', border: '1px solid #e2e8f0', borderRadius: 6,
              background: stepsView === 'latest' ? '#f1f5f9' : '#ffffff',
              color: '#475569', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {stepsView === 'latest' ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            Steps
          </button>
          <button
            onClick={() => onRun(tc)}
            style={{
              padding: '5px 12px', border: 'none', borderRadius: 6,
              background: '#2563eb', color: '#ffffff',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
            onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
          >
            <Play size={10} /> Run
          </button>
        </div>
      </div>

      {stepsView === 'latest' && <LatestStepsPanel steps={latestSteps} loading={stepsLoading} />}
      {stepsView === 'definition' && <StepsGrid />}
    </div>
  );
}

function SuiteCard({ suite, onRun }) {
  const [open, setOpen] = useState(false);
  const [cases, setCases] = useState(null);

  const toggle = () => {
    if (!open && !cases) {
      fetch('/api/registry/suites/' + suite.id + '/cases')
        .then(r => r.json())
        .then(setCases);
    }
    setOpen(o => !o);
  };

  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden',
    }}>
      {/* Suite header */}
      <div
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
          cursor: 'pointer', transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <span style={{ color: '#94a3b8', fontSize: 14, transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>›</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{suite.name}</div>
          {suite.description && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{suite.description}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{suite.case_count} cases</span>
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: '#dcfce7', color: '#15803d' }}>
            Active
          </span>
          <button
            onClick={e => e.stopPropagation()}
            style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
            title="Edit"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={e => e.stopPropagation()}
            style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Cases */}
      {open && (
        <div>
          {cases === null ? (
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#94a3b8' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #94a3b8', borderTopColor: '#3b82f6' }} className="spin" />
              Loading cases…
            </div>
          ) : cases.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
              <FlaskConical size={20} style={{ opacity: 0.3, margin: '0 auto 8px', display: 'block' }} />
              No test cases
            </div>
          ) : (
            cases.map(tc => (
              <TestCaseCard key={tc.id} tc={tc} onRun={onRun} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function RegionRegistry() {
  const { region } = useParams();
  const navigate   = useNavigate();

  const [suites,        setSuites]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [confirm,       setConfirm]       = useState(null);
  const [runAllConfirm, setRunAllConfirm] = useState(false);

  const meta = REGION_META[region] || { flag: '🌐', name: region, sub: '' };

  const fetchSuites = useCallback(() => {
    fetch('/api/registry/' + region + '/suites')
      .then(r => r.json())
      .then(d => { setSuites(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [region]);

  useEffect(() => { fetchSuites(); }, [fetchSuites]);

  const runTest = async (tc) => {
    setConfirm(null);
    await fetch('/api/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suite: region, region, testCase: tc.name }),
    });
    navigate('/live');
  };

  const runAll = async () => {
    setRunAllConfirm(false);
    await fetch('/api/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suite: 'all', region, testCase: 'all' }),
    });
    navigate('/live');
  };

  const totalCases = suites.reduce((a, s) => a + (s.case_count || 0), 0);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#3b82f6' }} className="spin" />
    </div>
  );

  return (
    <>
      <TopBar
        title={`${meta.flag} ${meta.name} Registry`}
        subtitle={`${suites.length} suites · ${totalCases} cases`}
        actions={
          <>
            <OutlineBtn onClick={fetchSuites}><ListChecks size={12} /> Refresh</OutlineBtn>
            <PrimaryBtn onClick={() => setRunAllConfirm(true)}>
              <ListChecks size={12} /> Run All
            </PrimaryBtn>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {suites.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
              <FlaskConical size={28} style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontSize: 13, marginBottom: 4 }}>No test suites yet</div>
              <div style={{ fontSize: 11 }}>Add suites via the API or seed the database</div>
            </div>
          ) : (
            suites.map(suite => (
              <SuiteCard key={suite.id} suite={suite} onRun={setConfirm} />
            ))
          )}
        </div>
      </div>

      {/* Run All confirm */}
      {runAllConfirm && (
        <Modal title="Run All Test Cases" onClose={() => setRunAllConfirm(false)}>
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 20 }}>
            Runs Login then {meta.name} E2E in sequence. You'll be redirected to Live Run.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <OutlineBtn onClick={() => setRunAllConfirm(false)}>Cancel</OutlineBtn>
            <PrimaryBtn onClick={runAll}><ListChecks size={12} /> Run All</PrimaryBtn>
          </div>
        </Modal>
      )}

      {/* Confirm single test */}
      {confirm && (
        <Modal title="Run Test Case" onClose={() => setConfirm(null)}>
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 20 }}>{confirm.name}</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <OutlineBtn onClick={() => setConfirm(null)}>Cancel</OutlineBtn>
            <PrimaryBtn onClick={() => runTest(confirm)}><Play size={12} /> Run Now</PrimaryBtn>
          </div>
        </Modal>
      )}
    </>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16,
    }}>
      <div style={{ background: '#ffffff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
