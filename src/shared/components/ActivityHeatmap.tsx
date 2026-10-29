'use client';

import { useMemo } from 'react';
import type { ActivityDay } from '@/features/profile/services/activityService';

interface Props {
  activity: ActivityDay[];
  showLegend?: boolean;
}

// Export legend component for external use
export function ActivityLegend() {
  return (
    <div className="flex items-center gap-1 text-[10px] text-muted">
      <span>Less</span>
      <div className="flex gap-[2px]">
        {([0, 1, 2, 3, 4] as const).map(level => (
          <div
            key={level}
            className={`w-[10px] h-[10px] rounded-sm ${
              level === 0 ? 'bg-[#161b22]' :
              level === 1 ? 'bg-[#0e4429]' :
              level === 2 ? 'bg-[#006d32]' :
              level === 3 ? 'bg-[#26a641]' : 'bg-[#39d353]'
            }`}
          />
        ))}
      </div>
      <span>More</span>
    </div>
  );
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DAYS = ['Lun', '', 'Mié', '', 'Vie', '', 'Dom'];

const LEVEL_COLORS = {
  0: 'bg-[#161b22]',
  1: 'bg-[#0e4429]',
  2: 'bg-[#006d32]',
  3: 'bg-[#26a641]',
  4: 'bg-[#39d353]'
};

export function ActivityHeatmap({ activity, showLegend = true }: Props) {
  const { weeks, monthLabels } = useMemo(() => {
    const recentActivity = activity.slice(-364);

    const weeksData: ActivityDay[][] = [];
    for (let i = 0; i < recentActivity.length; i += 7) {
      weeksData.push(recentActivity.slice(i, i + 7));
    }

    const labels: { month: string; col: number }[] = [];
    let lastMonth = -1;

    weeksData.forEach((week, weekIndex) => {
      if (week[0]) {
        const date = new Date(week[0].date);
        const month = date.getMonth();
        if (month !== lastMonth) {
          labels.push({ month: MONTHS[month], col: weekIndex });
          lastMonth = month;
        }
      }
    });

    return { weeks: weeksData, monthLabels: labels };
  }, [activity]);

  const totalWeeks = weeks.length;

  return (
    <div className="w-full">
      {/* Month labels - using grid to align with columns */}
      <div
        className="grid text-[10px] text-muted mb-1 ml-7"
        style={{ gridTemplateColumns: `repeat(${totalWeeks}, 1fr)` }}
      >
        {Array.from({ length: totalWeeks }).map((_, i) => {
          const label = monthLabels.find(l => l.col === i);
          return (
            <span key={i} className="truncate">
              {label?.month || ''}
            </span>
          );
        })}
      </div>

      {/* Grid with day labels */}
      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col justify-between text-[9px] text-muted w-6 flex-shrink-0 py-[2px]">
          {DAYS.map((day, i) => (
            <span key={i} className="h-full flex items-center">
              {day}
            </span>
          ))}
        </div>

        {/* Activity grid - fills remaining width */}
        <div
          className="flex-1 grid gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${totalWeeks}, 1fr)` }}
        >
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid gap-[3px]" style={{ gridTemplateRows: 'repeat(7, 1fr)' }}>
              {Array.from({ length: 7 }).map((_, dayIndex) => {
                const day = week[dayIndex];
                return (
                  <div
                    key={`${weekIndex}-${dayIndex}`}
                    className={`aspect-square rounded-sm ${LEVEL_COLORS[day?.level || 0]} hover:ring-1 hover:ring-white/40 transition-all`}
                    title={day ? `${day.date}: ${day.count} contribuciones` : ''}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex items-center justify-end mt-2">
          <ActivityLegend />
        </div>
      )}
    </div>
  );
}
