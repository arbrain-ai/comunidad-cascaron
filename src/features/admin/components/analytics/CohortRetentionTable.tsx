'use client';

import type { CohortRow } from '../../services/cohortAnalyticsService';

interface CohortRetentionTableProps {
  data: CohortRow[];
  title?: string;
}

// Get background color based on retention percentage (Skool-style green gradient)
function getRetentionColor(pct: number | null): string {
  if (pct === null) return 'transparent';

  // Green scale from dark (high retention) to light (low retention)
  if (pct >= 80) return 'rgba(34, 197, 94, 0.8)'; // green-500 strong
  if (pct >= 60) return 'rgba(34, 197, 94, 0.6)';
  if (pct >= 40) return 'rgba(132, 204, 22, 0.5)'; // lime-500
  if (pct >= 20) return 'rgba(234, 179, 8, 0.5)'; // yellow-500
  if (pct > 0) return 'rgba(249, 115, 22, 0.5)'; // orange-500
  return 'rgba(239, 68, 68, 0.3)'; // red-500
}

// Get text color based on background
function getTextColor(pct: number | null): string {
  if (pct === null) return 'transparent';
  if (pct >= 60) return '#fff';
  return '#18181b'; // zinc-900
}

export function CohortRetentionTable({
  data,
  title = 'Engagement cohorts',
}: CohortRetentionTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-6 h-[400px] flex items-center justify-center">
        <p className="text-muted">No cohort retention data available</p>
      </div>
    );
  }

  // Determine max months to show based on data
  const maxMonths = Math.max(...data.map((d) => d.retention.filter((r) => r !== null).length));
  const monthHeaders = Array.from({ length: Math.min(maxMonths, 11) }, (_, i) => `MO ${i + 1}`);

  return (
    <div className="glass-panel rounded-xl p-6">
      <h3 className="text-lg font-bold text-foreground mb-4">{title}</h3>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted uppercase tracking-wider sticky left-0 bg-card z-10 min-w-[100px]">
                Month
              </th>
              <th className="text-center py-3 px-3 text-xs font-medium text-muted uppercase tracking-wider min-w-[80px]">
                Members
              </th>
              <th
                colSpan={monthHeaders.length}
                className="text-center py-3 px-3 text-xs font-medium text-muted uppercase tracking-wider"
              >
                % of active members retained after each month
              </th>
            </tr>
            <tr className="border-b border-border/50">
              <th className="sticky left-0 bg-card z-10"></th>
              <th></th>
              {monthHeaders.map((header) => (
                <th
                  key={header}
                  className="text-center py-2 px-2 text-xs font-medium text-muted min-w-[60px]"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr
                key={row.cohortMonth}
                className={`${rowIndex % 2 === 0 ? 'bg-transparent' : 'bg-card/30'} hover:bg-card/50 transition-colors`}
              >
                {/* Month column - sticky */}
                <td className="py-2.5 px-3 font-medium text-foreground sticky left-0 bg-inherit z-10 whitespace-nowrap">
                  {row.cohortLabel}
                </td>

                {/* Members count */}
                <td className="py-2.5 px-3 text-center text-foreground">{row.cohortSize}</td>

                {/* Retention cells with heatmap colors */}
                {monthHeaders.map((_, monthIndex) => {
                  const retention = row.retention[monthIndex];
                  const bgColor = getRetentionColor(retention);
                  const textColor = getTextColor(retention);

                  return (
                    <td key={monthIndex} className="py-1 px-1">
                      {retention !== null ? (
                        <div
                          className="py-2 px-2 rounded text-center font-medium text-xs transition-all hover:scale-105"
                          style={{
                            backgroundColor: bgColor,
                            color: textColor,
                          }}
                        >
                          {retention.toFixed(1)}%
                        </div>
                      ) : (
                        <div className="py-2 px-2"></div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-border">
        <span className="text-xs text-muted">Retention:</span>
        <div className="flex items-center gap-1">
          <div
            className="w-6 h-4 rounded"
            style={{ backgroundColor: 'rgba(34, 197, 94, 0.8)' }}
          />
          <span className="text-xs text-muted">80%+</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-6 h-4 rounded"
            style={{ backgroundColor: 'rgba(34, 197, 94, 0.6)' }}
          />
          <span className="text-xs text-muted">60%+</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-6 h-4 rounded"
            style={{ backgroundColor: 'rgba(132, 204, 22, 0.5)' }}
          />
          <span className="text-xs text-muted">40%+</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-6 h-4 rounded"
            style={{ backgroundColor: 'rgba(234, 179, 8, 0.5)' }}
          />
          <span className="text-xs text-muted">20%+</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-6 h-4 rounded"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.3)' }}
          />
          <span className="text-xs text-muted">&lt;20%</span>
        </div>
      </div>
    </div>
  );
}
