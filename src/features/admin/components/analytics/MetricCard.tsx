'use client';

import { ReactNode } from 'react';

type MetricVariant = 'primary' | 'success' | 'warning' | 'error' | 'gold';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;       // Percentage change
    label?: string;      // e.g., "vs last month"
  };
  icon?: ReactNode;
  variant?: MetricVariant;
  size?: 'default' | 'large';
  glow?: boolean;
}

const variantStyles: Record<MetricVariant, {
  value: string;
  glow: string;
  icon: string;
  trendUp: string;
  trendDown: string;
}> = {
  primary: {
    value: 'text-primary',
    glow: 'shadow-[0_0_30px_rgba(139,92,246,0.3)]',
    icon: 'text-primary/80',
    trendUp: 'text-success',
    trendDown: 'text-error',
  },
  success: {
    value: 'text-success',
    glow: 'shadow-[0_0_30px_rgba(34,197,94,0.3)]',
    icon: 'text-success/80',
    trendUp: 'text-success',
    trendDown: 'text-error',
  },
  warning: {
    value: 'text-warning',
    glow: 'shadow-[0_0_30px_rgba(251,191,36,0.3)]',
    icon: 'text-warning/80',
    trendUp: 'text-success',
    trendDown: 'text-error',
  },
  error: {
    value: 'text-error',
    glow: 'shadow-[0_0_30px_rgba(248,113,113,0.3)]',
    icon: 'text-error/80',
    trendUp: 'text-success',
    trendDown: 'text-error',
  },
  gold: {
    value: 'text-gold',
    glow: 'shadow-[0_0_30px_rgba(255,215,0,0.3)]',
    icon: 'text-gold/80',
    trendUp: 'text-success',
    trendDown: 'text-error',
  },
};

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  variant = 'primary',
  size = 'default',
  glow = false,
}: MetricCardProps) {
  const styles = variantStyles[variant];
  const isLarge = size === 'large';

  return (
    <div
      className={`
        relative overflow-hidden
        glass-panel rounded-xl p-6
        border border-glass-border
        transition-all duration-300 ease-out
        hover:border-glass-border-strong hover:translate-y-[-2px]
        ${glow ? styles.glow : ''}
      `}
    >
      {/* Background gradient effect */}
      <div
        className={`
          absolute inset-0 opacity-5
          bg-gradient-to-br from-transparent via-transparent to-current
          ${styles.value}
        `}
      />

      {/* Content */}
      <div className="relative z-10">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-muted uppercase tracking-wider">
            {title}
          </p>
          {icon && (
            <div className={`${styles.icon}`}>
              {icon}
            </div>
          )}
        </div>

        {/* Value */}
        <p
          className={`
            font-bold ${styles.value}
            ${isLarge ? 'text-5xl' : 'text-4xl'}
            tracking-tight
          `}
        >
          {value}
        </p>

        {/* Subtitle and trend row */}
        <div className="flex items-center justify-between mt-2">
          {subtitle && (
            <p className="text-xs text-muted">{subtitle}</p>
          )}

          {trend && (
            <div className="flex items-center gap-1">
              <span
                className={`
                  text-sm font-semibold
                  ${trend.value >= 0 ? styles.trendUp : styles.trendDown}
                `}
              >
                {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              {trend.label && (
                <span className="text-xs text-muted ml-1">{trend.label}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Specialized metric card for alerts/warnings
interface AlertMetricCardProps {
  title: string;
  count: number;
  description: string;
  severity: 'warning' | 'error' | 'info';
  onClick?: () => void;
}

export function AlertMetricCard({
  title,
  count,
  description,
  severity,
  onClick,
}: AlertMetricCardProps) {
  const severityStyles = {
    warning: {
      bg: 'bg-warning/10',
      border: 'border-warning/30',
      text: 'text-warning',
      glow: 'shadow-[0_0_20px_rgba(251,191,36,0.2)]',
    },
    error: {
      bg: 'bg-error/10',
      border: 'border-error/30',
      text: 'text-error',
      glow: 'shadow-[0_0_20px_rgba(248,113,113,0.2)]',
    },
    info: {
      bg: 'bg-primary/10',
      border: 'border-primary/30',
      text: 'text-primary',
      glow: 'shadow-[0_0_20px_rgba(139,92,246,0.2)]',
    },
  };

  const style = severityStyles[severity];

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left
        ${style.bg} ${style.border}
        rounded-xl p-4 border
        ${style.glow}
        transition-all duration-200
        hover:scale-[1.02] hover:${style.border.replace('/30', '/50')}
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
      `}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-bold uppercase tracking-wider ${style.text}`}>
          {title}
        </span>
        <span className={`text-2xl font-black ${style.text}`}>
          {count}
        </span>
      </div>
      <p className="text-xs text-muted">{description}</p>
    </button>
  );
}
