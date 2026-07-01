import Button from '@/shared/components/Button';
import { formatSecondsToString } from '@/shared/lib/utils';
import {
  startOfYear,
  endOfYear,
  startOfToday,
  format,
  eachDayOfInterval,
  getYear,
  startOfWeek,
  endOfWeek,
  isSameYear,
} from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarData {
  history: { [key: string]: number };
}

interface DayCell {
  date: Date;
  key: string;
  seconds: number;
  inYear: boolean;
  isToday: boolean;
}

interface MonthLabel {
  weekIndex: number;
  label: string;
}

interface TooltipState {
  x: number;
  y: number;
  date: Date;
  seconds: number;
}

const WEEK_STARTS_ON = 1; // Monday
const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

// Level 0 = no activity, levels 1-4 scale with intensity relative to the
// most active day in the visible year.
const LEVEL_COLORS = [
  'bg-white/5 border border-slate-200/10', // 0 - no activity
  'bg-blue-900/70 border border-blue-900/70', // 1
  'bg-blue-700/80 border border-blue-700/80', // 2
  'bg-blue-500/90 border border-blue-500/90', // 3
  'bg-blue-300 border border-blue-300', // 4
];

function getLevel(seconds: number, max: number): number {
  if (!seconds || seconds <= 0 || max <= 0) return 0;
  const ratio = seconds / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

export function AnalyticCalendar() {
  const [year, setYear] = useState(() => getYear(startOfToday()));
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: calendarData } = useQuery({
    queryKey: ['analytics', 'calendar'],
    queryFn: () => invoke<CalendarData>('get_analytics_calendar'),
  });

  const today = startOfToday();
  const isCurrentYear = isSameYear(new Date(year, 0, 1), today);

  const { weeks, monthLabels, maxSeconds, activeDays, totalSeconds } = useMemo(() => {
    const history = calendarData?.history ?? {};

    const yearStart = startOfYear(new Date(year, 0, 1));
    const yearEnd = endOfYear(yearStart);
    const gridStart = startOfWeek(yearStart, {
      weekStartsOn: WEEK_STARTS_ON,
    });
    const gridEnd = endOfWeek(yearEnd, { weekStartsOn: WEEK_STARTS_ON });

    const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

    let max = 0;
    let active = 0;
    let total = 0;

    const days: DayCell[] = allDays.map((date) => {
      const key = format(date, 'yyyy-MM-dd');
      const seconds = history[key] ?? 0;
      const inYear = isSameYear(date, yearStart);

      if (inYear) {
        if (seconds > max) max = seconds;
        if (seconds > 0) active += 1;
        total += seconds;
      }

      return {
        date,
        key,
        seconds,
        inYear,
        isToday: format(today, 'yyyy-MM-dd') === key,
      };
    });

    const weeks: DayCell[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    const monthLabels: MonthLabel[] = [];
    let lastMonth = -1;
    weeks.forEach((week, weekIndex) => {
      const firstInYearDay = week.find((d) => d.inYear);
      if (!firstInYearDay) return;
      const month = firstInYearDay.date.getMonth();
      if (month !== lastMonth) {
        monthLabels.push({
          weekIndex,
          label: format(firstInYearDay.date, 'MMM'),
        });
        lastMonth = month;
      }
    });

    return {
      weeks,
      monthLabels,
      maxSeconds: max,
      activeDays: active,
      totalSeconds: total,
    };
  }, [calendarData, year, today]);

  const handleMouseEnter = (e: React.MouseEvent, day: DayCell) => {
    if (!day.inYear) return;
    const cellRect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: cellRect.left + cellRect.width / 2,
      y: cellRect.top,
      date: day.date,
      seconds: day.seconds,
    });
  };

  return (
    <div className="rounded-xl border border-slate-200/10 bg-slate-200/5 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-wider text-blue-200 uppercase">Activity</h3>
          <p className="mt-1 text-xs text-blue-200/70">
            {activeDays} active day{activeDays === 1 ? '' : 's'} ·{' '}
            {formatSecondsToString(totalSeconds)} total in {year}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={'secondary'}
            className="rounded-xl border border-white/20 p-2!"
            onClick={() => setYear((y) => y - 1)}
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="w-12 text-center text-sm font-medium text-white">{year}</span>
          <Button
            variant={'secondary'}
            className="rounded-xl border border-white/20 p-2!"
            disabled={isCurrentYear}
            onClick={() => setYear((y) => y + 1)}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {tooltip &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200/10 bg-slate-900 px-3 py-2 text-xs whitespace-nowrap text-white shadow-lg"
            style={{ left: tooltip.x, top: tooltip.y - 8 }}
          >
            <p className="font-semibold">{formatSecondsToString(tooltip.seconds)}</p>
            <p className="text-blue-200/70">{format(tooltip.date, 'EEEE, MMM d, yyyy')}</p>
          </div>,
          document.body,
        )}

      <div ref={containerRef} className="relative overflow-x-auto pb-2">
        <div className="inline-flex gap-3">
          <div className="flex flex-col gap-1 pt-5">
            {WEEKDAY_LABELS.map((label, i) => (
              <span key={i} className="h-3 text-[10px] leading-3 text-blue-200/60 md:h-3.5">
                {label}
              </span>
            ))}
          </div>

          <div>
            <div className="relative mb-1 h-4">
              {monthLabels.map(({ weekIndex, label }) => (
                <span
                  key={weekIndex}
                  className="absolute text-[10px] text-blue-200/60"
                  style={{ left: weekIndex * (14 + 4) }}
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="flex gap-1">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-1">
                  {week.map((day) => (
                    <div
                      key={day.key}
                      onMouseEnter={(e) => handleMouseEnter(e, day)}
                      onMouseLeave={() => setTooltip(null)}
                      className={`h-3 w-3 rounded-sm transition-transform md:h-3.5 md:w-3.5 ${
                        day.inYear
                          ? `${LEVEL_COLORS[getLevel(day.seconds, maxSeconds)]} cursor-pointer hover:scale-125`
                          : 'opacity-0'
                      } ${day.isToday ? 'ring-1 ring-white/70' : ''}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-1.5">
        <span className="mr-1 text-[10px] text-blue-200/60">Less</span>
        {LEVEL_COLORS.map((color, i) => (
          <div key={i} className={`h-3 w-3 rounded-sm ${color}`} />
        ))}
        <span className="ml-1 text-[10px] text-blue-200/60">More</span>
      </div>
    </div>
  );
}
