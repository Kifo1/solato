import LoginButton from '@/features/login/components/LoginButton';
import LoginUser from '@/features/login/components/LoginUser';
import { AUTH_QUERY_KEY, useAuth } from '@/features/login/hooks/useAuth';
import { SolatoLogo } from '@shared/components/SolatoLogo';
import { cn, formatMillis } from '@shared/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  ArrowUpRight,
  ChartLine,
  FolderDot,
  LucideIcon,
  RefreshCw,
  Settings,
  Timer,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

type TimerMode = 'stopwatch' | 'pomodoro';

interface SidebarProject {
  id: string;
  name: string;
  color: string;
}

interface NavbarItemProps {
  name: string;
  Icon: LucideIcon;
  to: string;
}

function NavbarItem({ name, Icon, to }: Readonly<NavbarItemProps>) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none',
          isActive
            ? 'bg-amber-500/[0.10] text-amber-300'
            : 'text-[#9CA3B0] hover:bg-white/[0.045] hover:text-[#F4F5F7]',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className="solar-glow absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-amber-400"
            />
          )}
          <Icon
            size={18}
            strokeWidth={isActive ? 2 : 1.75}
            className={cn(
              'shrink-0 transition-colors duration-150',
              isActive ? 'text-amber-400' : 'text-[#646C7A] group-hover:text-[#F4F5F7]',
            )}
          />
          <span className="truncate">{name}</span>
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const { isLoggedIn, isLoading, error, refetch } = useAuth();

  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState<TimerMode>('stopwatch');
  const [activeMillis, setActiveMillis] = useState(0);
  const [selectedProject, setSelectedProject] = useState<SidebarProject | null>(null);

  const syncTimerSnapshot = useCallback(async () => {
    try {
      const [running, mode, stopwatchMillis, pomodoroMillis, project] = await Promise.all([
        invoke<boolean>('is_timer_running'),
        invoke<TimerMode>('get_timer_mode'),
        invoke<number>('get_stopwatch_millis'),
        invoke<number>('get_pomodoro_millis'),
        invoke<SidebarProject | null>('get_selected_project'),
      ]);

      setIsTimerRunning(running);
      setTimerMode(mode);
      setActiveMillis(mode === 'pomodoro' ? pomodoroMillis : stopwatchMillis);
      setSelectedProject(project);
    } catch {
      // Ignore transient backend fetch failures in sidebar indicator
    }
  }, []);

  useEffect(() => {
    syncTimerSnapshot();
  }, [syncTimerSnapshot]);

  // Keep mode & selected project fresh when navigating away from /timer while active
  useEffect(() => {
    if (!isTimerRunning) return;
    syncTimerSnapshot();
  }, [location.pathname, isTimerRunning, syncTimerSnapshot]);

  useEffect(() => {
    let cancelled = false;
    const unlisteners: Array<() => void> = [];

    const register = async () => {
      try {
        const unlistenAuth = await listen('auth-status-changed', () => {
          queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
        });
        if (cancelled) {
          unlistenAuth();
          return;
        }
        unlisteners.push(unlistenAuth);
        queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });

        const unlistenRunning = await listen<boolean>('timer-running-changed', (event) => {
          setIsTimerRunning(event.payload);
          if (event.payload) {
            syncTimerSnapshot();
          }
        });
        if (cancelled) {
          unlistenRunning();
          return;
        }
        unlisteners.push(unlistenRunning);

        const unlistenTick = await listen<number>('timer-tick', (event) => {
          setActiveMillis(event.payload);
        });
        if (cancelled) {
          unlistenTick();
          return;
        }
        unlisteners.push(unlistenTick);
      } catch {
        // Ignore listener registration failure outside Tauri runtime
      }
    };

    register();

    return () => {
      cancelled = true;
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, [queryClient, syncTimerSnapshot]);

  const showActiveTimerCard = isTimerRunning && location.pathname !== '/timer';

  return (
    <aside className="flex w-60 shrink-0 flex-col justify-between border-r border-white/[0.06] bg-[#0E1014] px-3 py-4 select-none">
      <div className="flex flex-col gap-6">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 pt-0.5">
          <SolatoLogo size={34} isActive={isTimerRunning} />
          <div className="min-w-0">
            <span className="block truncate text-base font-semibold tracking-tight leading-tight text-[#F4F5F7]">
              Solato
            </span>
            <p className="mt-0.5 truncate text-[11px] leading-tight text-[#646C7A]">
              Focus Studio
            </p>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav aria-label="Main navigation" className="flex flex-col gap-1">
          <NavbarItem name="Timer" Icon={Timer} to="/timer" />
          <NavbarItem name="Projects" Icon={FolderDot} to="/projects" />
          <NavbarItem name="Analytics" Icon={ChartLine} to="/analytics" />
          <NavbarItem name="Settings" Icon={Settings} to="/settings" />
        </nav>
      </div>

      {/* Bottom Stack: Live Active Timer Mini-Card + Account Footer */}
      <div className="flex flex-col gap-3">
        {showActiveTimerCard && (
          <button
            type="button"
            onClick={() => navigate('/timer')}
            className="surface-card group flex w-full cursor-pointer flex-col rounded-xl p-3 text-left transition-all duration-150 hover:border-amber-500/30 hover:bg-[#191D26] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1014] focus-visible:outline-none"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                </span>
                <span className="text-[11px] font-medium tracking-wider uppercase text-amber-300/90">
                  {timerMode === 'pomodoro' ? 'Pomodoro' : 'Stopwatch'}
                </span>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#646C7A] transition-colors duration-150 group-hover:text-amber-300" />
            </div>

            <div className="mt-1.5 font-mono text-lg font-semibold tracking-tight text-[#F4F5F7] tabular-nums">
              {formatMillis(activeMillis)}
            </div>

            <div className="mt-1.5 flex items-center gap-1.5">
              {selectedProject ? (
                <>
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: selectedProject.color || '#F59E0B' }}
                  />
                  <span className="truncate text-xs text-[#9CA3B0]">{selectedProject.name}</span>
                </>
              ) : (
                <span className="truncate text-xs text-[#646C7A]">No project selected</span>
              )}
            </div>
          </button>
        )}

        <div className="border-t border-white/[0.06] pt-3">
          {isLoading ? (
            <div
              aria-label="Loading account status"
              className="surface-well flex animate-pulse items-center gap-3 rounded-xl px-3 py-2.5"
            >
              <div className="h-8 w-8 shrink-0 rounded-lg bg-white/[0.06]" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-16 rounded bg-white/[0.08]" />
                <div className="h-2.5 w-24 rounded bg-white/[0.05]" />
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.08] px-3 py-2">
                <span className="truncate text-[11px] text-rose-300" title={error}>
                  Sync status unavailable
                </span>
                <button
                  type="button"
                  onClick={() => refetch()}
                  title="Retry connection"
                  aria-label="Retry checking account status"
                  className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-rose-300 transition-colors hover:bg-rose-500/15 hover:text-rose-200 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
              <LoginButton />
            </div>
          ) : isLoggedIn ? (
            <LoginUser />
          ) : (
            <LoginButton />
          )}
        </div>
      </div>
    </aside>
  );
}
