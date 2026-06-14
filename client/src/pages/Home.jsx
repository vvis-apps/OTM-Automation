import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, RefreshCw, CheckCircle2, AlertCircle,
  ExternalLink, ChevronDown, ChevronRight, X,
} from 'lucide-react';
import TopBar, { OutlineBtn, PrimaryBtn } from '../components/TopBar';
import useLiveStatus from '../hooks/useLiveStatus';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts';

// ── Color tokens ──────────────────────────────────────────────────────────────
const C = {
  card:        { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 },
  textPrimary: '#0f172a',
  textSec:     '#475569',
  textMuted:   '#94a3b8',
  textHint:    '#cbd5e1',
  pageBg:      '#f8fafc',
};

// ── KPI Sparkline ─────────────────────────────────────────────────────────────
function Sparkline({ data, color }) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 24, marginTop: 8 }}>
      {data.map((v, i) => (
        <div key={i} style={{
          flex: 1, borderRadius: 2,
          height: Math.max(3, (v / max) * 24),
          background: color,
          opacity: i === data.length - 1 ? 1 : 0.35 + (i / data.length) * 0.5,
        }} />
      ))}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ value, label, delta, deltaUp, sparkData, sparkColor }) {
  return (
    <div style={C.card}>
      <div style={{ fontSize: 26, fontWeight: 700, color: C.textPrimary, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      {delta != null && (
        <div style={{
          fontSize: 11, marginTop: 3, fontWeight: 600,
          color: deltaUp ? '#16a34a' : '#dc2626',
          display: 'flex', alignItems: 'center', gap: 2,
        }}>
          {deltaUp ? '↑' : '↓'} {delta}
        </div>
      )}
      {sparkData && <Sparkline data={sparkData} color={sparkColor || '#2563eb'} />}
    </div>
  );
}

// ── Region health bar ─────────────────────────────────────────────────────────
function RegionRow({ flag, name, sub, pct, status }) {
  const color = status === 'PASS' ? '#16a34a' : status === 'WARN' ? '#d97706' : '#dc2626';
  const bgColor = status === 'PASS' ? '#dcfce7' : status === 'WARN' ? '#fef3c7' : '#fee2e2';
  const textColor = status === 'PASS' ? '#15803d' : status === 'WARN' ? '#92400e' : '#b91c1c';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
      <span style={{ fontSize: 16 }}>{flag}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary }}>{name}</div>
        <div style={{ fontSize: 10, color: C.textMuted }}>{sub}</div>
      </div>
      <div style={{ width: 60, height: 4, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ width: pct + '%', height: '100%', background: color, borderRadius: 99 }} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.textSec, width: 30, textAlign: 'right', flexShrink: 0 }}>
        {pct}%
      </div>
      <div style={{
        fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
        background: bgColor, color: textColor, flexShrink: 0,
      }}>
        {status}
      </div>
    </div>
  );
}

// ── Phase timing bar ──────────────────────────────────────────────────────────
const PHASE_TIMING = [
  { name: 'Login',      dur: 32, color: '#2563eb' },
  { name: 'Role',       dur: 4,  color: '#7c3aed' },
  { name: 'T1 API',     dur: 2,  color: '#0891b2' },
  { name: 'Search',     dur: 9,  color: '#0891b2' },
  { name: 'T2 API',     dur: 1,  color: '#0891b2' },
  { name: 'T2 Polling', dur: 12, color: '#dc2626' },
  { name: 'Ref Nums',   dur: 5,  color: '#16a34a' },
];

