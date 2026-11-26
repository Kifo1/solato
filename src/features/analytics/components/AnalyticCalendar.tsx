import Button from '@/shared/components/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { cn, formatSecondsToString } from '@/shared/lib/utils';
import {
  eachDayOfInterval,
  endOfWeek,
  endOfYear,
  format,
  getYear,
  isAfter,
  isSameYear,
  startOfToday,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarData {
  history: Record<string, number>;
}

interface DayCell {
  date: Date;
  key: string;
  seconds: number;
  inYear: boolean;
  isToday: boolean;
  isFuture: boolean;
}

interface MonthLabel {
  weekIndex: number;
  label: string;
}

interface TooltipState {
  x: number;
  y: number;
  placement: 'above' | 'below';
  date: Date;
  seconds: number;
  isFuture: boolean;
}

const WEEK_STARTS_ON = 1;
const WEEKDAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];
const CELL_SIZE_PX = 14;
const CELL_GAP_PX = 4;
const WEEK_COL_STEP_PX = CELL_SIZE_PX + CELL_GAP_PX;
const TOOLTIP_HALF_WIDTH = 104;

const LEVEL_COLORS = [
  'bg-[#1A1E26] border border-white/[0.05]',
  'bg-[#4A3210] border border-[#614114]',
  'bg-[#7C4D0E] border border-[#965D11]',
  'bg-[#B86D0B] border border-[#D47E0D]',
  'bg-[#F59E0B] border border-[#FBBF24]',
];

