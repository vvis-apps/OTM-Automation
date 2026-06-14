import React from 'react';
import { RefreshCw } from 'lucide-react';

export default function TopBar({ title, subtitle, actions }) {
  return (
    <div style={{
      height: 52,
      background: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      flexShrink: 0,
    }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', lineHeight: '1.2' }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
            {subtitle}
          </div>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {actions}
        </div>
      )}
    </div>
  );
}

export function OutlineBtn({ onClick, children, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 14px',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        background: '#ffffff',
        color: '#475569',
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex', alignItems: 'center', gap: 6,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = '#f8fafc'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; }}
    >
      {children}
    </button>
  );
}

export function PrimaryBtn({ onClick, children, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 14px',
        border: 'none',
        borderRadius: 8,
        background: disabled ? '#93c5fd' : '#2563eb',
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', gap: 6,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = '#1d4ed8'; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = '#2563eb'; }}
    >
      {children}
    </button>
  );
}
