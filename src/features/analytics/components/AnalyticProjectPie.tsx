import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatSecondsToString } from '@/shared/lib/utils';

interface ProjectTimeShare {
  project_id: string;
  name: string;
  color: string;
  total_seconds: number;
}

interface ProjectTimeShareData {
  total_seconds: number;
  entries: ProjectTimeShare[];
}

interface PieSlice {
  key: string;
  name: string;
  color: string;
  seconds: number;
  percentage: number;
}

const EMPTY_COLOR = '#475569';

interface PieTooltipProps {
  active?: boolean;
  payload?: { payload: PieSlice }[];
}

function PieTooltip({ active, payload }: PieTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const slice = payload[0].payload;

  return (
    <div className="rounded-lg border border-slate-200/10 bg-slate-900 px-3 py-2 text-xs whitespace-nowrap text-white shadow-lg">
      <p className="font-semibold">{slice.name}</p>
      <p className="text-blue-200/70">
        {slice.percentage.toFixed(1)}% · {formatSecondsToString(slice.seconds)}
      </p>
    </div>
  );
}

export default function AnalyticProjectPie() {
  const { data: shareData } = useQuery({
    queryKey: ['analytics', 'projectTimeShare'],
    queryFn: () => invoke<ProjectTimeShareData>('get_analytics_project_time_share'),
  });

  const { slices, hasData } = useMemo(() => {
    const entries = shareData?.entries ?? [];
    const totalSeconds = shareData?.total_seconds ?? 0;

    if (entries.length === 0) {
      return { slices: [], hasData: false };
    }

    return {
      hasData: true,
      slices: entries.map((entry) => ({
        key: entry.project_id,
        name: entry.name,
        color: entry.color,
        seconds: entry.total_seconds,
        percentage: totalSeconds > 0 ? (entry.total_seconds / totalSeconds) * 100 : 0,
      })),
    };
  }, [shareData]);

  const chartData: PieSlice[] = hasData
    ? slices
    : [
        {
          key: 'empty',
          name: 'No projects selected',
          color: EMPTY_COLOR,
          seconds: 1,
          percentage: 0,
        },
      ];

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200/10 bg-slate-200/5 p-6">
      <div>
        <h3 className="text-sm font-semibold tracking-wider text-blue-200 uppercase">
          Time per Project
        </h3>
        <p className="mt-1 text-xs text-blue-200/70">
          {hasData
            ? `${slices.length} project${slices.length === 1 ? '' : 's'} · ${formatSecondsToString(shareData?.total_seconds ?? 0)} total`
            : 'No projects selected'}
        </p>
      </div>

      <div className="mt-4 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="seconds"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="85%"
              paddingAngle={hasData ? 1 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {chartData.map((slice) => (
                <Cell key={slice.key} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip cursor={false} content={<PieTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
