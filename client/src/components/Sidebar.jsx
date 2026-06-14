import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Radio, History, FlaskConical, Settings, Activity, BarChart2 } from 'lucide-react';
import { useRunContext } from '../context/RunContext';

const s = {
  root: {
    width: 220, minWidth: 220, background: '#0f172a',
    display: 'flex', flexDirection: 'column', height: '100vh',
    borderRight: '1px solid #1e2433', overflowY: 'auto', flexShrink: 0,
  },
  logo: { padding: '20px 16px 16px', borderBottom: '1px solid #1e2433' },
  logoInner: { display: 'flex', alignItems: 'center', gap: 10 },
  logoIcon: {
    width: 32, height: 32, borderRadius: 8, background: '#1e3a6e',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoTitle: { color: '#f1f5f9', fontSize: 13, fontWeight: 600, lineHeight: 1.2 },
  logoSub:   { color: '#475569', fontSize: 10 },
  sectionLabel: {
    padding: '12px 16px 4px',
    fontSize: 10, fontWeight: 600, color: '#475569',
    textTransform: 'uppercase', letterSpacing: '0.07em',
  },
  footer: { padding: '12px 16px', borderTop: '1px solid #1e2433' },
  footerBadge: {
    background: '#1e293b', borderRadius: 6, padding: '6px 10px',
    fontSize: 10, fontWeight: 600, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center',
  },
};

function navStyle({ isActive }) {
  return {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '7px 8px', margin: '1px 8px', borderRadius: 6,
    fontSize: 13, fontWeight: isActive ? 600 : 400,
    color: isActive ? '#93c5fd' : '#94a3b8',
    background: isActive ? '#1e3a6e' : 'transparent',
    textDecoration: 'none', transition: 'all 0.15s',
  };
}

const REGIONS = [
  { to: '/registry/poland',  flag: '🇵🇱', label: 'Poland' },
  { to: '/registry/turkey',  flag: '🇹🇷', label: 'Turkey' },
  { to: '/registry/germany', flag: '🇩🇪', label: 'Germany' },
  { to: '/registry/brazil',  flag: '🇧🇷', label: 'Brazil' },
];

export default function Sidebar() {
  const { runStatus } = useRunContext();
  const running = runStatus === 'running';

  return (
    <div style={s.root}>
      {/* Logo */}
      <div style={s.logo}>
        <div style={s.logoInner}>
          <div style={s.logoIcon}><Activity size={16} color="#93c5fd" /></div>
          <div>
            <div style={s.logoTitle}>OTM Portal</div>
            <div style={s.logoSub}>Automation</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: '8px 0' }}>

        {/* Monitoring */}
        <div style={s.sectionLabel}>Monitoring</div>
        <NavLink to="/" end style={navStyle}>
          {({ isActive }) => (
            <>
              <LayoutDashboard size={14} color={isActive ? '#93c5fd' : '#64748b'} />
              <span style={{ flex: 1 }}>Dashboard</span>
            </>
          )}
        </NavLink>
        <NavLink to="/live" style={navStyle}>
          {({ isActive }) => (
            <>
              <Radio size={14} color={isActive ? '#93c5fd' : '#64748b'} />
              <span style={{ flex: 1 }}>Live Run</span>
              {running && <span className="live-dot" />}
            </>
          )}
        </NavLink>
        <NavLink to="/runs" style={navStyle}>
          {({ isActive }) => (
            <>
              <History size={14} color={isActive ? '#93c5fd' : '#64748b'} />
              <span style={{ flex: 1 }}>Run History</span>
            </>
          )}
        </NavLink>
        <NavLink to="/analytics" style={navStyle}>
          {({ isActive }) => (
            <>
              <BarChart2 size={14} color={isActive ? '#93c5fd' : '#64748b'} />
              <span style={{ flex: 1 }}>Analytics</span>
            </>
          )}
        </NavLink>

        {/* Configuration */}
        <div style={{ ...s.sectionLabel, marginTop: 12 }}>Configuration</div>
        <NavLink to="/registry" style={navStyle}>
          {({ isActive }) => (
            <>
              <FlaskConical size={14} color={isActive ? '#93c5fd' : '#64748b'} />
              <span style={{ flex: 1 }}>Test Registry</span>
            </>
          )}
        </NavLink>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', margin: '1px 8px', borderRadius: 6, fontSize: 13, color: '#334155', opacity: 0.5, cursor: 'not-allowed' }}>
          <Settings size={14} color="#334155" />
          <span>Settings</span>
        </div>

        {/* Regions */}
        <div style={{ ...s.sectionLabel, marginTop: 12 }}>Regions</div>
        {REGIONS.map(({ to, flag, label }) => (
          <NavLink key={to} to={to} style={navStyle}>
            {() => (
              <>
                <span style={{ fontSize: 14, lineHeight: 1 }}>{flag}</span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Footer */}
      <div style={s.footer}>
        <div style={s.footerBadge}>OTM TEST</div>
      </div>
    </div>
  );
}
