import { Skeleton } from '@/shared/components/Skeleton';
import { cn, formatSecondsToString } from '@/shared/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '@/shared/context/ThemeContext';

interface WeekdayTime {
  weekday: number;
  total_seconds: number;
  active_days: number;
  average_seconds: number;
}

interface WeekdayTimeData {
  total_seconds: number;
  entries: WeekdayTime[];
}

type MetricMode = 'total' | 'avg';

interface WeekdayBar {
  label: string;
  totalSeconds: number;
  activeDays: number;
  averageSeconds: number;
  activeValue: number;
  isPeak: boolean;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface WeekdayTooltipProps {
  active?: boolean;
  payload?: { payload: WeekdayBar }[];
  metricMode: MetricMode;
}

function WeekdayTooltip({ active, payload, metricMode }: Readonly<WeekdayTooltipProps>) {
  if (!active || !payload || payload.length === 0) return null;

  const bar = payload[0].payload;

  return (
    <div className="surface-elevated rounded-xl px-3 py-2 text-xs whitespace-nowrap shadow-xl">
      <p className="font-semibold text-fg">{bar.label}</p>
      <div className="mt-1 space-y-0.5 font-mono tabular-nums">
        <p className={metricMode === 'total' ? 'font-semibold text-amber-400' : 'text-fg-secondary'}>
          {formatSecondsToString(bar.totalSeconds)} total
        </p>
        {bar.activeDays > 0 ? (
          <p className={metricMode === 'avg' ? 'font-semibold text-amber-400' : 'text-fg-secondary'}>
            {formatSecondsToString(bar.averageSeconds)} avg · {bar.activeDays} active day
            {bar.activeDays === 1 ? '' : 's'}
          </p>
        ) : (
          <p className="text-fg-muted">No focus time</p>
        )}
      </div>
    </div>
  );
}

export default function AnalyticWeekdayBars() {
  const { theme } = useTheme();
  const [metricMode, setMetricMode] = useState<MetricMode>('total');

  const { data: weekdayData, isLoading } = useQuery({
    queryKey: ['analytics', 'weekdayTime'],
    queryFn: () => invoke<WeekdayTimeData>('get_analytics_weekday_time'),
  });

  const { bars, subtitle } = useMemo(() => {
    const entries = weekdayData?.entries ?? [];
    const byWeekday = new Map<number, WeekdayTime>(
      entries.map((entry) => [entry.weekday, entry]),
    );

    const rawBars = WEEKDAY_LABELS.map((label, weekday) => {
      const entry = byWeekday.get(weekday);
      const totalSeconds = entry?.total_seconds ?? 0;
      const averageSeconds = entry?.average_seconds ?? 0;
      const activeValue = metricMode === 'total' ? totalSeconds : averageSeconds;

      return {
        label,
        totalSeconds,
        activeDays: entry?.active_days ?? 0,
        averageSeconds,
        activeValue,
      };
    });

    const peakValue = rawBars.reduce((max, bar) => Math.max(max, bar.activeValue), 0);

    const nextBars: WeekdayBar[] = rawBars.map((bar) => ({
      ...bar,
      isPeak: peakValue > 0 && bar.activeValue === peakValue,
    }));

    const peakLabels = nextBars.filter((bar) => bar.isPeak).map((bar) => bar.label);
    let nextSubtitle = 'No focus time yet';
    if (peakLabels.length === 1) {
      nextSubtitle =
        metricMode === 'total'
          ? `Strongest on ${peakLabels[0]}`
          : `Highest avg on ${peakLabels[0]}`;
    } else if (peakLabels.length === 2) {
      nextSubtitle =
        metricMode === 'total'
          ? `Strongest on ${peakLabels[0]} & ${peakLabels[1]}`
          : `Highest avg on ${peakLabels[0]} & ${peakLabels[1]}`;
    } else if (peakLabels.length > 2) {
      nextSubtitle =
        metricMode === 'total'
          ? `Tied peak across ${peakLabels.length} days`
          : `Tied highest avg across ${peakLabels.length} days`;
    }

    return {
      bars: nextBars,
      subtitle: nextSubtitle,
    };
  }, [weekdayData, metricMode]);

  if (isLoading) {
    return (
      <div className="surface-card flex h-full flex-col rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-7 w-28 rounded-lg" />
        </div>
        <Skeleton className="mt-5 h-56 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="surface-card flex h-full flex-col rounded-2xl p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-fg">
            Focus by Weekday
          </h3>
          <p className="mt-1 text-xs text-fg-muted">{subtitle}</p>
        </div>

        <div
          role="group"
          aria-label="Weekday metric mode"
          className="surface-well inline-flex shrink-0 rounded-lg p-0.5"
        >
          {(['total', 'avg'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setMetricMode(mode)}
              className={cn(
                'cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                metricMode === mode
                  ? 'bg-elevated text-fg shadow-xs'
                  : 'text-fg-muted hover:text-fg-secondary',
              )}
            >
              {mode === 'total' ? 'Total' : 'Avg'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={theme.charts.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: theme.charts.tick, fontSize: 11, fontFamily: 'var(--font-mono)' }}
              axisLine={{ stroke: theme.charts.axis }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(seconds: number) => formatSecondsToString(seconds)}
              tick={{ fill: theme.charts.tick, fontSize: 11, fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <Tooltip
              cursor={{ fill: theme.charts.grid }}
              content={<WeekdayTooltip metricMode={metricMode} />}
            />
            <Bar dataKey="activeValue" radius={[5, 5, 0, 0]} maxBarSize={36} isAnimationActive={false}>
              {bars.map((bar) => (
                <Cell
                  key={bar.label}
                  fill={
                    bar.isPeak
                      ? theme.charts.peak
                      : bar.activeValue > 0
                        ? theme.charts.bar
                        : theme.charts.zero
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
