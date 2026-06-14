import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, ExternalLink, Camera } from 'lucide-react';
import TopBar, { OutlineBtn, PrimaryBtn } from '../components/TopBar';
import useLiveStatus from '../hooks/useLiveStatus';

// ── Phase definitions ─────────────────────────────────────────────────────────
const PHASE_DEFS = [
  { key: 'login',   label: 'Login',     range: s => s.step >= 1   && s.step <= 10  },
  { key: 'role',    label: 'Role',      range: s => s.step >= 11  && s.step <= 20  },
  { key: 't1',      label: 'T1 API',    range: s => s.step >= 21  && s.step <= 50  },
  { key: 'search',  label: 'Search',    range: s => s.step >= 51  && s.step <= 80  },
  { key: 't2',      label: 'T2 API',    range: s => s.step >= 81  && s.step <= 100 },
  { key: 'polling', label: 'Polling',   range: s => s.step >= 101 && s.step <= 130 },
  { key: 'refnums', label: 'Ref Nums',  range: s => s.step >= 131 && s.step <= 200 },
];

function buildPhases(steps) {
  return PHASE_DEFS.map(ph => {
    const phSteps = steps.filter(ph.range);
    const hasRun  = phSteps.some(s => s.status === 'running');
    const hasFail = phSteps.some(s => ['fail','failed'].includes(s.status));
    const allDone = phSteps.length > 0 && phSteps.every(s =>
      ['pass','passed','fail','failed'].includes(s.status)
    );
    const started = phSteps.length > 0;
    const status  = !started ? 'pending' : hasRun ? 'running' : hasFail ? 'failed' : allDone ? 'passed' : 'pending';
    return { ...ph, steps: phSteps, status };
  });
}

