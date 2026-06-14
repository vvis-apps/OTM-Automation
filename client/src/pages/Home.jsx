import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, ArrowDown } from 'lucide-react';

function Sparkline({ data, lightColor, boldColor }) {
  const max = Math.max(...data, 1);
  const last = data.length - 1;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 28, marginTop: 10 }}>
      {data.map((v, i) => (
        <div key={i} style={{
          flex: 1, borderRadius: 2,
          height: Math.max(4, (v / max) * 28),
          background: i === last ? boldColor : lightColor,
        }} />
      ))}
    </div>
  );
}

function KpiCard({ value, label, delta, deltaUp, sparkData, lightColor, boldColor }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a' }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginTop: 3 }}>{label}</div>
      {delta && (
        <div style={{ fontSize: 11, marginTop: 5, display: 'flex', alignItems: 'center', gap: 3, color: deltaUp ? '#16a34a' : '#dc2626' }}>
          {deltaUp ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
          {delta}
        </div>
      )}
      <Sparkline data={sparkData} lightColor={lightColor} boldColor={boldColor} />
    </div>
  );
}

function RegionRow({ flag, name, sub, pct, status }) {
  const c = {
    PASS: { bar: '#16a34a', bg: '#dcfce7', text: '#15803d' },
    WARN: { bar: '#d97706', bg: '#fef3c7', text: '#92400e' },
    FAIL: { bar: '#dc2626', bg: '#fee2e2', text: '#b91c1c' },
    NONE: { bar: '#e2e8f0', bg: 'transparent', text: '#94a3b8' },
  }[status] || {};
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #f8fafc' }}>
      <span style={{ fontSize: 18 }}>{flag}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{name}</div>
        <div style={{ fontSize: 10, color: '#94a3b8' }}>{sub}</div>
      </div>
      {status !== 'NONE' && (
        <>
          <div style={{ width: 60, height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: pct + '%', height: '100%', background: c.bar, borderRadius: 2 }} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', width: 34, textAlign: 'right' }}>{pct}%</div>
          <div style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: c.bg, color: c.text, flexShrink: 0 }}>{status}</div>
        </>
      )}
      {status === 'NONE' && (
        <div style={{ fontSize: 11, fontStyle: 'italic', color: '#94a3b8', flexShrink: 0 }}>No runs yet</div>
      )}
    </div>
  );
}

function Card({ title, subtitle, children, style }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, ...style }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function passRateOf(arr) {
  const done = arr.filter(r => r.status === 'passed' || r.status === 'failed');
  if (!done.length) return null;
  return Math.round(arr.filter(r => r.status === 'passed').length / done.length * 100);
}

function avgSecOf(arr) {
  const d = arr.filter(r => r.duration_ms > 0);
  if (!d.length) return null;
  return Math.round(d.reduce((s, r) => s + r.duration_ms, 0) / d.length / 1000);
}

function weekBucket(runs) {
  const now  = Date.now();
  const week = 7 * 24 * 3600 * 1000;
  const thisW = runs.filter(r => now - new Date(r.started_at).getTime() < week);
  const prevW = runs.filter(r => {
    const age = now - new Date(r.started_at).getTime();
    return age >= week && age < 2 * week;
  });
  return { thisW, prevW };
}

function regionStats(runs) {
  const byRegion = {};
  for (const r of runs) {
    if (!byRegion[r.region]) byRegion[r.region] = [];
    byRegion[r.region].push(r);
  }
  return byRegion;
}

