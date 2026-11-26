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
const PEAK_COLOR = '#F59E0B';
const BAR_COLOR = '#383F4D';
const ZERO_COLOR = 'rgba(255, 255, 255, 0.04)';

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
      <p className="font-semibold text-[#F4F5F7]">{bar.label}</p>
      <div className="mt-1 space-y-0.5 font-mono tabular-nums">
        <p className={metricMode === 'total' ? 'font-semibold text-amber-400' : 'text-[#9CA3B0]'}>
          {formatSecondsToString(bar.totalSeconds)} total
        </p>
        {bar.activeDays > 0 ? (
          <p className={metricMode === 'avg' ? 'font-semibold text-amber-400' : 'text-[#9CA3B0]'}>
            {formatSecondsToString(bar.averageSeconds)} avg · {bar.activeDays} active day
            {bar.activeDays === 1 ? '' : 's'}
          </p>
        ) : (
          <p className="text-[#646C7A]">No focus time</p>
        )}
      </div>
    </div>
  );
}

export default function AnalyticWeekdayBars() {
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
          <h3 className="text-sm font-semibold tracking-tight text-[#F4F5F7]">
            Focus by Weekday
          </h3>
          <p className="mt-1 text-xs text-[#646C7A]">{subtitle}</p>
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
                  ? 'bg-[#1F2430] text-[#F4F5F7] shadow-xs'
                  : 'text-[#646C7A] hover:text-[#9CA3B0]',
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
            <CartesianGrid stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#646C7A', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.08)' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(seconds: number) => formatSecondsToString(seconds)}
              tick={{ fill: '#646C7A', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
              content={<WeekdayTooltip metricMode={metricMode} />}
            />
            <Bar dataKey="activeValue" radius={[5, 5, 0, 0]} maxBarSize={36} isAnimationActive={false}>
              {bars.map((bar) => (
                <Cell
                  key={bar.label}
                  fill={bar.isPeak ? PEAK_COLOR : bar.activeValue > 0 ? BAR_COLOR : ZERO_COLOR}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
