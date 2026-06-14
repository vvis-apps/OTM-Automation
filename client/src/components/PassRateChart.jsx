import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const sec = (d.duration_ms / 1000).toFixed(1);
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <div className="font-semibold text-slate-800 mb-1">{d.label}</div>
      <div className={`font-bold ${d.status === 'passed' ? 'text-emerald-600' : 'text-red-500'}`}>
        {d.status === 'passed' ? '✓ Passed' : '✗ Failed'}
      </div>
      <div className="text-slate-500 mt-1">{sec}s duration</div>
      <div className="text-slate-400 text-xs mt-0.5">
        {new Date(d.started_at).toLocaleString()}
      </div>
    </div>
  );
}

export default function PassRateChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        No completed runs yet
      </div>
    );
  }

  const chartData = data.map(r => ({
    ...r,
    label:    'Run #' + r.id,
    duration_s: parseFloat((r.duration_ms / 1000).toFixed(1)),
  }));

  const maxSec = Math.max(...chartData.map(d => d.duration_s));

  return (
    <div>
      <div className="flex items-center gap-4 mb-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" /> Passed</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> Failed</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }} barSize={28}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, Math.ceil(maxSec * 1.2)]}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            unit="s"
            width={36}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
          <Bar dataKey="duration_s" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.status === 'passed' ? '#34d399' : '#f87171'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