export default function Home() {
  const [runs,    setRuns]  = useState([]);
  const [loading, setLoad]  = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/runs?limit=100').then(r => r.json()).catch(() => [])
      .then(r => { setRuns(Array.isArray(r) ? r : []); setLoad(false); });
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #2563eb', borderTopColor: 'transparent' }} className="spin" />
      </div>
    );
  }

  // ── KPI derivations ───────────────────────────────────────────────────────
  const { thisW, prevW } = weekBucket(runs);
  const passRate = passRateOf(runs) ?? 0;
  const avgSec   = avgSecOf(runs)   ?? 0;

  const prThis = passRateOf(thisW);
  const prPrev = passRateOf(prevW);
  const prDelta = (prThis !== null && prPrev !== null)
    ? (prThis - prPrev > 0 ? `+${prThis - prPrev}% vs last week` : `${prThis - prPrev}% vs last week`)
    : null;
  const prDeltaUp = (prThis ?? 0) >= (prPrev ?? 0);

  const durThis = avgSecOf(thisW);
  const durPrev = avgSecOf(prevW);
  const durDelta = (durThis !== null && durPrev !== null)
    ? (durThis - durPrev < 0 ? `${durThis - durPrev}s vs last week` : `+${durThis - durPrev}s vs last week`)
    : null;
  const durDeltaUp = (durThis ?? 999) <= (durPrev ?? 999);

  const runDelta = thisW.length > 0 ? `+${thisW.length} this week` : null;

  // Sparklines — last 7 runs
  const last7 = [...runs].slice(0, 7).reverse();
  const passSpark = last7.length ? last7.map(r => r.status === 'passed' ? 100 : 0) : [0];
  const durSpark  = last7.length ? last7.map(r => r.duration_ms ? r.duration_ms / 1000 : 0) : [0];
  const runSpark  = last7.length ? last7.map((_, i) => i + 1) : [1];

  // Region health — only from real run data
  const byRegion = regionStats(runs);
  const REGION_META = [
    { key: 'poland',  flag: '🇵🇱', name: 'Poland',  sub: 'Europe · OTM Automation' },
    { key: 'turkey',  flag: '🇹🇷', name: 'Turkey',  sub: 'Europe · OTM Automation' },
    { key: 'germany', flag: '🇩🇪', name: 'Germany', sub: 'Europe · OTM Automation' },
    { key: 'brazil',  flag: '🇧🇷', name: 'Brazil',  sub: 'South America · OTM Automation' },
  ];

  const regionRows = REGION_META.map(({ key, flag, name, sub }) => {
    const rr  = byRegion[key] || [];
    const pct = passRateOf(rr) ?? 0;
    const status = rr.length === 0 ? 'NONE' : pct >= 70 ? 'PASS' : pct >= 50 ? 'WARN' : 'FAIL';
    return { flag, name, sub, pct, status };
  });

  const last5 = runs.slice(0, 5);

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard value={runs.length} label="TOTAL RUNS" delta={runDelta} deltaUp sparkData={runSpark}  lightColor="#bfdbfe" boldColor="#2563eb" />
        <KpiCard value={passRate + '%'} label="PASS RATE" delta={prDelta} deltaUp={prDeltaUp} sparkData={passSpark} lightColor="#bbf7d0" boldColor="#16a34a" />
        <KpiCard value={avgSec + 's'} label="AVG DURATION" delta={durDelta} deltaUp={durDeltaUp} sparkData={durSpark} lightColor="#fed7aa" boldColor="#d97706" />
        <KpiCard value={last5.filter(r => r.status === 'failed').length} label="RECENT FAILURES" sparkData={last7.map(r => r.status === 'failed' ? 1 : 0)} lightColor="#fecaca" boldColor="#dc2626" />
      </div>

      {/* Region Health */}
      <Card title="Region Health" subtitle="Current pass rate by region" style={{ marginBottom: 16 }}>
        {regionRows.map(r => <RegionRow key={r.name} {...r} />)}
      </Card>

      {/* Recent Runs */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Recent Runs</div>
          <button onClick={() => navigate('/runs')} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View all →</button>
        </div>
        {last5.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8', fontSize: 13 }}>
            No runs yet — click <strong style={{ color: '#475569' }}>Run Tests</strong> to start
          </div>
        ) : (
          last5.map(run => {
            const flagMap = { poland: '🇵🇱', turkey: '🇹🇷', germany: '🇩🇪', brazil: '🇧🇷' };
            return (
              <div key={run.id}
                onClick={() => navigate('/runs/' + run.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 20px', borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: run.status === 'passed' ? '#16a34a' : run.status === 'failed' ? '#dc2626' : '#d97706' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>Run #{run.id} — {run.environment || 'test'}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{new Date(run.started_at).toLocaleString()}</div>
                </div>
                <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#dbeafe', color: '#1d4ed8', fontWeight: 600 }}>
                  {flagMap[run.region] || ''} {run.region_label || run.region || 'Poland'}
                </div>
                <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, background: run.status === 'passed' ? '#dcfce7' : '#fee2e2', color: run.status === 'passed' ? '#15803d' : '#b91c1c' }}>
                  {run.status === 'passed' ? 'PASS' : 'FAIL'}
                </div>
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8', flexShrink: 0 }}>
                  {run.duration_ms ? (run.duration_ms / 1000).toFixed(1) + 's' : '—'}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
