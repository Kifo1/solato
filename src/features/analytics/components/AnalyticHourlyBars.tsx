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

interface HourlyTime {
  hour: number;
  total_seconds: number;
  active_days: number;
  average_seconds: number;
}

interface HourlyTimeData {
  total_seconds: number;
  entries: HourlyTime[];
}

type MetricMode = 'total' | 'avg';

interface HourlyBar {
  hourKey: string;
  label: string;
  range: string;
  totalSeconds: number;
  activeDays: number;
  averageSeconds: number;
  activeValue: number;
  isPeak: boolean;
}

const HOUR_COUNT = 24;
const PEAK_COLOR = '#F59E0B';
const BAR_COLOR = '#383F4D';
const ZERO_COLOR = 'rgba(255, 255, 255, 0.04)';

function padHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

interface HourlyTooltipProps {
  active?: boolean;
  payload?: { payload: HourlyBar }[];
  metricMode: MetricMode;
}

function HourlyTooltip({ active, payload, metricMode }: Readonly<HourlyTooltipProps>) {
  if (!active || !payload || payload.length === 0) return null;

  const bar = payload[0].payload;

  return (
    <div className="surface-elevated rounded-xl px-3 py-2 text-xs whitespace-nowrap shadow-xl">
      <p className="font-mono font-semibold tabular-nums text-[#F4F5F7]">{bar.range}</p>
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

export default function AnalyticHourlyBars() {
  const [metricMode, setMetricMode] = useState<MetricMode>('total');

  const { data: hourlyData, isLoading } = useQuery({
    queryKey: ['analytics', 'hourlyTime'],
    queryFn: () => invoke<HourlyTimeData>('get_analytics_hourly_time'),
  });

  const { bars, subtitle } = useMemo(() => {
    const entries = hourlyData?.entries ?? [];
    const byHour = new Map<number, HourlyTime>(entries.map((entry) => [entry.hour, entry]));

    const rawBars = Array.from({ length: HOUR_COUNT }, (_, hour) => {
      const entry = byHour.get(hour);
      const totalSeconds = entry?.total_seconds ?? 0;
      const averageSeconds = entry?.average_seconds ?? 0;
      const activeValue = metricMode === 'total' ? totalSeconds : averageSeconds;
      const nextHour = (hour + 1) % HOUR_COUNT;

      return {
        hourKey: String(hour),
        label: padHour(hour),
        range: `${padHour(hour)} – ${padHour(nextHour)}`,
        totalSeconds,
        activeDays: entry?.active_days ?? 0,
        averageSeconds,
        activeValue,
      };
    });

    const peakValue = rawBars.reduce((max, bar) => Math.max(max, bar.activeValue), 0);

    const nextBars: HourlyBar[] = rawBars.map((bar) => ({
      ...bar,
      isPeak: peakValue > 0 && bar.activeValue === peakValue,
    }));

    const peakLabels = nextBars.filter((bar) => bar.isPeak).map((bar) => bar.label);
    let nextSubtitle = 'No focus time yet';
    if (peakLabels.length === 1) {
      nextSubtitle =
        metricMode === 'total'
          ? `Peak hour ${peakLabels[0]}`
          : `Highest avg at ${peakLabels[0]}`;
    } else if (peakLabels.length === 2) {
      nextSubtitle =
        metricMode === 'total'
          ? `Peak hours ${peakLabels[0]} & ${peakLabels[1]}`
          : `Highest avg at ${peakLabels[0]} & ${peakLabels[1]}`;
    } else if (peakLabels.length > 2) {
      nextSubtitle =
        metricMode === 'total'
          ? `Tied peak across ${peakLabels.length} hours`
          : `Tied highest avg across ${peakLabels.length} hours`;
    }

    return {
      bars: nextBars,
      subtitle: nextSubtitle,
    };
  }, [hourlyData, metricMode]);

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
          <h3 className="text-sm font-semibold tracking-tight text-[#F4F5F7]">Focus by Hour</h3>
          <p className="mt-1 text-xs text-[#646C7A]">{subtitle}</p>
        </div>

        <div
          role="group"
          aria-label="Hourly metric mode"
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
              interval={2}
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
              content={<HourlyTooltip metricMode={metricMode} />}
            />
            <Bar dataKey="activeValue" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {bars.map((bar) => (
                <Cell
                  key={bar.hourKey}
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
