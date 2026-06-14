import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Activity } from 'lucide-react';
import useLiveStatus from '../hooks/useLiveStatus';

const SECTIONS = [
  {
    label: 'Monitoring',
    items: [
      { to: '/',     label: 'Dashboard' },
      { to: '/live', label: 'Live Run',    live: true },
      { to: '/runs', label: 'Run History' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { to: '/registry', label: 'Test Registry' },
    ],
  },
  {
    label: 'Regions',
    items: [
      { to: '/registry/poland',  label: 'Poland',  flag: '🇵🇱' },
      { to: '/registry/turkey',  label: 'Turkey',  flag: '🇹🇷' },
      { to: '/registry/germany', label: 'Germany', flag: '🇩🇪' },
      { to: '/registry/brazil',  label: 'Brazil',  flag: '🇧🇷' },
    ],
  },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const { runStatus } = useLiveStatus();
  const isRunning = runStatus === 'running';

  const isActive = (to) => {
    if (to === '/') return pathname === '/';
    return pathname === to || pathname.startsWith(to + '/');
  };

  return (
    <aside style={{
      width: 220,
      minWidth: 220,
      background: '#0f172a',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      overflowY: 'auto',
      borderRight: '1px solid #1e2433',
    }}>
      {/* Brand */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #1e2433' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: '#1e3a6e', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Activity size={16} color="#93c5fd" />
          </div>
          <div>
            <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 13, lineHeight: '1.2' }}>
              OTM Portal
            </div>
            <div style={{ color: '#475569', fontSize: 10, marginTop: 1 }}>
              Automation Suite
            </div>
          </div>
        </div>
      </div>

      {/* Nav sections */}
      <nav style={{ flex: 1, padding: '8px 0' }}>
        {SECTIONS.map(section => (
          <div key={section.label} style={{ marginBottom: 4 }}>
            <div style={{
              padding: '10px 16px 4px',
              fontSize: 10,
              fontWeight: 600,
              color: '#475569',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}>
              {section.label}
            </div>
            {section.items.map(item => {
              const active = isActive(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 16px',
                    margin: '1px 8px',
                    borderRadius: 6,
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    color: active ? '#93c5fd' : '#94a3b8',
                    background: active ? '#1e3a6e' : 'transparent',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#e2e8f0'; } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; } }}
                >
                  {item.flag && <span style={{ fontSize: 14 }}>{item.flag}</span>}
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.live && (
                    <span
                      className={isRunning ? 'pulse-dot' : ''}
                      style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: isRunning ? '#3b82f6' : '#334155',
                        flexShrink: 0,
                      }}
                    />
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        margin: '8px 8px 12px',
        padding: '8px 12px',
        background: '#0a111e',
        borderRadius: 6,
        border: '1px solid #1e2433',
      }}>
        <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Environment
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: 600 }}>
          OTM TEST
        </div>
      </div>
    </aside>
  );
}
