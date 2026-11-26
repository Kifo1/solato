import { Skeleton } from '@/shared/components/Skeleton';
import { useToast } from '@/shared/context/ToastContext';
import type { Project } from '@/shared/lib/models/project';
import { cn, formatSecondsToString, getErrorMessage } from '@/shared/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { Filter } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useAnalytics } from '../hooks/useAnalytics';

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

const EMPTY_RING_COLOR = '#1E232D';

interface PieTooltipProps {
  active?: boolean;
  payload?: { payload: PieSlice }[];
}

function PieTooltip({ active, payload }: Readonly<PieTooltipProps>) {
  if (!active || !payload || payload.length === 0) return null;

  const slice = payload[0].payload;

  return (
    <div className="surface-elevated rounded-xl px-3 py-2 text-xs whitespace-nowrap shadow-xl">
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: slice.color }}
        />
        <p className="font-semibold text-[#F4F5F7]">{slice.name}</p>
      </div>
      <p className="mt-1 font-mono tabular-nums text-[#9CA3B0]">
        <span className="font-semibold text-amber-400">{slice.percentage.toFixed(1)}%</span> ·{' '}
        {formatSecondsToString(slice.seconds)}
      </p>
    </div>
  );
}

export default function AnalyticProjectPie() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { selectedProjects } = useAnalytics();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => invoke<Project[]>('get_projects'),
  });

  const { data: shareData, isLoading } = useQuery({
    queryKey: ['analytics', 'projectTimeShare'],
    queryFn: () => invoke<ProjectTimeShareData>('get_analytics_project_time_share'),
  });

  const updateSelectionMutation = useMutation({
    mutationFn: (nextProjects: Project[]) =>
      invoke('update_selected_projects', {
        projectIds: nextProjects.map((p) => p.id),
      }),
    onMutate: async (nextProjects) => {
      await queryClient.cancelQueries({ queryKey: ['localSelectedProjects'] });
      const previous = queryClient.getQueryData<Project[]>(['localSelectedProjects']);
      queryClient.setQueryData<Project[]>(['localSelectedProjects'], nextProjects);
      return { previous };
    },
    onError: (err, _nextProjects, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<Project[]>(['localSelectedProjects'], context.previous);
      }
      toast.error('Could not update project filter', getErrorMessage(err));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });

  const { slices, totalSeconds, hasData } = useMemo(() => {
    const entries = shareData?.entries ?? [];
    const total = shareData?.total_seconds ?? 0;

    const nonEmptyEntries = entries.filter((entry) => entry.total_seconds > 0);
    if (nonEmptyEntries.length === 0 || total <= 0) {
      return { slices: [], totalSeconds: 0, hasData: false };
    }

    const sorted = [...nonEmptyEntries].sort((a, b) => b.total_seconds - a.total_seconds);

    return {
      totalSeconds: total,
      hasData: true,
      slices: sorted.map((entry) => ({
        key: entry.project_id,
        name: entry.name,
        color: entry.color,
        seconds: entry.total_seconds,
        percentage: (entry.total_seconds / total) * 100,
      })),
    };
  }, [shareData]);

  const canSoloFilter = allProjects.length > 1;
  const soloedProjectId =
    selectedProjects.length === 1 && canSoloFilter ? selectedProjects[0].id : null;

  const handleToggleProjectSolo = (slice: PieSlice) => {
    if (!canSoloFilter || updateSelectionMutation.isPending) return;

    if (soloedProjectId === slice.key) {
      updateSelectionMutation.mutate(allProjects);
      toast.info('Showing all projects', 'Cleared single-project analytics filter.');
      return;
    }

    const target =
      allProjects.find((p) => p.id === slice.key) ??
      selectedProjects.find((p) => p.id === slice.key);
    if (!target) return;

    updateSelectionMutation.mutate([target]);
    toast.info(`Filtered to ${slice.name}`, 'Click again to restore all projects.');
  };

  if (isLoading) {
    return (
      <div className="surface-card flex h-full flex-col justify-between rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-44" />
          </div>
          <Skeleton className="h-6 w-20 rounded-lg" />
        </div>
        <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row">
          <Skeleton className="h-44 w-44 shrink-0 rounded-full" />
          <div className="w-full flex-1 space-y-3">
            <Skeleton className="h-7 w-full rounded-lg" />
            <Skeleton className="h-7 w-full rounded-lg" />
            <Skeleton className="h-7 w-4/5 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  const noProjectsSelected = selectedProjects.length === 0;
  const emptyTitle = noProjectsSelected ? 'No projects selected' : 'No focus time recorded yet';
  const emptySubtitle = noProjectsSelected
    ? 'Choose one or more projects from the scope selector above.'
    : 'Start a focus session to see how your time is distributed.';

  const chartData: PieSlice[] = hasData
    ? slices
    : [
        {
          key: 'empty',
          name: emptyTitle,
          color: EMPTY_RING_COLOR,
          seconds: 1,
          percentage: 0,
        },
      ];

  const activeSlice = hoveredKey ? slices.find((s) => s.key === hoveredKey) : undefined;

  return (
    <div className="surface-card flex h-full flex-col rounded-2xl p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-[#F4F5F7]">
              Project Distribution
            </h3>
            {soloedProjectId && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/12 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                <Filter className="h-2.5 w-2.5" />
                Solo
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[#646C7A]">
            {hasData
              ? canSoloFilter
                ? `Across ${slices.length} project${slices.length === 1 ? '' : 's'} · Click a row to filter`
                : `Across ${slices.length} active project${slices.length === 1 ? '' : 's'}`
              : emptyTitle}
          </p>
        </div>

        <span className="shrink-0 rounded-lg border border-white/[0.08] bg-[#0F1116] px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-[#F4F5F7]">
          {formatSecondsToString(totalSeconds)}
        </span>
      </div>

      <div className="mt-5 flex flex-1 flex-col items-center gap-6 sm:flex-row">
        {/* Donut chart with centered readout */}
        <div className="relative h-48 w-48 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="seconds"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="64%"
                outerRadius="90%"
                paddingAngle={hasData && slices.length > 1 ? 2 : 0}
                cornerRadius={hasData ? 4 : 0}
                stroke="none"
                isAnimationActive={false}
                onMouseEnter={(_, index) => {
                  if (hasData && chartData[index]) {
                    setHoveredKey(chartData[index].key);
                  }
                }}
                onMouseLeave={() => setHoveredKey(null)}
                onClick={(_, index) => {
                  if (hasData && chartData[index]) {
                    handleToggleProjectSolo(chartData[index]);
                  }
                }}
              >
                {chartData.map((slice) => {
                  const isDimmed = hasData && hoveredKey !== null && hoveredKey !== slice.key;
                  return (
                    <Cell
                      key={slice.key}
                      fill={slice.color}
                      fillOpacity={isDimmed ? 0.35 : 1}
                      style={{
                        transition: 'fill-opacity 150ms ease',
                        cursor: hasData && canSoloFilter ? 'pointer' : 'default',
                      }}
                    />
                  );
                })}
              </Pie>
              {hasData && <Tooltip cursor={false} content={<PieTooltip />} />}
            </PieChart>
          </ResponsiveContainer>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
            {hasData ? (
              <>
                <span className="font-mono text-lg font-semibold tracking-tight tabular-nums text-[#F4F5F7]">
                  {activeSlice
                    ? formatSecondsToString(activeSlice.seconds)
                    : formatSecondsToString(totalSeconds)}
                </span>
                <span className="mt-0.5 max-w-full truncate text-[11px] text-[#9CA3B0]">
                  {activeSlice ? activeSlice.name : 'Total focus'}
                </span>
                {activeSlice && (
                  <span className="mt-0.5 font-mono text-[10px] font-medium tabular-nums text-amber-400">
                    {activeSlice.percentage.toFixed(1)}%
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="font-mono text-lg font-semibold tabular-nums text-[#646C7A]">
                  0m
                </span>
                <span className="mt-0.5 text-[11px] text-[#646C7A]">No data</span>
              </>
            )}
          </div>
        </div>

        {/* Interactive Legend / Empty state copy */}
        {hasData ? (
          <div className="max-h-48 w-full flex-1 space-y-1 overflow-y-auto pr-1">
            {slices.map((slice) => {
              const isHighlighted = hoveredKey === slice.key;
              const isSoloed = soloedProjectId === slice.key;
              return (
                <button
                  key={slice.key}
                  type="button"
                  disabled={!canSoloFilter}
                  title={
                    canSoloFilter
                      ? isSoloed
                        ? `Click to show all projects`
                        : `Click to filter analytics to ${slice.name}`
                      : undefined
                  }
                  onMouseEnter={() => setHoveredKey(slice.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onFocus={() => setHoveredKey(slice.key)}
                  onBlur={() => setHoveredKey(null)}
                  onClick={() => handleToggleProjectSolo(slice)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-all duration-150 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none',
                    canSoloFilter ? 'cursor-pointer' : 'cursor-default',
                    isSoloed
                      ? 'border-amber-500/30 bg-amber-500/[0.08]'
                      : isHighlighted
                        ? 'border-white/[0.08] bg-white/[0.06]'
                        : 'border-transparent hover:bg-white/[0.04]',
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-[#F4F5F7]">
                    {slice.name}
                  </span>
                  {isSoloed && (
                    <span className="shrink-0 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                      All
                    </span>
                  )}
                  <span className="shrink-0 font-mono text-xs tabular-nums text-[#646C7A]">
                    {slice.percentage.toFixed(0)}%
                  </span>
                  <span className="w-14 shrink-0 text-right font-mono text-xs font-medium tabular-nums text-[#D0D5DE]">
                    {formatSecondsToString(slice.seconds)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-start justify-center rounded-xl border border-white/[0.05] bg-[#0F1116]/70 p-4 text-left">
            <p className="text-sm font-medium text-[#D0D5DE]">{emptyTitle}</p>
            <p className="mt-1 text-xs leading-relaxed text-[#646C7A]">{emptySubtitle}</p>
          </div>
        )}
      </div>
    </div>
  );
}
