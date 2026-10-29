'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import type { MemberGrowthData } from '../../services/cohortAnalyticsService';

interface MemberGrowthChartProps {
  data: MemberGrowthData[];
  title?: string;
}

// Colors matching Skool palette
const COLORS = {
  base: '#3b82f6', // Blue - existing members
  new: '#22c55e', // Green - new members
  churned: '#ef4444', // Red - churned members
  line: '#8b5cf6', // Purple - trend line
};

// Format month label
const formatMonth = (dateStr: string | undefined | null) => {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const [year, month] = dateStr.split('-');
  if (!year || !month) return '';
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
};

// Custom tooltip with glassmorphism style
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="glass-panel-strong rounded-lg p-4 border border-glass-border-strong min-w-[160px]">
      <p className="text-xs text-muted mb-2 font-medium">{formatMonth(label)}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.base }} />
            <span className="text-xs text-muted">Base</span>
          </div>
          <span className="text-sm font-bold text-foreground">
            {data.totalMembers - data.newMembers}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.new }} />
            <span className="text-xs text-muted">New</span>
          </div>
          <span className="text-sm font-bold text-success">+{data.newMembers}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.churned }} />
            <span className="text-xs text-muted">Churned</span>
          </div>
          <span className="text-sm font-bold text-error">-{data.churnedMembers}</span>
        </div>
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-muted">Net</span>
            <span
              className={`text-sm font-bold ${data.netGrowth >= 0 ? 'text-success' : 'text-error'}`}
            >
              {data.netGrowth >= 0 ? '+' : ''}
              {data.netGrowth}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Custom legend
const CustomLegend = () => (
  <div className="flex items-center justify-center gap-6 mt-4">
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.base }} />
      <span className="text-xs text-muted">Existing</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.new }} />
      <span className="text-xs text-muted">New</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.churned }} />
      <span className="text-xs text-muted">Churned</span>
    </div>
  </div>
);

export function MemberGrowthChart({ data, title = 'Members' }: MemberGrowthChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-6 h-[350px] flex items-center justify-center">
        <p className="text-muted">No member growth data available</p>
      </div>
    );
  }

  // Transform data for stacked bar chart
  // Base = totalMembers - newMembers (existing members)
  // New = newMembers
  // We'll show churned as negative bars below the axis
  const chartData = data.map((d) => ({
    ...d,
    baseLine: d.totalMembers - d.newMembers,
    newLine: d.newMembers,
    churnedLine: -d.churnedMembers, // Negative for below axis
  }));

  // Find max for y-axis domain
  const maxTotal = Math.max(...data.map((d) => d.totalMembers));
  const maxChurn = Math.max(...data.map((d) => d.churnedMembers));

  return (
    <div className="glass-panel rounded-xl p-6">
      <h3 className="text-lg font-bold text-foreground mb-4">{title}</h3>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            stackOffset="sign"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(139, 92, 246, 0.1)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonth}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#a1a1aa', fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#a1a1aa', fontSize: 11 }}
              width={40}
              domain={[-maxChurn * 1.5, maxTotal * 1.1]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(139, 92, 246, 0.05)' }} />
            <ReferenceLine y={0} stroke="rgba(139, 92, 246, 0.2)" />

            {/* Stacked bars */}
            <Bar dataKey="baseLine" stackId="members" fill={COLORS.base} radius={[0, 0, 0, 0]} />
            <Bar dataKey="newLine" stackId="members" fill={COLORS.new} radius={[4, 4, 0, 0]} />
            <Bar dataKey="churnedLine" fill={COLORS.churned} radius={[0, 0, 4, 4]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <CustomLegend />
    </div>
  );
}
