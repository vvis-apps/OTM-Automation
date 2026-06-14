import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';

function Card({ title, subtitle, children, style }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, ...style }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

function DayPill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 20,
      border: `1px solid ${active ? '#2563eb' : '#e2e8f0'}`,
      background: active ? '#dbeafe' : '#fff',
      color: active ? '#1d4ed8' : '#64748b',
      cursor: 'pointer',
    }}>{label}</button>
  );
}

export default function Analytics() {
  const [runs,        setRuns]        = useState([]);
  const [phaseTiming, setPhaseTiming] = useState([]);
  const [flakySteps,  setFlakySteps]  = useState([]);
  const [days,        setDays]        = useState(14);
  const [loading,     setLoad]        = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/runs?limit=100').then(r => r.json()).catch(() => []),
      fetch('/api/phase-timing').then(r => r.json()).catch(() => []),
      fetch('/api/flaky-steps').then(r => r.json()).catch(() => []),
    ]).then(([r, pt, fs]) => {
      setRuns(Array.isArray(r) ? r : []);
      setPhaseTiming(Array.isArray(pt) ? pt : []);
      setFlakySteps(Array.isArray(fs) ? fs : []);
      setLoad(false);
    });
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #2563eb', borderTopColor: 'transparent' }} className="spin" />
      </div>
    );
  }

  // Pass Rate trend — last N days
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  const trendRuns = [...runs]
    .filter(r => new Date(r.started_at).getTime() >= cutoff && (r.status === 'passed' || r.status === 'failed'))
    .reverse();
  const chartData = trendRuns.map(r => ({
    x: new Date(r.started_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }),
    y: r.status === 'passed' ? 100 : 0,
  }));

  // Phase timing
  const maxPhase = Math.max(...phaseTiming.map(p => p.seconds), 1);
  const phaseBarData = phaseTiming.map(p => ({ name: p.name, seconds: p.seconds }));

  // Flaky steps table
  const flakyWithRate = flakySteps.map(s => ({
    ...s,
    total: s.pass + s.fail,
    rate: Math.round((s.fail / (s.pass + s.fail)) * 100),
  })).sort((a, b) => b.rate - a.rate);

  const TH = { fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' };

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Pass Rate Trend */}
      <Card title="Pass Rate Trend" style={{ marginBottom: 16 }}
        subtitle={`Last ${days} days · ${trendRuns.length} completed runs`}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[7, 14, 30].map(d => <DayPill key={d} label={d + ' days'} active={days === d} onClick={() => setDays(d)} />)}
        </div>
        {chartData.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: '#94a3b8', fontSize: 12 }}>No completed runs in this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="x" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(chartData.length / 8))} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => v + '%'} />
              <Tooltip formatter={v => v + '%'} contentStyle={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a' }} />
              <Area type="monotone" dataKey="y" stroke="#16a34a" strokeWidth={2} fill="url(#pg)" dot={false} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Phase Timing */}
      <Card title="Phase Timing Breakdown" subtitle="Duration per phase · last full-suite run" style={{ marginBottom: 16 }}>
        {phaseBarData.length === 0 ? (
          <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>Run tests to see phase breakdown</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={phaseBarData} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 130 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => v + 's'} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} axisLine={false} tickLine={false} width={130} />
              <Tooltip formatter={v => v + 's'} contentStyle={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 8 }} />
              <Bar dataKey="seconds" radius={[0, 3, 3, 0]}>
                {phaseBarData.map((p, i) => (
                  <Cell key={i} fill={p.name === 'T2 Polling' ? '#dc2626' : '#2563eb'} opacity={p.seconds === 0 ? 0.25 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Flaky Steps Table */}
      <Card title="Flaky Steps" subtitle="Steps with mixed pass/fail outcomes across runs">
        {flakyWithRate.length === 0 ? (
          <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>No flaky steps detected yet — run tests across multiple sessions to see patterns</div>
        ) : (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 80px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '8px 16px', gap: 0 }}>
              {['STEP NAME', 'PASS', 'FAIL', 'FAIL RATE'].map(h => <div key={h} style={TH}>{h}</div>)}
            </div>
            {flakyWithRate.map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 80px', padding: '10px 16px', borderBottom: i < flakyWithRate.length - 1 ? '1px solid #f8fafc' : 'none', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.name}>{s.name}</div>
                <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#15803d', fontWeight: 600 }}>{s.pass}×</div>
                <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#b91c1c', fontWeight: 600 }}>{s.fail}×</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 36, height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: s.rate + '%', height: '100%', background: s.rate >= 60 ? '#dc2626' : '#f59e0b', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: s.rate >= 60 ? '#b91c1c' : '#92400e' }}>{s.rate}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
