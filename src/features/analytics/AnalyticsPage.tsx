import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import {
  BarChart3,
  Clock,
  Flame,
  History,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { Project } from '@shared/lib/models/project';
import { Skeleton } from '@shared/components/Skeleton.tsx';
import { cn, formatSecondsToString } from '@shared/lib/utils';
import FirstProjectTutorial from '@features/projects/components/FirstProjectTutorial.tsx';
import AnalyticScopeSelector from '@features/analytics/components/AnalyticScopeSelector.tsx';
import AnalyticStreak from '@features/analytics/components/AnalyticStreak.tsx';
import AnalyticProjectPie from '@features/analytics/components/AnalyticProjectPie.tsx';
import AnalyticWeekdayBars from '@features/analytics/components/AnalyticWeekdayBars.tsx';
import AnalyticHourlyBars from '@features/analytics/components/AnalyticHourlyBars.tsx';
import { AnalyticCalendar } from '@features/analytics/components/AnalyticCalendar.tsx';
import { SessionHistoryModal } from '@features/sessions/components/SessionHistoryModal.tsx';

type AnalyticsTab = 'overview' | 'sessions';

interface ProjectTimeShareData {
  total_seconds: number;
  entries: Array<{
    project_id: string;
    name: string;
    color: string;
    total_seconds: number;
  }>;
}

interface StreakData {
  current_streak: number;
  active_today: boolean;
}

interface CalendarData {
  history: Record<string, number>;
}

interface WeekdayTimeData {
  total_seconds: number;
  entries: Array<{
    weekday: number;
    total_seconds: number;
    active_days: number;
    average_seconds: number;
  }>;
}

interface HourlyTimeData {
  total_seconds: number;
  entries: Array<{
    hour: number;
    total_seconds: number;
    active_days: number;
    average_seconds: number;
  }>;
}

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function padHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

function AnalyticsExecutiveStrip() {
  // Reuse the exact React Query keys used by child analytics widgets — zero extra backend calls
  const { data: shareData, isLoading: shareLoading } = useQuery({
    queryKey: ['analytics', 'projectTimeShare'],
    queryFn: () => invoke<ProjectTimeShareData>('get_analytics_project_time_share'),
  });

  const { data: streakData, isLoading: streakLoading } = useQuery({
    queryKey: ['analytics', 'streak'],
    queryFn: () => invoke<StreakData>('get_analytics_streak'),
  });

  const { data: calendarData, isLoading: calendarLoading } = useQuery({
    queryKey: ['analytics', 'calendar'],
    queryFn: () => invoke<CalendarData>('get_analytics_calendar'),
  });

  const { data: weekdayData, isLoading: weekdayLoading } = useQuery({
    queryKey: ['analytics', 'weekdayTime'],
    queryFn: () => invoke<WeekdayTimeData>('get_analytics_weekday_time'),
  });

  const { data: hourlyData, isLoading: hourlyLoading } = useQuery({
    queryKey: ['analytics', 'hourlyTime'],
    queryFn: () => invoke<HourlyTimeData>('get_analytics_hourly_time'),
  });

  const metrics = useMemo(() => {
    const totalSeconds = shareData?.total_seconds ?? 0;
    const activeProjectCount = (shareData?.entries ?? []).filter((e) => e.total_seconds > 0).length;

    const currentStreak = streakData?.current_streak ?? 0;
    const activeToday = streakData?.active_today ?? false;

    const historyValues = Object.values(calendarData?.history ?? {}).filter((s) => s > 0);
    const activeDayCount = historyValues.length;
    const dailyAvgSeconds =
      activeDayCount > 0
        ? Math.round(historyValues.reduce((sum, sec) => sum + sec, 0) / activeDayCount)
        : 0;

    const peakWeekday = (weekdayData?.entries ?? []).reduce<{
      weekday: number;
      total_seconds: number;
    } | null>((best, entry) => {
      if (entry.total_seconds <= 0) return best;
      if (!best || entry.total_seconds > best.total_seconds) {
        return { weekday: entry.weekday, total_seconds: entry.total_seconds };
      }
      return best;
    }, null);

    const peakHour = (hourlyData?.entries ?? []).reduce<{
      hour: number;
      total_seconds: number;
    } | null>((best, entry) => {
      if (entry.total_seconds <= 0) return best;
      if (!best || entry.total_seconds > best.total_seconds) {
        return { hour: entry.hour, total_seconds: entry.total_seconds };
      }
      return best;
    }, null);

    let peakRhythm = '—';
    if (peakWeekday && peakHour) {
      peakRhythm = `${WEEKDAY_SHORT[peakWeekday.weekday] ?? 'Day'} · ${padHour(peakHour.hour)}`;
    } else if (peakWeekday) {
      peakRhythm = WEEKDAY_SHORT[peakWeekday.weekday] ?? '—';
    } else if (peakHour) {
      peakRhythm = padHour(peakHour.hour);
    }

    return {
      totalSeconds,
      activeProjectCount,
      currentStreak,
      activeToday,
      activeDayCount,
      dailyAvgSeconds,
      peakRhythm,
    };
  }, [shareData, streakData, calendarData, weekdayData, hourlyData]);

  const peakLoading = weekdayLoading || hourlyLoading;

  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      {/* 1. Total Tracked */}
      <div className="surface-card flex flex-col justify-between rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold tracking-[0.07em] text-fg-muted uppercase">
            Total Tracked
          </span>
          <span className="flex h-6.5 w-6.5 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400">
            <Clock className="h-3.5 w-3.5" />
          </span>
        </div>
        {shareLoading ? (
          <Skeleton className="mt-3 h-7 w-24" />
        ) : (
          <p className="mt-2.5 font-mono text-2xl font-semibold tracking-tight tabular-nums text-fg">
            {formatSecondsToString(metrics.totalSeconds)}
          </p>
        )}
        <p className="mt-1 truncate text-[11px] text-fg-muted">
          {metrics.activeProjectCount > 0
            ? `Across ${metrics.activeProjectCount} active project${metrics.activeProjectCount === 1 ? '' : 's'}`
            : 'No tracked sessions yet'}
        </p>
      </div>

      {/* 2. Current Streak */}
      <div className="surface-card flex flex-col justify-between rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold tracking-[0.07em] text-fg-muted uppercase">
            Current Streak
          </span>
          <span className="flex h-6.5 w-6.5 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400">
            <Flame className="h-3.5 w-3.5" />
          </span>
        </div>
        {streakLoading ? (
          <Skeleton className="mt-3 h-7 w-16" />
        ) : (
          <div className="mt-2.5 flex items-center gap-2">
            <p className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-fg">
              {metrics.currentStreak}d
            </p>
            <span
              title={metrics.activeToday ? 'Active today' : 'Pending today'}
              className={cn(
                'h-2 w-2 rounded-full',
                metrics.activeToday
                  ? 'bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.7)]'
                  : 'bg-amber-400/80',
              )}
            />
          </div>
        )}
        <p className="mt-1 truncate text-[11px] text-fg-muted">
          {metrics.activeToday ? 'Logged focus time today' : 'Start a session to extend'}
        </p>
      </div>

      {/* 3. Daily Average */}
      <div className="surface-card flex flex-col justify-between rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold tracking-[0.07em] text-fg-muted uppercase">
            Daily Average
          </span>
          <span className="flex h-6.5 w-6.5 items-center justify-center rounded-lg border border-teal-400/20 bg-teal-400/10 text-teal-300">
            <TrendingUp className="h-3.5 w-3.5" />
          </span>
        </div>
        {calendarLoading ? (
          <Skeleton className="mt-3 h-7 w-20" />
        ) : (
          <p className="mt-2.5 font-mono text-2xl font-semibold tracking-tight tabular-nums text-fg">
            {formatSecondsToString(metrics.dailyAvgSeconds)}
          </p>
        )}
        <p className="mt-1 truncate text-[11px] text-fg-muted">
          {metrics.activeDayCount > 0
            ? `Across ${metrics.activeDayCount} active day${metrics.activeDayCount === 1 ? '' : 's'}`
            : 'Per active focus day'}
        </p>
      </div>

      {/* 4. Peak Rhythm */}
      <div className="surface-card flex flex-col justify-between rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold tracking-[0.07em] text-fg-muted uppercase">
            Peak Rhythm
          </span>
          <span className="flex h-6.5 w-6.5 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/10 text-sky-300">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
        </div>
        {peakLoading ? (
          <Skeleton className="mt-3 h-7 w-28" />
        ) : (
          <p className="mt-2.5 truncate font-mono text-2xl font-semibold tracking-tight tabular-nums text-fg">
            {metrics.peakRhythm}
          </p>
        )}
        <p className="mt-1 truncate text-[11px] text-fg-muted">Strongest day &amp; hour window</p>
      </div>
    </div>
  );
}

function AnalyticsLoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {[0, 1, 2, 3].map((idx) => (
          <div key={idx} className="surface-card space-y-3 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6.5 w-6.5 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_1fr]">
        <div className="surface-card flex h-72 flex-col justify-between rounded-2xl p-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="flex flex-col items-center gap-3 py-4">
            <Skeleton className="h-16 w-16 rounded-2xl" />
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-6 w-36 rounded-full" />
          </div>
        </div>
        <div className="surface-card flex h-72 flex-col justify-between rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-20 rounded-lg" />
          </div>
          <div className="flex items-center gap-8">
            <Skeleton className="h-44 w-44 shrink-0 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
              <Skeleton className="h-4 w-3/6" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {[0, 1].map((idx) => (
          <div key={idx} className="surface-card h-80 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-44" />
              </div>
              <Skeleton className="h-7 w-28 rounded-lg" />
            </div>
            <Skeleton className="mt-6 h-52 w-full rounded-xl" />
          </div>
        ))}
      </div>

      <div className="surface-card h-64 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-52" />
          </div>
          <Skeleton className="h-8 w-32 rounded-xl" />
        </div>
        <Skeleton className="mt-6 h-36 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerFilterDate, setDrawerFilterDate] = useState<string | null>(null);

  const activeTab: AnalyticsTab =
    searchParams.get('tab') === 'sessions' ? 'sessions' : 'overview';

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => invoke<Project[]>('get_projects'),
  });

  const userHasProjects = projects.length > 0;

  const handleSelectTab = (tab: AnalyticsTab) => {
    if (tab === 'sessions') {
      setIsDrawerOpen(false);
      setSearchParams({ tab: 'sessions' }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const openDayDrawer = (dateKey: string) => {
    setDrawerFilterDate(dateKey);
    setIsDrawerOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-7 sm:px-8">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            Analytics
          </h1>
          <p className="mt-1.5 text-sm text-fg-secondary">
            {activeTab === 'sessions'
              ? 'Browse, filter, and refine every recorded focus and break session.'
              : 'Insights, streaks, and focus patterns across your projects.'}
          </p>
        </div>

        {!isLoading && userHasProjects && (
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Segmented Tab Switch: Overview | Session Log */}
            <div
              role="tablist"
              aria-label="Analytics views"
              className="surface-well inline-flex items-center gap-1 rounded-xl p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'overview'}
                onClick={() => handleSelectTab('overview')}
                className={cn(
                  'inline-flex h-7.5 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none',
                  activeTab === 'overview'
                    ? 'bg-elevated text-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'text-fg-muted hover:text-fg-secondary',
                )}
              >
                <BarChart3
                  className={cn(
                    'h-3.5 w-3.5',
                    activeTab === 'overview' ? 'text-amber-400' : 'text-fg-muted',
                  )}
                />
                <span>Overview</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'sessions'}
                onClick={() => handleSelectTab('sessions')}
                className={cn(
                  'inline-flex h-7.5 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none',
                  activeTab === 'sessions'
                    ? 'bg-elevated text-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'text-fg-muted hover:text-fg-secondary',
                )}
              >
                <History
                  className={cn(
                    'h-3.5 w-3.5',
                    activeTab === 'sessions' ? 'text-amber-400' : 'text-fg-muted',
                  )}
                />
                <span>Session Log</span>
              </button>
            </div>

            {activeTab === 'overview' && <AnalyticScopeSelector />}
          </div>
        )}
      </header>

      {isLoading ? (
        <AnalyticsLoadingSkeleton />
      ) : userHasProjects ? (
        activeTab === 'sessions' ? (
          <SessionHistoryModal
            mode="inline"
            isOpen={true}
            onClose={() => {}}
            projects={projects}
          />
        ) : (
          <div className="flex flex-col gap-5">
            <AnalyticsExecutiveStrip />

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_1fr]">
              <AnalyticStreak />
              <AnalyticProjectPie />
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <AnalyticWeekdayBars />
              <AnalyticHourlyBars />
            </div>

            <AnalyticCalendar onSelectDay={(dateKey) => openDayDrawer(dateKey)} />
          </div>
        )
      ) : (
        <FirstProjectTutorial />
      )}

      <SessionHistoryModal
        mode="drawer"
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        projects={projects}
        initialDate={drawerFilterDate}
      />
    </div>
  );
}
