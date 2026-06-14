import React, { useState, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { useRunContext } from '../context/RunContext';

// Phase segments — only shown when Poland E2E steps (101+) are present
const ALL_PHASE_SEGS = [
  { label: 'Login',    range: s => s.step >= 1   && s.step <= 10  },
  { label: 'Role',     range: s => s.step >= 101 && s.step <= 112 },
  { label: 'T1 Order', range: s => s.step >= 113 && s.step <= 122 },
  { label: 'T2 Note',  range: s => s.step >= 123 && s.step <= 130 },
  { label: 'OTM UI',   range: s => s.step >= 131 && s.step <= 137 },
  { label: 'Ref Nums', range: s => s.step >= 138 && s.step <= 143 },
];

function segStatus(steps, seg) {
  const ph = steps.filter(seg.range);
  if (!ph.length) return 'pending';
  if (ph.some(s => s.status === 'running')) return 'running';
  if (ph.some(s => s.status === 'fail' || s.status === 'failed')) return 'failed';
  if (ph.every(s => s.status === 'pass' || s.status === 'passed')) return 'done';
  return 'partial';
}

function Spinner() {
  return <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid #3b82f6', borderTopColor: 'transparent', flexShrink: 0 }} className="spin" />;
}

const StepRow = memo(function StepRow({ step }) {
  const isPass    = step.status === 'pass' || step.status === 'passed';
  const isFail    = step.status === 'fail' || step.status === 'failed';
  const isRunning = step.status === 'running';
  const s = isPass    ? { bg: '#f0fdf4', bd: '#bbf7d0', color: '#15803d' }
           : isRunning ? { bg: '#eff6ff', bd: '#bfdbfe', color: '#1d4ed8' }
           : isFail    ? { bg: '#fef2f2', bd: '#fecaca', color: '#b91c1c' }
           :             { bg: '#f8fafc', bd: '#f1f5f9', color: '#94a3b8' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px', background: s.bg, borderBottom: `1px solid ${s.bd}` }}>
      <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#cbd5e1', width: 22, textAlign: 'right', flexShrink: 0 }}>
        {step.step !== 11 ? step.step : '—'}
      </span>
      <div style={{ width: 15, height: 15, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isRunning  && <Spinner />}
        {isPass     && <CheckCircle2 size={13} color="#16a34a" />}
        {isFail     && <AlertCircle  size={13} color="#dc2626" />}
        {!isRunning && !isPass && !isFail && <div style={{ width: 7, height: 7, borderRadius: '50%', border: '1.5px solid #cbd5e1' }} />}
      </div>
      <span style={{ flex: 1, fontSize: 12, color: s.color }}>{step.name}{isRunning ? ' …' : ''}</span>
      {(isPass || isFail) && step.duration_ms != null && (
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8', flexShrink: 0 }}>{(step.duration_ms / 1000).toFixed(1)}s</span>
      )}
    </div>
  );
});

function ScreenshotThumb({ url, label }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    <div
      style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 8, width: 150, cursor: 'pointer' }}
      onClick={() => window.open(url, '_blank')}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
    >
      <div style={{ width: '100%', height: 80, background: '#f8fafc', borderRadius: 6, overflow: 'hidden' }}>
        <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setBroken(true)} />
      </div>
      <div style={{ fontSize: 10, color: '#64748b', marginTop: 5, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  );
}

