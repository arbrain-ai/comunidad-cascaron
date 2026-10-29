'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ActiveMembersData } from '../../services/cohortAnalyticsService';

interface ActiveMembersChartProps {
  data: ActiveMembersData;
  summary?: {
    totalMembers: number;
    activeMembers: number;
    activePct: number;
    changeText: string;
  };
}

type ViewMode = 'total' | 'active';

// Format date label
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Custom tooltip with glassmorphism style
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="glass-panel-strong rounded-lg p-3 border border-glass-border-strong">
      <p className="text-xs text-muted mb-2">{formatDate(label)}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-sm font-bold text-foreground">{entry.value}</span>
          <span className="text-xs text-muted">
            {entry.dataKey === 'total' ? 'total' : 'active'}
          </span>
        </div>
      ))}
    </div>
  );
};

export function ActiveMembersChart({ data, summary }: ActiveMembersChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('total');

  if (!data || data.history.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-6 h-[450px] flex items-center justify-center">
        <p className="text-muted">No active members data available</p>
      </div>
    );
  }

  // Summary message (Skool-style)
  const summaryText = summary
    ? `In the past 30 days, your group ${summary.changeText} and ${summary.activeMembers} members (${summary.activePct}%) were active.`
    : `${data.activeMembers} of ${data.totalMembers} members (${data.activePct}%) are active.`;

  return (
    <div className="space-y-6">
      {/* Summary Banner */}
      <div className="glass-panel-strong rounded-xl p-6 text-center">
        <p className="text-xl md:text-2xl font-bold text-foreground leading-relaxed">
          {summaryText}
        </p>
      </div>

      {/* Total Members Chart */}
      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground">Total members</h3>
        </div>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(139, 92, 246, 0.1)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                width={40}
                domain={['dataMin - 5', 'dataMax + 5']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#8b5cf6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Active Members Chart */}
      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground">Active members</h3>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as ViewMode)}
            className="solid-card !rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="active">Monthly active</option>
            <option value="total">Daily active</option>
          </select>
        </div>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(139, 92, 246, 0.1)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                width={40}
                domain={[0, 'dataMax + 10']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="active"
                stroke="#eab308"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#eab308' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{data.totalMembers}</p>
          <p className="text-xs text-muted mt-1">Total Members</p>
        </div>
        <div className="glass-panel rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-success">{data.activeMembers}</p>
          <p className="text-xs text-muted mt-1">Active (30d)</p>
        </div>
        <div className="glass-panel rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-primary">{data.activePct}%</p>
          <p className="text-xs text-muted mt-1">Retention</p>
        </div>
        <div className="glass-panel rounded-xl p-4 text-center">
          <p
            className={`text-2xl font-bold ${data.change >= 0 ? 'text-success' : 'text-error'}`}
          >
            {data.change >= 0 ? '+' : ''}
            {data.change}
          </p>
          <p className="text-xs text-muted mt-1">Change (30d)</p>
        </div>
      </div>
    </div>
  );
}