// ── Mini KPI ──────────────────────────────────────────────────────────────────
function MiniKpi({ label, value, color }) {
  return (
    <div style={{
      flex: 1, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '10px 14px',
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || '#0f172a' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── Step row ──────────────────────────────────────────────────────────────────
function StepRow({ step, index }) {
  const isRunning = step.status === 'running';
  const isPass    = ['pass','passed'].includes(step.status);
  const isFail    = ['fail','failed'].includes(step.status);
  const isPending = step.status === 'pending' || (!isRunning && !isPass && !isFail);

  const bg     = isRunning ? '#eff6ff' : isPass ? '#f0fdf4' : isFail ? '#fef2f2' : '#f8fafc';
  const border = isRunning ? '#bfdbfe' : isPass ? '#bbf7d0' : isFail ? '#fecaca' : '#f1f5f9';
  const color  = isRunning ? '#1d4ed8' : isPass ? '#15803d' : isFail ? '#b91c1c' : '#94a3b8';
  const hasScreenshot = step.name && (step.name.toLowerCase().includes('screenshot') || step.name.toLowerCase().includes('capture'));

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 14px', background: bg,
      borderBottom: '1px solid ' + border,
    }}>
      <span style={{ width: 28, fontSize: 10, color: '#cbd5e1', fontFamily: 'monospace', textAlign: 'right', flexShrink: 0 }}>
        {step.step}
      </span>
      <div style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isRunning && <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #3b82f6', borderTopColor: 'transparent' }} className="spin" />}
        {isPass && <CheckCircle2 size={13} color="#16a34a" />}
        {isFail && <AlertCircle size={13} color="#dc2626" />}
        {isPending && <div style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #e2e8f0' }} />}
      </div>
      <div style={{ flex: 1, fontSize: 12, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {step.name}
        {isRunning && <span style={{ opacity: 0.5 }}> …</span>}
      </div>
      {hasScreenshot && <Camera size={12} color="#94a3b8" style={{ flexShrink: 0 }} />}
      {(isPass || isFail) && step.duration_ms != null && (
        <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', flexShrink: 0 }}>
          {(step.duration_ms / 1000).toFixed(1)}s
        </span>
      )}
    </div>
  );
}

// ── Phase group header ────────────────────────────────────────────────────────
function PhaseGroupHeader({ phase }) {
  const isRunning = phase.status === 'running';
  const isPassed  = phase.status === 'passed';
  const isFailed  = phase.status === 'failed';
  const totalMs   = phase.steps.reduce((a, s) => a + (s.duration_ms || 0), 0);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px',
      background: '#f8fafc', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9',
    }}>
      <div style={{ width: 14, flexShrink: 0 }}>
        {isRunning && <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #3b82f6', borderTopColor: 'transparent' }} className="spin" />}
        {isPassed && <span style={{ fontSize: 12 }}>✅</span>}
        {isFailed && <AlertCircle size={13} color="#dc2626" />}
        {phase.status === 'pending' && <div style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #e2e8f0' }} />}
      </div>
      <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {phase.label}
      </span>
      <span style={{ fontSize: 10, color: '#94a3b8' }}>
        {phase.steps.length > 0 ? `${phase.steps.length} steps` : ''}
        {(isPassed || isFailed) && totalMs > 0 ? ` · ${(totalMs / 1000).toFixed(1)}s` : ''}
      </span>
    </div>
  );
}

// ── Screenshot thumb ──────────────────────────────────────────────────────────
function ScreenshotThumb({ label }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 120, background: '#ffffff', border: `1px solid ${hov ? '#2563eb' : '#e2e8f0'}`,
        borderRadius: 8, padding: 8, cursor: 'pointer', transition: 'border-color 0.15s',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      }}
    >
      <div style={{
        width: 100, height: 64, background: '#f8fafc', borderRadius: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Camera size={20} color="#94a3b8" />
      </div>
      <div style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center' }}>{label}</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LiveRun() {
  const navigate = useNavigate();
  const { runStatus, steps, runId, durationMs } = useLiveStatus();

  const isRunning = runStatus === 'running';
  const isDone    = runStatus === 'passed' || runStatus === 'failed';
  const isIdle    = !isRunning && !isDone;
  const phases    = buildPhases(steps);

  const allSteps  = steps.filter(s => s.step !== 11);
  const completed = allSteps.filter(s => ['pass','passed','fail','failed'].includes(s.status)).length;
  const total     = allSteps.length;
  const failed    = allSteps.filter(s => ['fail','failed'].includes(s.status)).length;
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
  const elapsedS  = durationMs ? Math.round(durationMs / 1000) : null;

  const activePhase = phases.find(p => p.status === 'running');
  const phasesDone  = phases.filter(p => p.status === 'passed' || p.status === 'failed').length;

  return (
    <>
      <TopBar
        title="Live Run"
        subtitle={runId ? `Run #${runId}` : 'No active run'}
        actions={
          <>
            {isDone && runId && (
              <OutlineBtn onClick={() => navigate('/runs/' + runId)}>View Details →</OutlineBtn>
            )}
            {isDone && (
              <a href="/report" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <OutlineBtn><ExternalLink size={12} /> Allure Report</OutlineBtn>
              </a>
            )}
          </>
        }
      />

      <div style={{ padding: 24 }}>
        {/* Mini KPIs */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          <MiniKpi
            label="Steps Complete"
            value={total > 0 ? `${completed}/${total}` : '—'}
          />
          <MiniKpi
            label="Elapsed"
            value={elapsedS ? elapsedS + 's' : isRunning ? 'Running…' : '—'}
            color={elapsedS && elapsedS > 100 ? '#d97706' : undefined}
          />
          <MiniKpi
            label="Current Phase"
            value={activePhase ? activePhase.label + ' ▶' : isDone ? (runStatus === 'passed' ? 'Done ✓' : 'Done ✗') : 'Idle'}
            color={isDone ? (runStatus === 'passed' ? '#16a34a' : '#dc2626') : undefined}
          />
        </div>

        {/* Phase timeline bar */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {phases.map((ph, i) => (
              <div
                key={ph.key}
                className={ph.status === 'running' ? 'phase-running' : ''}
                style={{
                  flex: 1, height: 6, borderRadius: 99,
                  background: ph.status === 'passed' || ph.status === 'failed'
                    ? '#16a34a'
                    : ph.status === 'running'
                    ? '#2563eb'
                    : '#e2e8f0',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {phases.map(ph => (
              <div key={ph.key} style={{ flex: 1, fontSize: 9, color: '#94a3b8', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ph.label}
              </div>
            ))}
          </div>
        </div>

        {/* Steps card */}
        {isIdle && steps.length === 0 ? (
          <div style={{
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12,
            padding: '48px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏸</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 6 }}>No active run</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              Go to <button onClick={() => navigate('/')} style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Dashboard</button> to start a test run
            </div>
          </div>
        ) : (
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
              {isRunning && <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />}
              {isDone && runStatus === 'passed' && <CheckCircle2 size={14} color="#16a34a" />}
              {isDone && runStatus === 'failed' && <AlertCircle size={14} color="#dc2626" />}
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', flex: 1 }}>
                {isRunning ? 'Running…' : 'Test Steps'}
              </span>
              {runId && <span style={{ fontSize: 10, color: '#94a3b8', background: '#e2e8f0', padding: '2px 8px', borderRadius: 99 }}>Run #{runId}</span>}
            </div>

            {phases.map(ph => (
              ph.status !== 'pending' || ph.steps.length > 0 ? (
                <div key={ph.key}>
                  <PhaseGroupHeader phase={ph} />
                  {ph.steps.map(s => <StepRow key={s.step} step={s} />)}
                </div>
              ) : null
            ))}

            {/* Progress bar */}
            {total > 0 && (
              <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: '#475569', fontWeight: 600 }}>{completed} of {total} steps</span>
                  <span style={{ color: '#d97706', fontWeight: 600 }}>
                    {isDone ? (durationMs ? (durationMs / 1000).toFixed(1) + 's total' : '') : '~' + Math.max(0, Math.round((total - completed) * 2)) + 's remaining'}
                  </span>
                </div>
                <div style={{ height: 4, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    width: pct + '%', height: '100%', borderRadius: 99, transition: 'width 0.4s',
                    background: failed > 0 ? '#ef4444' : '#16a34a',
                  }} />
                </div>
              </div>
            )}

            {/* Done banner */}
            {isDone && (
              <div style={{
                margin: '0 16px 14px',
                padding: '10px 14px', borderRadius: 8,
                background: runStatus === 'passed' ? '#f0fdf4' : '#fef2f2',
                border: '1px solid ' + (runStatus === 'passed' ? '#bbf7d0' : '#fecaca'),
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {runStatus === 'passed'
                    ? <CheckCircle2 size={16} color="#16a34a" />
                    : <AlertCircle size={16} color="#dc2626" />}
                  <span style={{ fontSize: 12, fontWeight: 600, color: runStatus === 'passed' ? '#15803d' : '#b91c1c' }}>
                    {runStatus === 'passed'
                      ? `All tests passed · ${total} steps · ${durationMs ? (durationMs / 1000).toFixed(1) + 's' : ''}`
                      : `Run failed · ${failed} failed · ${total} steps`}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <a href="/report" target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 11, color: '#2563eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                    <ExternalLink size={12} /> Allure Report
                  </a>
                  {runId && (
                    <button onClick={() => navigate('/runs/' + runId)}
                      style={{ fontSize: 11, color: '#64748b', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                      View Details →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Screenshot thumbnails */}
        {isDone && (
          <div style={{ display: 'flex', gap: 12 }}>
            <ScreenshotThumb label="Login page" />
            <ScreenshotThumb label="Role selected" />
            <ScreenshotThumb label="OTM dashboard" />
          </div>
        )}
      </div>
    </>
  );
}