function getLevel(seconds: number, max: number): number {
  if (!seconds || seconds <= 0 || max <= 0) return 0;
  const ratio = seconds / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

interface AnalyticCalendarProps {
  onSelectDay?: (dateKey: string) => void;
}

export function AnalyticCalendar({ onSelectDay }: Readonly<AnalyticCalendarProps> = {}) {
  const today = useMemo(() => startOfToday(), []);
  const todayKey = useMemo(() => format(today, 'yyyy-MM-dd'), [today]);

  const [year, setYear] = useState(() => getYear(today));
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const { data: calendarData, isLoading } = useQuery({
    queryKey: ['analytics', 'calendar'],
    queryFn: () => invoke<CalendarData>('get_analytics_calendar'),
  });

  const isCurrentYear = isSameYear(new Date(year, 0, 1), today);

  const { weeks, monthLabels, maxSeconds, activeDays, totalSeconds } = useMemo(() => {
    const history = calendarData?.history ?? {};

    const yearStart = startOfYear(new Date(year, 0, 1));
    const yearEnd = endOfYear(yearStart);
    const gridStart = startOfWeek(yearStart, { weekStartsOn: WEEK_STARTS_ON });
    const gridEnd = endOfWeek(yearEnd, { weekStartsOn: WEEK_STARTS_ON });

    const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

    let max = 0;
    let active = 0;
    let total = 0;

    const days: DayCell[] = allDays.map((date) => {
      const key = format(date, 'yyyy-MM-dd');
      const seconds = history[key] ?? 0;
      const inYear = isSameYear(date, yearStart);
      const isFuture = isAfter(date, today);

      if (inYear && !isFuture) {
        if (seconds > max) max = seconds;
        if (seconds > 0) active += 1;
        total += seconds;
      }

      return {
        date,
        key,
        seconds,
        inYear,
        isToday: key === todayKey,
        isFuture,
      };
    });

    const groupedWeeks: DayCell[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      groupedWeeks.push(days.slice(i, i + 7));
    }

    const labels: MonthLabel[] = [];
    let lastMonth = -1;
    let lastLabelWeek = -10;
    groupedWeeks.forEach((week, weekIndex) => {
      const firstInYearDay = week.find((d) => d.inYear);
      if (!firstInYearDay) return;
      const month = firstInYearDay.date.getMonth();
      if (month !== lastMonth) {
        if (weekIndex - lastLabelWeek >= 2) {
          labels.push({
            weekIndex,
            label: format(firstInYearDay.date, 'MMM'),
          });
          lastLabelWeek = weekIndex;
        }
        lastMonth = month;
      }
    });

    return {
      weeks: groupedWeeks,
      monthLabels: labels,
      maxSeconds: max,
      activeDays: active,
      totalSeconds: total,
    };
  }, [calendarData, year, today, todayKey]);

  const showTooltip = (target: HTMLElement, day: DayCell) => {
    if (!day.inYear) return;
    const cellRect = target.getBoundingClientRect();
    const rawCenterX = cellRect.left + cellRect.width / 2;
    const clampedX = Math.min(
      Math.max(TOOLTIP_HALF_WIDTH + 12, rawCenterX),
      Math.max(TOOLTIP_HALF_WIDTH + 12, window.innerWidth - TOOLTIP_HALF_WIDTH - 12),
    );
    const showBelow = cellRect.top < 84;

    setTooltip({
      x: clampedX,
      y: showBelow ? cellRect.bottom + 8 : cellRect.top - 8,
      placement: showBelow ? 'below' : 'above',
      date: day.date,
      seconds: day.seconds,
      isFuture: day.isFuture,
    });
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>, day: DayCell) => {
    showTooltip(e.currentTarget, day);
  };

  if (isLoading) {
    return (
      <div className="surface-card rounded-2xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-8 w-32 rounded-xl" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
    );
  }

  const gridWidthPx = weeks.length * WEEK_COL_STEP_PX - CELL_GAP_PX;

  return (
    <div className="surface-card rounded-2xl p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-[#F4F5F7]">Activity Heatmap</h3>
          <p className="mt-1 font-mono text-xs tabular-nums text-[#646C7A]">
            <span className="font-medium text-[#9CA3B0]">{activeDays}</span> active day
            {activeDays === 1 ? '' : 's'} ·{' '}
            <span className="font-medium text-[#9CA3B0]">
              {formatSecondsToString(totalSeconds)}
            </span>{' '}
            in {year}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            scale="icon_sm"
            aria-label={`View ${year - 1}`}
            onClick={() => {
              setTooltip(null);
              setYear((y) => y - 1);
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-13 text-center font-mono text-xs font-semibold tabular-nums text-[#F4F5F7]">
            {year}
          </span>
          <Button
            variant="secondary"
            scale="icon_sm"
            aria-label={`View ${year + 1}`}
            disabled={isCurrentYear}
            onClick={() => {
              setTooltip(null);
              setYear((y) => y + 1);
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {tooltip &&
        createPortal(
          <div
            role="tooltip"
            className={cn(
              'surface-elevated pointer-events-none fixed z-[1300] -translate-x-1/2 rounded-xl px-3 py-2 text-xs whitespace-nowrap shadow-xl',
              tooltip.placement === 'above' ? '-translate-y-full' : '',
            )}
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <p className="font-mono font-semibold tabular-nums text-[#F4F5F7]">
              {tooltip.isFuture ? 'Upcoming' : formatSecondsToString(tooltip.seconds)}
            </p>
            <p className="mt-0.5 text-[#9CA3B0]">{format(tooltip.date, 'EEEE, MMM d, yyyy')}</p>
            {onSelectDay && !tooltip.isFuture && (
              <p className="mt-1 text-[10px] font-medium text-amber-400">Click to view sessions</p>
            )}
          </div>,
          document.body,
        )}

      <div className="overflow-x-auto pb-2">
        <div className="inline-flex gap-3 pr-6">
          {/* Weekday labels aligned to Monday = row 0 */}
          <div className="flex shrink-0 flex-col gap-1 pt-5">
            {WEEKDAY_LABELS.map((label, i) => (
              <span
                key={i}
                className="flex h-3.5 items-center font-mono text-[10px] leading-none text-[#646C7A]"
              >
                {label}
              </span>
            ))}
          </div>

          <div>
            {/* Month labels aligned to exact 18px week column pitch */}
            <div className="relative mb-1 h-4" style={{ width: `${gridWidthPx}px` }}>
              {monthLabels.map(({ weekIndex, label }) => (
                <span
                  key={weekIndex}
                  className="absolute font-mono text-[10px] text-[#646C7A]"
                  style={{ left: `${weekIndex * WEEK_COL_STEP_PX}px` }}
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Heatmap grid */}
            <div className="flex gap-1">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-1">
                  {week.map((day) => {
                    if (!day.inYear) {
                      return <div key={day.key} aria-hidden="true" className="h-3.5 w-3.5" />;
                    }

                    const level = day.isFuture ? 0 : getLevel(day.seconds, maxSeconds);
                    const canOpen = Boolean(onSelectDay) && !day.isFuture;
                    const dayLabel = day.isFuture
                      ? `${format(day.date, 'EEEE, MMM d, yyyy')}: upcoming`
                      : `${format(day.date, 'EEEE, MMM d, yyyy')}: ${formatSecondsToString(day.seconds)} focus`;

                    return (
                      <button
                        key={day.key}
                        type="button"
                        disabled={!canOpen}
                        aria-label={dayLabel}
                        onMouseEnter={(e) => handleMouseEnter(e, day)}
                        onMouseLeave={() => setTooltip(null)}
                        onFocus={(e) => showTooltip(e.currentTarget, day)}
                        onBlur={() => setTooltip(null)}
                        onClick={() => {
                          if (canOpen && onSelectDay) {
                            setTooltip(null);
                            onSelectDay(day.key);
                          }
                        }}
                        className={cn(
                          'h-3.5 w-3.5 rounded-[3px] transition-transform duration-100 focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:outline-none',
                          LEVEL_COLORS[level],
                          day.isFuture
                            ? 'cursor-default opacity-35'
                            : canOpen
                              ? 'cursor-pointer hover:scale-125'
                              : 'cursor-default',
                          day.isToday &&
                            'ring-1 ring-[#F4F5F7]/85 ring-offset-1 ring-offset-[#14171D]',
                        )}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5">
        <span className="mr-1 font-mono text-[10px] text-[#646C7A]">Less</span>
        {LEVEL_COLORS.map((colorClass, i) => (
          <div key={i} className={cn('h-3 w-3 rounded-[3px]', colorClass)} />
        ))}
        <span className="ml-1 font-mono text-[10px] text-[#646C7A]">More</span>
      </div>
    </div>
  );
}