export default function LiveRun() {
  const { runStatus, steps, runId, durationMs } = useRunContext();
  const navigate = useNavigate();

  const isRunning = runStatus === 'running';
  const isDone    = runStatus === 'passed' || runStatus === 'failed';

  const allSteps  = steps.filter(s => s.step !== 11);
  const completed = allSteps.filter(s => s.status === 'pass' || s.status === 'passed' || s.status === 'fail' || s.status === 'failed').length;
  const total     = allSteps.length;
  const failed    = allSteps.filter(s => s.status === 'fail' || s.status === 'failed').length;
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Only show Poland phases when poland steps exist
  const hasPoland  = steps.some(s => s.step >= 101);
  const phaseSegs  = hasPoland ? ALL_PHASE_SEGS : ALL_PHASE_SEGS.slice(0, 1);

  // Current phase label
  const runningPhase = ALL_PHASE_SEGS.find(seg => steps.some(s => seg.range(s) && s.status === 'running'));
  const currentPhase = isDone
    ? (runStatus === 'passed' ? 'All Passed ✓' : 'Failed ✗')
    : (runningPhase?.label || (isRunning ? 'Initialising…' : '—'));
  const phaseColor = isDone
    ? (runStatus === 'passed' ? '#16a34a' : '#dc2626')
    : '#2563eb';

  // Elapsed timer
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);
  useEffect(() => {
    if (isRunning) {
      if (!startRef.current) startRef.current = Date.now();
      const id = setInterval(() => setElapsed(Math.round((Date.now() - startRef.current) / 1000)), 1000);
      return () => clearInterval(id);
    }
    if (isDone && durationMs) { setElapsed(Math.round(durationMs / 1000)); }
    if (!isRunning && !isDone) { startRef.current = null; setElapsed(0); }
  }, [isRunning, isDone, durationMs]);

  // Poll /api/screenshots while running; fetch once on done
  const [ssFiles, setSsFiles] = useState([]);
  useEffect(() => {
    const load = () => fetch('/api/screenshots').then(r => r.json()).then(d => setSsFiles(Array.isArray(d) ? d : [])).catch(() => {});
    load();
    if (!isRunning && !isDone) return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [isRunning, isDone]);

  const loginSteps  = steps.filter(s => s.step >= 1   && s.step <= 10);
  const polandSteps = steps.filter(s => s.step >= 101);

  const groups = [
    { label: 'LOGIN TEST',     steps: loginSteps,  color: '#2563eb' },
    { label: 'POLAND OTM E2E', steps: polandSteps, color: '#0891b2' },
  ].filter(g => g.steps.length > 0);

  if (!isRunning && !isDone && steps.length === 0) {
    return (
      <div style={{ maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 48, textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 6 }}>No active run</div>
          <div style={{ fontSize: 12 }}>Click <strong style={{ color: '#2563eb' }}>Run Tests</strong> in the top bar to start</div>
        </div>
        {ssFiles.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
              Last Run Screenshots <span style={{ fontWeight: 400, color: '#94a3b8' }}>({ssFiles.length})</span>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '12px 16px' }}>
              {ssFiles.map(s => <ScreenshotThumb key={s.filename} url={s.url} label={s.label} />)}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Mini KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{total ? `${completed}/${total}` : '—'}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginTop: 3 }}>STEPS COMPLETE</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: elapsed > 0 ? '#d97706' : '#0f172a' }}>{elapsed ? elapsed + 's' : '—'}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginTop: 3 }}>ELAPSED</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: phaseColor, marginTop: 3 }}>{currentPhase}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginTop: 3 }}>CURRENT PHASE</div>
        </div>
      </div>

      {/* Phase timeline — only segments that are active */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 12 }}>Phase Timeline</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {phaseSegs.map((seg, i) => {
            const st = segStatus(steps, seg);
            const bg = st === 'done' ? '#16a34a' : st === 'running' ? '#2563eb' : st === 'failed' ? '#dc2626' : '#e2e8f0';
            return (
              <div key={i} style={{ flex: 1 }}>
                <div style={{ height: 6, borderRadius: 99, background: bg, transition: 'background 0.3s', animation: st === 'running' ? 'seg-pulse 1.5s ease-in-out infinite' : undefined }} />
                <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 5, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{seg.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step list */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
        {groups.map((group, gi) => {
          const gDone    = group.steps.filter(s => s.status === 'pass' || s.status === 'passed' || s.status === 'fail' || s.status === 'failed').length;
          const gTotal   = group.steps.length;
          const gRunning = group.steps.some(s => s.status === 'running');
          const gFailed  = group.steps.some(s => s.status === 'fail' || s.status === 'failed');
          const gMs      = group.steps.reduce((a, s) => a + (s.duration_ms || 0), 0);

          return (
            <div key={gi}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: '#f8fafc', borderTop: gi > 0 ? '2px solid #e2e8f0' : undefined, borderBottom: '1px solid #f1f5f9' }}>
                {gRunning
                  ? <Spinner />
                  : gFailed
                    ? <AlertCircle size={13} color="#dc2626" />
                    : gDone === gTotal && gTotal > 0
                      ? <CheckCircle2 size={13} color="#16a34a" />
                      : <div style={{ width: 13, height: 13 }} />
                }
                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>{group.label}</span>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>{gDone}/{gTotal} steps</span>
                {gMs > 0 && <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>{(gMs / 1000).toFixed(1)}s</span>}
              </div>
              {group.steps.filter(s => s.step !== 11).map(step => <StepRow key={step.step} step={step} />)}
            </div>
          );
        })}

        {/* Progress bar */}
        {total > 0 && (
          <div style={{ padding: '12px 16px 14px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
              <span>{completed} of {total} steps</span>
              {isRunning && <span style={{ color: '#d97706' }}>~{Math.max(0, (total - completed) * 3)}s remaining</span>}
            </div>
            <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, background: failed > 0 ? '#dc2626' : '#16a34a', width: pct + '%', transition: 'width 0.5s' }} />
            </div>
          </div>
        )}

        {/* Done banner */}
        {isDone && (
          <div style={{ margin: '0 12px 12px', padding: '12px 16px', borderRadius: 10, background: runStatus === 'passed' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${runStatus === 'passed' ? '#bbf7d0' : '#fecaca'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {runStatus === 'passed' ? <CheckCircle2 size={18} color="#16a34a" /> : <AlertCircle size={18} color="#dc2626" />}
              <span style={{ fontSize: 13, fontWeight: 600, color: runStatus === 'passed' ? '#15803d' : '#b91c1c' }}>
                {runStatus === 'passed'
                  ? `All tests passed · ${total} steps · ${elapsed}s`
                  : `Run failed · ${failed} step${failed !== 1 ? 's' : ''} failed · ${elapsed}s`}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <a href="/report" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                <ExternalLink size={12} /> Allure Report
              </a>
              {runId && (
                <button onClick={() => navigate('/runs/' + runId)} style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                  View Details →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Screenshots — polled from /api/screenshots */}
      {ssFiles.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
            Screenshots <span style={{ fontWeight: 400, color: '#94a3b8' }}>({ssFiles.length})</span>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '12px 16px' }}>
            {ssFiles.map(s => <ScreenshotThumb key={s.filename} url={s.url} label={s.label} />)}
          </div>
        </div>
      )}
    </div>
  );
}