function PhaseTimingRow({ name, dur, color, maxDur }) {
  const pct = (dur / maxDur) * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
      <div style={{ width: 76, fontSize: 11, color: C.textSec, flexShrink: 0, textAlign: 'right' }}>{name}</div>
      <div style={{ flex: 1, height: 16, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <div style={{ width: 32, fontSize: 11, fontWeight: 600, color: C.textSec, textAlign: 'right', flexShrink: 0 }}>
        {dur}s
      </div>
    </div>
  );
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
const HEATMAP_DATA = [
  { name: 'Wait for homepage',           days: ['P','P','W','P','P','P','P'] },
  { name: 'T2 polling (blue indicator)', days: ['P','F','P','P','W','P','F'] },
  { name: 'Select role POLAND_PLANNER',  days: ['P','P','P','W','P','P','P'] },
  { name: 'Verify Total Found: 1',       days: ['P','P','P','P','F','P','W'] },
];

const DAY_LABELS = ['M','T','W','T','F','S','S'];
const CELL_STYLE = {
  P: { bg: '#dcfce7', color: '#15803d' },
  W: { bg: '#fef3c7', color: '#92400e' },
  F: { bg: '#fee2e2', color: '#b91c1c' },
  '-': { bg: '#f1f5f9', color: '#94a3b8' },
};

function HeatmapRow({ name, days }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
      <div style={{ width: 200, fontSize: 11, color: C.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {days.map((d, i) => {
          const st = CELL_STYLE[d] || CELL_STYLE['-'];
          return (
            <div key={i} style={{
              width: 24, height: 24, borderRadius: 3, fontSize: 10, fontWeight: 600,
              background: st.bg, color: st.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Recent run row ────────────────────────────────────────────────────────────
function RunRow({ run, onClick }) {
  const pass = run.status === 'passed';
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f8fafc',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: pass ? '#16a34a' : run.status === 'running' ? '#3b82f6' : '#dc2626',
      }} />
      <div style={{ width: 48, fontSize: 11, fontWeight: 600, color: C.textMuted, fontFamily: 'monospace', flexShrink: 0 }}>
        #{run.id}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {run.environment || 'OTM Test Run'}
        </div>
        <div style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>
          {new Date(run.started_at).toLocaleString()}
          {run.region && (
            <span style={{
              marginLeft: 6, padding: '1px 6px', borderRadius: 3,
              background: '#f1f5f9', color: '#64748b', fontSize: 10, fontWeight: 600,
            }}>
              {run.region_label || run.region}
            </span>
          )}
        </div>
      </div>
      <div style={{
        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, flexShrink: 0,
        background: pass ? '#dcfce7' : '#fee2e2',
        color: pass ? '#15803d' : '#b91c1c',
      }}>
        {pass ? 'PASS' : 'FAIL'}
      </div>
      {run.duration_ms > 0 && (
        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: 'monospace', flexShrink: 0, width: 40, textAlign: 'right' }}>
          {(run.duration_ms / 1000).toFixed(0)}s
        </div>
      )}
    </div>
  );
}

// ── Trend chart (recharts AreaChart) ─────────────────────────────────────────
const TREND_DATA = [
  { day: '1/6', rate: 100 }, { day: '2/6', rate: 50 },  { day: '3/6', rate: 100 },
  { day: '4/6', rate: 100 }, { day: '5/6', rate: 0 },   { day: '6/6', rate: 100 },
  { day: '7/6', rate: 100 }, { day: '8/6', rate: 50 },  { day: '9/6', rate: 100 },
  { day: '10/6', rate: 100 },{ day: '11/6', rate: 100 },{ day: '12/6', rate: 50 },
  { day: '13/6', rate: 100 },{ day: '14/6', rate: 74 },
];

function TrendChart() {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={TREND_DATA} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="greenFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.12} />
            <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="0" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={1} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => v + '%'} width={32} />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 11 }}
          formatter={(v) => [v + '%', 'Pass rate']}
        />
        <Area type="monotone" dataKey="rate" stroke="#16a34a" strokeWidth={2} fill="url(#greenFill)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Phase block for live progress ─────────────────────────────────────────────
const PHASE_DEFS = [
  { key: 'login',  label: 'Login Test',     range: s => s.step >= 1   && s.step <= 10  },
  { key: 'poland', label: 'Poland OTM E2E', range: s => s.step >= 101 && s.step <= 200 },
];

function buildPhases(steps) {
  return PHASE_DEFS.map(ph => {
    const phSteps = steps.filter(ph.range);
    const hasRun  = phSteps.some(s => s.status === 'running');
    const hasFail = phSteps.some(s => s.status === 'fail' || s.status === 'failed');
    const allDone = phSteps.length > 0 && phSteps.every(s =>
      ['pass','passed','fail','failed'].includes(s.status)
    );
    const totalMs = phSteps.reduce((a, s) => a + (s.duration_ms || 0), 0);
    const started = phSteps.length > 0;
    const status  = !started ? 'pending' : hasRun ? 'running' : hasFail ? 'failed' : allDone ? 'passed' : 'running';
    return { ...ph, steps: phSteps, status, totalMs };
  });
}

function StepItem({ step }) {
  const isRunning = step.status === 'running';
  const isPass    = step.status === 'pass' || step.status === 'passed';
  const isFail    = step.status === 'fail' || step.status === 'failed';
  const isPending = step.status === 'pending';

  const bg     = isRunning ? '#eff6ff' : isPass ? '#f0fdf4' : isFail ? '#fef2f2' : '#f8fafc';
  const border = isRunning ? '#bfdbfe' : isPass ? '#bbf7d0' : isFail ? '#fecaca' : '#f1f5f9';
  const color  = isRunning ? '#1d4ed8' : isPass ? '#15803d' : isFail ? '#b91c1c' : '#94a3b8';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 12px', background: bg,
      borderBottom: '1px solid ' + border,
    }}>
      <div style={{ width: 24, fontSize: 10, color: '#cbd5e1', fontFamily: 'monospace', flexShrink: 0, textAlign: 'right' }}>
        {step.step}
      </div>
      <div style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isRunning && <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #3b82f6', borderTopColor: 'transparent' }} className="spin" />}
        {isPass && <CheckCircle2 size={14} color="#16a34a" />}
        {isFail && <AlertCircle size={14} color="#dc2626" />}
        {isPending && <div style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #cbd5e1' }} />}
      </div>
      <div style={{ flex: 1, fontSize: 12, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {step.name}
        {isRunning && <span style={{ opacity: 0.5 }}> …</span>}
      </div>
      {(isPass || isFail) && step.duration_ms != null && (
        <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', flexShrink: 0 }}>
          {(step.duration_ms / 1000).toFixed(1)}s
        </div>
      )}
      {isFail && step.error && (
        <div style={{ fontSize: 10, color: '#dc2626', marginTop: 2, fontFamily: 'monospace' }}>
          {step.error.slice(0, 80)}…
        </div>
      )}
    </div>
  );
}

function PhaseGroup({ phase, forceOpen }) {
  const isRunning = phase.status === 'running';
  const isPassed  = phase.status === 'passed';
  const isFailed  = phase.status === 'failed';
  const isPending = phase.status === 'pending';
  const isDone    = isPassed || isFailed;
  const [open, setOpen] = useState(null);
  const prevStatus = useRef(phase.status);

  useEffect(() => {
    if (prevStatus.current !== phase.status) {
      setOpen(null);
      prevStatus.current = phase.status;
    }
  }, [phase.status]);

  const isOpen = open !== null ? open : (isRunning || forceOpen);
  const passed = phase.steps.filter(s => ['pass','passed'].includes(s.status)).length;
  const failed = phase.steps.filter(s => ['fail','failed'].includes(s.status)).length;

  return (
    <div>
      <button
        disabled={isPending}
        onClick={() => !isPending && setOpen(o => o === null ? !isOpen : !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', border: 'none', cursor: isPending ? 'default' : 'pointer',
          background: '#f8fafc', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9',
          textAlign: 'left',
        }}
      >
        <div style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {isRunning && <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #3b82f6', borderTopColor: 'transparent' }} className="spin" />}
          {isPassed && <span>✅</span>}
          {isFailed && <AlertCircle size={14} color="#dc2626" />}
          {isPending && <div style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #cbd5e1' }} />}
        </div>
        <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {phase.label}
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8' }}>
          {isDone ? `${phase.steps.length} steps · ${(phase.totalMs / 1000).toFixed(1)}s` : ''}
        </div>
        {!isPending && (
          isOpen ? <ChevronDown size={12} color="#94a3b8" /> : <ChevronRight size={12} color="#94a3b8" />
        )}
      </button>
      {isOpen && !isPending && (
        <div>
          {phase.steps.length === 0
            ? <div style={{ padding: '8px 12px', fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Waiting for steps…</div>
            : phase.steps.map(s => <StepItem key={s.step} step={s} />)
          }
        </div>
      )}
    </div>
  );
}

function LiveProgressPanel({ steps, runStatus, runId, durationMs }) {
  const navigate  = useNavigate();
  const isRunning = runStatus === 'running';
  const isDone    = runStatus === 'passed' || runStatus === 'failed';
  const phases    = buildPhases(steps);

  const allSteps  = steps.filter(s => s.step !== 11);
  const completed = allSteps.filter(s => ['pass','passed','fail','failed'].includes(s.status)).length;
  const total     = allSteps.length;
  const failed    = allSteps.filter(s => ['fail','failed'].includes(s.status)).length;
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {isRunning && <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />}
        {runStatus === 'passed' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />}
        {runStatus === 'failed' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', flexShrink: 0 }} />}
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', flex: 1 }}>
          {isRunning ? 'Live Test Progress' : 'Test Run Complete'}
        </div>
        {runId && (
          <span style={{ fontSize: 10, color: '#94a3b8', background: '#e2e8f0', padding: '2px 8px', borderRadius: 99 }}>
            Run #{runId}
          </span>
        )}
      </div>

      {phases.map(ph => <PhaseGroup key={ph.key} phase={ph} forceOpen={isDone} />)}

      {total > 0 && (
        <div style={{ padding: '12px 16px 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
            <span>{completed} of {total} steps</span>
            <span style={{ color: isDone && failed > 0 ? '#d97706' : '#94a3b8' }}>
              {pct}%
            </span>
          </div>
          <div style={{ height: 4, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99, transition: 'width 0.4s',
              width: pct + '%', background: failed > 0 ? '#ef4444' : '#16a34a',
            }} />
          </div>
        </div>
      )}

      {isDone && (
        <div style={{
          margin: '8px 16px 12px',
          padding: '10px 14px',
          borderRadius: 8,
          background: runStatus === 'passed' ? '#f0fdf4' : '#fef2f2',
          border: '1px solid ' + (runStatus === 'passed' ? '#bbf7d0' : '#fecaca'),
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {runStatus === 'passed'
              ? <CheckCircle2 size={16} color="#16a34a" />
              : <AlertCircle size={16} color="#dc2626" />}
            <span style={{ fontSize: 12, fontWeight: 600, color: runStatus === 'passed' ? '#15803d' : '#b91c1c' }}>
              {runStatus === 'passed' ? 'All tests passed' : 'Run failed'}
            </span>
            {durationMs && (
              <span style={{ fontSize: 11, color: '#94a3b8' }}>· {(durationMs / 1000).toFixed(1)}s</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <a href="/report" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: '#2563eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
              <ExternalLink size={12} /> Allure Report
            </a>
            {runId && (
              <button
                onClick={() => navigate('/runs/' + runId)}
                style={{ fontSize: 11, color: '#64748b', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                View Details →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [runs,      setRuns]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();
  const { runStatus, steps, runId, durationMs } = useLiveStatus();

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    if (runStatus === 'passed' || runStatus === 'failed') setTimeout(fetchData, 1000);
  }, [runStatus]);

  async function fetchData() {
    try { setRuns(await fetch('/api/runs').then(r => r.json())); } catch (_) {}
    setLoading(false);
  }

  async function triggerRun() {
    setShowModal(false);
    try {
      await fetch('/api/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suite: 'all', region: 'poland', testCase: 'all' }),
      });
    } catch (_) {}
  }

  const isRunning   = runStatus === 'running';
  const showProgress = isRunning || runStatus === 'passed' || runStatus === 'failed';
  const completed   = runs.filter(r => ['passed','failed'].includes(r.status));
  const passRate    = completed.length
    ? Math.round(runs.filter(r => r.status === 'passed').length / completed.length * 100) : 0;
  const durations   = runs.filter(r => r.duration_ms > 0);
  const avgSec      = durations.length
    ? Math.round(durations.reduce((s, r) => s + r.duration_ms, 0) / durations.length / 1000) : null;

  const sparkRuns  = runs.slice(0, 7).reverse();
  const sparkPass  = sparkRuns.map(r => r.status === 'passed' ? 1 : 0);
  const sparkDur   = sparkRuns.map(r => r.duration_ms || 0);

  const maxDur = Math.max(...PHASE_TIMING.map(p => p.dur));

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <RefreshCw size={24} color="#94a3b8" className="spin" />
    </div>
  );

  return (
    <>
      <TopBar
        title="Dashboard"
        subtitle="OTM Sanity Test Automation"
        actions={
          <>
            <OutlineBtn onClick={fetchData}><RefreshCw size={12} /> Refresh</OutlineBtn>
            <PrimaryBtn onClick={() => setShowModal(true)} disabled={isRunning}>
              {isRunning ? <><RefreshCw size={12} className="spin" /> Running…</> : <><Play size={12} /> Run Tests</>}
            </PrimaryBtn>
          </>
        }
      />

      <div style={{ padding: 24 }}>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          <KpiCard value={runs.length} label="Total Runs"
            delta={runs.length > 0 ? '+' + runs.length + ' this week' : null} deltaUp
            sparkData={sparkRuns.map((_, i) => i + 1)} sparkColor="#2563eb" />
          <KpiCard value={passRate + '%'} label="Pass Rate"
            delta={passRate >= 70 ? passRate - 60 + '% above target' : null} deltaUp={passRate >= 70}
            sparkData={sparkPass.map(v => v * 100)} sparkColor="#16a34a" />
          <KpiCard value={avgSec ? avgSec + 's' : '—'} label="Avg Duration"
            sparkData={sparkDur} sparkColor="#7c3aed" />
          <KpiCard value="9" label="Flaky Steps"
            delta="2 more than last week" deltaUp={false}
            sparkData={[3,5,6,4,8,7,9]} sparkColor="#dc2626" />
        </div>

        {/* Live progress */}
        {showProgress && (
          <div style={{ marginBottom: 20 }}>
            <LiveProgressPanel steps={steps} runStatus={runStatus} runId={runId} durationMs={durationMs} />
          </div>
        )}

        {/* Two-column: Trend + Region health */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          {/* Pass rate trend */}
          <div style={{ ...C.card }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>
              Pass Rate — 14-day trend
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12 }}>Daily pass rate %</div>
            <TrendChart />
          </div>

          {/* Region health */}
          <div style={{ ...C.card }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 12 }}>
              Region Health
            </div>
            <RegionRow flag="🇵🇱" name="Poland"  sub="Europe · OTM v24"  pct={74} status="PASS" />
            <RegionRow flag="🇹🇷" name="Turkey"  sub="Europe · OTM v24"  pct={61} status="WARN" />
            <RegionRow flag="🇩🇪" name="Germany" sub="Europe · OTM v24"  pct={83} status="PASS" />
            <RegionRow flag="🇧🇷" name="Brazil"  sub="LATAM · OTM v23"   pct={38} status="FAIL" />
          </div>
        </div>

        {/* Two-column: Phase timing + Heatmap */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          {/* Phase timing */}
          <div style={{ ...C.card }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 2 }}>
              Phase Timing Breakdown
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12 }}>Average step duration per phase</div>
            {PHASE_TIMING.map(p => (
              <PhaseTimingRow key={p.name} {...p} maxDur={maxDur} />
            ))}
          </div>

          {/* Heatmap */}
          <div style={{ ...C.card }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 2 }}>
              Step Failure Heatmap
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 10 }}>Flaky steps — last 7 days</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, paddingLeft: 208 }}>
              {DAY_LABELS.map((d, i) => (
                <div key={i} style={{ width: 24, textAlign: 'center', fontSize: 9, fontWeight: 600, color: '#94a3b8' }}>{d}</div>
              ))}
            </div>
            {HEATMAP_DATA.map(r => <HeatmapRow key={r.name} {...r} />)}
            <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 10 }}>
              {[['P','Pass','#dcfce7','#15803d'],['W','Warn','#fef3c7','#92400e'],['F','Fail','#fee2e2','#b91c1c']].map(([k,l,bg,tx]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 2, background: bg, color: tx, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k}</div>
                  <span style={{ color: '#94a3b8' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent runs */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>Recent Runs</div>
            <button
              onClick={() => navigate('/runs')}
              style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              View all →
            </button>
          </div>
          {runs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8', fontSize: 13 }}>
              No runs yet — click <strong style={{ color: '#475569' }}>Run Tests</strong> to start
            </div>
          ) : (
            runs.slice(0, 8).map(run => (
              <RunRow key={run.id} run={run} onClick={() => navigate('/runs/' + run.id)} />
            ))
          )}
        </div>
      </div>

      {/* Run modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16,
        }}>
          <div style={{ background: '#ffffff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Run Tests</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 22 }}>🇵🇱</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Europe — Poland</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>OTM Automation Suite</div>
              </div>
            </div>
            {[['1','Login'],['2','Poland OTM E2E — SAP order integration with delivery note']].map(([n, l]) => (
              <div key={n} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, marginBottom: 6,
                fontSize: 12, color: '#475569',
              }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>{n}</span>
                {l}
              </div>
            ))}
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 20, marginTop: 8 }}>
              Both tests run in sequence. Login runs first, then Poland E2E.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <OutlineBtn onClick={() => setShowModal(false)}>Cancel</OutlineBtn>
              <PrimaryBtn onClick={triggerRun}><Play size={12} /> Run Now</PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
