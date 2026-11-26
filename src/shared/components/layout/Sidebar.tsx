import LoginButton from '@/features/login/components/LoginButton';
import LoginUser from '@/features/login/components/LoginUser';
import { AUTH_QUERY_KEY, useAuth } from '@/features/login/hooks/useAuth';
import { SolatoLogo } from '@shared/components/SolatoLogo';
import { useLayout } from '@shared/context/LayoutContext';
import { cn, formatMillis } from '@shared/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  ArrowUpRight,
  ChartLine,
  FolderDot,
  LucideIcon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings,
  Timer,
} from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

type TimerMode = 'stopwatch' | 'pomodoro';

interface SidebarProject {
  id: string;
  name: string;
  color: string;
}

interface RailTooltipProps {
  children: ReactNode;
  className?: string;
}

function RailTooltip({ children, className }: Readonly<RailTooltipProps>) {
  return (
    <span
      role="tooltip"
      className={cn(
        'surface-elevated pointer-events-none absolute top-1/2 left-full z-50 ml-2.5 flex -translate-x-1 -translate-y-1/2 items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#F4F5F7] whitespace-nowrap opacity-0 shadow-2xl transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100',
        className,
      )}
    >
      {children}
    </span>
  );
}

interface NavbarItemProps {
  name: string;
  Icon: LucideIcon;
  to: string;
  collapsed: boolean;
}

