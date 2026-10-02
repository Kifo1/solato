import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { useMemo } from 'react';
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
import { formatSecondsToString } from '@/shared/lib/utils';

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

interface WeekdayBar {
  label: string;
  totalSeconds: number;
  activeDays: number;
  averageSeconds: number;
  isPeak: boolean;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BAR_COLOR = 'rgba(59, 130, 246, 0.4)';
const PEAK_COLOR = '#3b82f6';

interface WeekdayTooltipProps {
  active?: boolean;
  payload?: { payload: WeekdayBar }[];
}

function WeekdayTooltip({ active, payload }: WeekdayTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const bar = payload[0].payload;

  return (
    <div className="rounded-lg border border-slate-200/10 bg-slate-900 px-3 py-2 text-xs whitespace-nowrap text-white shadow-lg">
      <p className="font-semibold">{bar.label}</p>
      <p className="text-blue-200/70">{formatSecondsToString(bar.totalSeconds)} total</p>
      {bar.activeDays > 0 ? (
        <p className="text-blue-200/70">
          {formatSecondsToString(bar.averageSeconds)} avg · {bar.activeDays} active day
          {bar.activeDays === 1 ? '' : 's'}
        </p>
      ) : (
        <p className="text-blue-200/70">No focus time</p>
      )}
    </div>
  );
}

export default function AnalyticWeekdayBars() {
  const { data: weekdayData } = useQuery({
    queryKey: ['analytics', 'weekdayTime'],
    queryFn: () => invoke<WeekdayTimeData>('get_analytics_weekday_time'),
  });

  const { bars, peakLabel } = useMemo(() => {
    const entries = weekdayData?.entries ?? [];
    const peakSeconds = entries.reduce((max, entry) => Math.max(max, entry.total_seconds), 0);

    const nextBars = WEEKDAY_LABELS.map((label, weekday) => {
      const entry = entries[weekday];
      const seconds = entry?.total_seconds ?? 0;

      return {
        label,
        totalSeconds: seconds,
        activeDays: entry?.active_days ?? 0,
        averageSeconds: entry?.average_seconds ?? 0,
        isPeak: peakSeconds > 0 && seconds === peakSeconds,
      };
    });

    return {
      bars: nextBars,
      peakLabel: nextBars.find((bar) => bar.isPeak)?.label,
    };
  }, [weekdayData]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200/10 bg-slate-200/5 p-6">
      <div>
        <h3 className="text-sm font-semibold tracking-wider text-blue-200 uppercase">
          Time per Weekday
        </h3>
        <p className="mt-1 text-xs text-blue-200/70">
          {peakLabel ? `Strongest on ${peakLabel}` : 'No focus time yet'}
        </p>
      </div>

      <div className="mt-4 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#93c5fd', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(148, 163, 184, 0.25)' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(seconds: number) => formatSecondsToString(seconds)}
              tick={{ fill: '#93c5fd', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip cursor={{ fill: 'rgba(59, 130, 246, 0.12)' }} content={<WeekdayTooltip />} />
            <Bar dataKey="totalSeconds" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {bars.map((bar) => (
                <Cell key={bar.label} fill={bar.isPeak ? PEAK_COLOR : BAR_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
