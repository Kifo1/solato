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

interface HourlyBar {
  hour: string;
  range: string;
  totalSeconds: number;
  activeDays: number;
  averageSeconds: number;
  isPeak: boolean;
}

const HOUR_COUNT = 24;
const BAR_COLOR = 'rgba(59, 130, 246, 0.4)';
const PEAK_COLOR = '#3b82f6';

interface HourlyTooltipProps {
  active?: boolean;
  payload?: { payload: HourlyBar }[];
}

function HourlyTooltip({ active, payload }: HourlyTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const bar = payload[0].payload;

  return (
    <div className="rounded-lg border border-slate-200/10 bg-slate-900 px-3 py-2 text-xs whitespace-nowrap text-white shadow-lg">
      <p className="font-semibold">{bar.range}</p>
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

export default function AnalyticHourlyBars() {
  const { data: hourlyData } = useQuery({
    queryKey: ['analytics', 'hourlyTime'],
    queryFn: () => invoke<HourlyTimeData>('get_analytics_hourly_time'),
  });

  const { bars, peakHour } = useMemo(() => {
    const entries = hourlyData?.entries ?? [];
    const peakSeconds = entries.reduce((max, entry) => Math.max(max, entry.total_seconds), 0);

    const nextBars = Array.from({ length: HOUR_COUNT }, (_, hour) => {
      const entry = entries[hour];
      const seconds = entry?.total_seconds ?? 0;
      const nextHour = (hour + 1) % HOUR_COUNT;

      return {
        hour: `${hour}`,
        range: `${hour}:00 – ${nextHour}:00`,
        totalSeconds: seconds,
        activeDays: entry?.active_days ?? 0,
        averageSeconds: entry?.average_seconds ?? 0,
        isPeak: peakSeconds > 0 && seconds === peakSeconds,
      };
    });

    return {
      bars: nextBars,
      peakHour: nextBars.find((bar) => bar.isPeak)?.hour,
    };
  }, [hourlyData]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200/10 bg-slate-200/5 p-6">
      <div>
        <h3 className="text-sm font-semibold tracking-wider text-blue-200 uppercase">
          Time per Hour
        </h3>
        <p className="mt-1 text-xs text-blue-200/70">
          {peakHour !== undefined ? `Favorite hour ${peakHour}:00` : 'No focus time yet'}
        </p>
      </div>

      <div className="mt-4 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
            <XAxis
              dataKey="hour"
              interval={2}
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
            <Tooltip cursor={{ fill: 'rgba(59, 130, 246, 0.12)' }} content={<HourlyTooltip />} />
            <Bar dataKey="totalSeconds" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {bars.map((bar) => (
                <Cell key={bar.hour} fill={bar.isPeak ? PEAK_COLOR : BAR_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