function NavbarItem({ name, Icon, to, collapsed }: Readonly<NavbarItemProps>) {
  return (
    <NavLink
      to={to}
      title={collapsed ? name : undefined}
      aria-label={collapsed ? name : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center rounded-xl text-sm font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none',
          collapsed ? 'mx-auto h-10 w-10 justify-center' : 'gap-3 px-3 py-2.5',
          isActive
            ? collapsed
              ? 'border border-amber-400/25 bg-amber-500/[0.12] text-amber-300'
              : 'bg-amber-500/[0.10] text-amber-300'
            : 'text-[#9CA3B0] hover:bg-white/[0.045] hover:text-[#F4F5F7]',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && !collapsed && (
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
          {!collapsed && <span className="truncate">{name}</span>}
          {collapsed && <RailTooltip>{name}</RailTooltip>}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const { isSidebarCollapsed, toggleSidebar, isZenMode, openCommandPalette } = useLayout();
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
  const liveTimerLabel = formatMillis(activeMillis);

  return (
    <aside
      aria-hidden={isZenMode}
      className={cn(
        'relative z-30 flex shrink-0 flex-col justify-between bg-[#0E1014] py-4 select-none transition-[width,padding,opacity] duration-200 ease-out',
        isZenMode
          ? 'pointer-events-none w-0 overflow-hidden border-r-0 px-0 opacity-0'
          : isSidebarCollapsed
            ? 'w-[68px] overflow-visible border-r border-white/[0.06] px-2.5 opacity-100'
            : 'w-60 overflow-visible border-r border-white/[0.06] px-3 opacity-100',
      )}
    >
      <div className="flex flex-col gap-5">
        {/* Brand Header & Collapse Control */}
        {isSidebarCollapsed ? (
          <div className="flex flex-col items-center gap-2.5 pt-0.5">
            <button
              type="button"
              onClick={() => navigate('/timer')}
              title="Solato Focus Studio"
              aria-label="Solato Focus Studio"
              className="group relative flex cursor-pointer items-center justify-center rounded-xl transition-transform duration-150 hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
            >
              <SolatoLogo size={32} isActive={isTimerRunning} />
              <RailTooltip>Solato · Focus Studio</RailTooltip>
            </button>

            <button
              type="button"
              onClick={toggleSidebar}
              title="Expand sidebar (⌘B)"
              aria-label="Expand sidebar"
              className="group relative mx-auto flex h-8 w-10 cursor-pointer items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-[#646C7A] transition-colors duration-150 hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-[#F4F5F7] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
            >
              <PanelLeftOpen className="h-4 w-4" />
              <RailTooltip>
                <span>Expand sidebar</span>
                <kbd className="rounded border border-white/[0.08] bg-white/[0.05] px-1 py-0.5 font-mono text-[10px] text-[#9CA3B0]">
                  ⌘B
                </kbd>
              </RailTooltip>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 px-1.5 pt-0.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <SolatoLogo size={32} isActive={isTimerRunning} />
              <div className="min-w-0">
                <span className="block truncate text-base font-semibold tracking-tight leading-tight text-[#F4F5F7]">
                  Solato
                </span>
                <p className="mt-0.5 truncate text-[11px] leading-tight text-[#646C7A]">
                  Focus Studio
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleSidebar}
              title="Collapse sidebar (⌘B)"
              aria-label="Collapse sidebar"
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#646C7A] transition-colors duration-150 hover:bg-white/[0.06] hover:text-[#F4F5F7] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Command Palette Trigger (⌘K) */}
        {isSidebarCollapsed ? (
          <button
            type="button"
            onClick={openCommandPalette}
            title="Quick actions (⌘K)"
            aria-label="Quick actions"
            className="surface-well group relative mx-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-[#646C7A] transition-all duration-150 hover:border-white/[0.12] hover:bg-[#151820] hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
          >
            <Search className="h-4 w-4" />
            <RailTooltip>
              <span>Quick actions</span>
              <kbd className="rounded border border-white/[0.08] bg-white/[0.05] px-1 py-0.5 font-mono text-[10px] text-[#9CA3B0]">
                ⌘K
              </kbd>
            </RailTooltip>
          </button>
        ) : (
          <button
            type="button"
            onClick={openCommandPalette}
            className="surface-well group flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all duration-150 hover:border-white/[0.12] hover:bg-[#151820] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
          >
            <Search className="h-3.5 w-3.5 shrink-0 text-[#646C7A] transition-colors duration-150 group-hover:text-amber-400" />
            <span className="min-w-0 flex-1 truncate text-xs text-[#646C7A] transition-colors duration-150 group-hover:text-[#9CA3B0]">
              Quick actions...
            </span>
            <kbd className="shrink-0 rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-[#646C7A] transition-colors duration-150 group-hover:border-white/[0.12] group-hover:text-[#9CA3B0]">
              ⌘K
            </kbd>
          </button>
        )}

        {/* Primary Navigation */}
        <nav aria-label="Main navigation" className="flex flex-col gap-1">
          <NavbarItem name="Timer" Icon={Timer} to="/timer" collapsed={isSidebarCollapsed} />
          <NavbarItem name="Projects" Icon={FolderDot} to="/projects" collapsed={isSidebarCollapsed} />
          <NavbarItem name="Analytics" Icon={ChartLine} to="/analytics" collapsed={isSidebarCollapsed} />
          <NavbarItem name="Settings" Icon={Settings} to="/settings" collapsed={isSidebarCollapsed} />
        </nav>
      </div>

      {/* Bottom Stack: Live Active Timer Indicator + Account Footer */}
      <div className="flex flex-col gap-3">
        {showActiveTimerCard &&
          (isSidebarCollapsed ? (
            <button
              type="button"
              onClick={() => navigate('/timer')}
              title={`${timerMode === 'pomodoro' ? 'Pomodoro' : 'Stopwatch'} · ${liveTimerLabel}${selectedProject ? ` · ${selectedProject.name}` : ''}`}
              aria-label={`Return to active timer (${liveTimerLabel})`}
              className="group relative mx-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/[0.12] text-amber-300 shadow-[0_0_16px_-4px_rgba(245,158,11,0.45)] transition-all duration-150 hover:border-amber-400/55 hover:bg-amber-500/[0.18] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1014] focus-visible:outline-none"
            >
              <Timer className="h-[18px] w-[18px]" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-80" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-[#0E1014]" />
              </span>

              <RailTooltip className="flex-col items-start gap-1 py-2">
                <span className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-amber-300 uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  {timerMode === 'pomodoro' ? 'Pomodoro' : 'Stopwatch'}
                </span>
                <span className="font-mono text-sm font-semibold tracking-tight text-[#F4F5F7] tabular-nums">
                  {liveTimerLabel}
                </span>
                {selectedProject ? (
                  <span className="flex items-center gap-1.5 text-[11px] font-normal text-[#9CA3B0]">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: selectedProject.color || '#F59E0B' }}
                    />
                    {selectedProject.name}
                  </span>
                ) : (
                  <span className="text-[11px] font-normal text-[#646C7A]">No project selected</span>
                )}
              </RailTooltip>
            </button>
          ) : (
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
                {liveTimerLabel}
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
          ))}

        <div className="border-t border-white/[0.06] pt-3">
          {isLoading ? (
            isSidebarCollapsed ? (
              <div
                aria-label="Loading account status"
                className="surface-well mx-auto h-10 w-10 animate-pulse rounded-xl"
              />
            ) : (
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
            )
          ) : error ? (
            <div className="flex flex-col gap-2">
              {isSidebarCollapsed ? (
                <button
                  type="button"
                  onClick={() => refetch()}
                  title={`Sync status unavailable (${error}) · Click to retry`}
                  aria-label="Retry checking account status"
                  className="group relative mx-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-rose-500/25 bg-rose-500/[0.08] text-rose-300 transition-colors hover:bg-rose-500/15 hover:text-rose-200 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
                >
                  <RefreshCw className="h-4 w-4" />
                  <RailTooltip className="text-rose-200">
                    Sync unavailable · Click to retry
                  </RailTooltip>
                </button>
              ) : (
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
              )}
              <LoginButton compact={isSidebarCollapsed} />
            </div>
          ) : isLoggedIn ? (
            <LoginUser compact={isSidebarCollapsed} />
          ) : (
            <LoginButton compact={isSidebarCollapsed} />
          )}
        </div>
      </div>
    </aside>
  );
}
