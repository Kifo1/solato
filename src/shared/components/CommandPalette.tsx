import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import {
  ChartLine,
  CornerDownLeft,
  FolderDot,
  History,
  Hourglass,
  Maximize2,
  Palette,
  PanelLeft,
  Play,
  RotateCcw,
  Search,
  Settings,
  Timer,
} from 'lucide-react';
import { useLayout } from '@shared/context/LayoutContext';
import { useTheme } from '@shared/context/ThemeContext';
import { useToast } from '@shared/context/ToastContext';
import { getFolderPathMap, type Folder, type Project } from '@shared/lib/models/project';
import { cn, getErrorMessage } from '@shared/lib/utils';

interface CommandItem {
  id: string;
  group: 'Navigation' | 'Timer Controls' | 'Focus Project' | 'Appearance' | 'Workspace';
  label: string;
  subtitle?: string;
  shortcut?: string;
  keywords?: string;
  icon: ReactNode;
  onSelect: () => void | Promise<void>;
}

const GROUP_ORDER: CommandItem['group'][] = [
  'Focus Project',
  'Timer Controls',
  'Navigation',
  'Appearance',
  'Workspace',
];

export function CommandPalette() {
  const {
    isCommandPaletteOpen,
    closeCommandPalette,
    toggleSidebar,
    isSidebarCollapsed,
    toggleZenMode,
    isZenMode,
  } = useLayout();
  const { themeId, themes, setTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => invoke<Project[]>('get_projects'),
    enabled: isCommandPaletteOpen,
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: () => invoke<Folder[]>('get_folders'),
    enabled: isCommandPaletteOpen,
  });

  const folderPaths = useMemo(() => getFolderPathMap(folders), [folders]);

  useEffect(() => {
    if (!isCommandPaletteOpen) return;
    setQuery('');
    setActiveIndex(0);
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [isCommandPaletteOpen]);

  const allItems = useMemo<CommandItem[]>(() => {
    const navItems: CommandItem[] = [
      {
        id: 'nav-timer',
        group: 'Navigation',
        label: 'Go to Timer Studio',
        subtitle: 'Chronometer and Pomodoro focus workspace',
        icon: <Timer className="h-4 w-4 text-amber-400" />,
        keywords: 'stopwatch pomodoro focus clock',
        onSelect: () => navigate('/timer'),
      },
      {
        id: 'nav-projects',
        group: 'Navigation',
        label: 'Go to Projects',
        subtitle: 'Manage projects and nested folders',
        icon: <FolderDot className="h-4 w-4 text-fg-secondary" />,
        keywords: 'folders tasks workspace',
        onSelect: () => navigate('/projects'),
      },
      {
        id: 'nav-analytics',
        group: 'Navigation',
        label: 'Go to Analytics Overview',
        subtitle: 'Streaks, charts, and yearly activity heatmap',
        icon: <ChartLine className="h-4 w-4 text-fg-secondary" />,
        keywords: 'stats charts heatmap streak',
        onSelect: () => navigate('/analytics'),
      },
      {
        id: 'nav-sessions',
        group: 'Navigation',
        label: 'Open Session Log',
        subtitle: 'Browse, filter, and edit past focus sessions',
        icon: <History className="h-4 w-4 text-fg-secondary" />,
        keywords: 'history log entries edit',
        onSelect: () => navigate('/analytics?tab=sessions'),
      },
      {
        id: 'nav-settings',
        group: 'Navigation',
        label: 'Open Settings',
        subtitle: 'Focus rhythm, power, Discord, and shortcuts',
        icon: <Settings className="h-4 w-4 text-fg-secondary" />,
        keywords: 'preferences pomodoro discord power',
        onSelect: () => navigate('/settings'),
      },
    ];

    const timerItems: CommandItem[] = [
      {
        id: 'timer-toggle',
        group: 'Timer Controls',
        label: 'Start / Pause Timer',
        subtitle: 'Toggle the active timer session',
        shortcut: 'Space',
        icon: <Play className="h-4 w-4 text-amber-400" />,
        keywords: 'play stop resume',
        onSelect: async () => {
          try {
            const running = await invoke<boolean>('is_timer_running');
            if (running) {
              await invoke('stop_timer');
              toast.info('Timer paused');
            } else {
              await invoke('start_timer');
              toast.success('Focus session started');
            }
            queryClient.invalidateQueries({ queryKey: ['timer_projects'] });
            queryClient.invalidateQueries({ queryKey: ['todays_overall_time'] });
          } catch (err) {
            toast.error('Timer action failed', getErrorMessage(err));
          }
        },
      },
      {
        id: 'timer-mode-pomodoro',
        group: 'Timer Controls',
        label: 'Switch to Pomodoro Mode',
        subtitle: 'Structured focus and break intervals',
        icon: <Hourglass className="h-4 w-4 text-teal-400" />,
        keywords: 'intervals cycles focus break',
        onSelect: async () => {
          try {
            await invoke('stop_timer');
            await invoke('switch_timer_mode', { timerMode: 'pomodoro' });
            navigate('/timer');
            toast.info('Switched to Pomodoro');
          } catch (err) {
            toast.error('Could not switch mode', getErrorMessage(err));
          }
        },
      },
      {
        id: 'timer-mode-stopwatch',
        group: 'Timer Controls',
        label: 'Switch to Stopwatch Mode',
        subtitle: 'Open-ended continuous session tracking',
        icon: <Timer className="h-4 w-4 text-amber-400" />,
        keywords: 'open tracking count up',
        onSelect: async () => {
          try {
            await invoke('stop_timer');
            await invoke('switch_timer_mode', { timerMode: 'stopwatch' });
            navigate('/timer');
            toast.info('Switched to Stopwatch');
          } catch (err) {
            toast.error('Could not switch mode', getErrorMessage(err));
          }
        },
      },
      {
        id: 'timer-reset',
        group: 'Timer Controls',
        label: 'Reset Timer',
        subtitle: 'Reset current timer interval',
        shortcut: 'R',
        icon: <RotateCcw className="h-4 w-4 text-fg-secondary" />,
        keywords: 'clear restart zero',
        onSelect: async () => {
          try {
            await invoke('reset_timer');
            toast.info('Timer reset');
          } catch (err) {
            toast.error('Reset failed', getErrorMessage(err));
          }
        },
      },
    ];

    const workspaceItems: CommandItem[] = [
      {
        id: 'ws-sidebar',
        group: 'Workspace',
        label: isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar',
        subtitle: 'Toggle compact icon rail',
        shortcut: '⌘B',
        icon: <PanelLeft className="h-4 w-4 text-fg-secondary" />,
        keywords: 'navigation rail fold hide',
        onSelect: () => toggleSidebar(),
      },
      {
        id: 'ws-zen',
        group: 'Workspace',
        label: isZenMode ? 'Exit Zen Focus Mode' : 'Enter Zen Focus Mode',
        subtitle: 'Hide navigation chrome for distraction-free focus',
        shortcut: 'F',
        icon: <Maximize2 className="h-4 w-4 text-amber-400" />,
        keywords: 'fullscreen distraction free minimal',
        onSelect: () => {
          if (!isZenMode) navigate('/timer');
          toggleZenMode();
        },
      },
    ];

    const projectItems: CommandItem[] = projects.map((project) => {
      const folderPath = project.folder_id ? folderPaths.get(project.folder_id) : undefined;
      return {
        id: `project-${project.id}`,
        group: 'Focus Project',
        label: project.name,
        subtitle: folderPath ? `${folderPath} · Switch active timer project` : 'Switch active timer project',
        keywords: `${project.description} ${folderPath ?? ''}`,
        icon: (
          <span
            className="h-3 w-3 rounded-full ring-2 ring-line"
            style={{ backgroundColor: project.color || '#F59E0B' }}
          />
        ),
        onSelect: async () => {
          try {
            await invoke('set_selected_project', { project });
            queryClient.invalidateQueries({ queryKey: ['timer_projects'] });
            navigate('/timer');
            toast.success(`Focus set to ${project.name}`);
          } catch (err) {
            toast.error('Failed to select project', getErrorMessage(err));
          }
        },
      };
    });

    const themeItems: CommandItem[] = [
      {
        id: 'nav-appearance',
        group: 'Appearance',
        label: 'Open Appearance & Themes',
        subtitle: 'Preview all dark and daylight studio themes',
        icon: <Palette className="h-4 w-4 text-amber-400" />,
        keywords: 'theme dark light color studio appearance',
        onSelect: () => navigate('/settings?section=appearance'),
      },
      ...themes.map((def) => ({
        id: `theme-${def.id}`,
        group: 'Appearance' as const,
        label: `Theme: ${def.name}`,
        subtitle: def.id === themeId ? `Active · ${def.tagline}` : def.tagline,
        keywords: `theme color appearance ${def.mode} ${def.name} ${def.tagline}`,
        icon: (
          <span
            className="h-3.5 w-3.5 rounded-full ring-2 ring-line"
            style={{
              background: `linear-gradient(135deg, ${def.preview.canvas} 45%, ${def.preview.accent} 45%)`,
            }}
          />
        ),
        onSelect: () => {
          setTheme(def.id);
          toast.success(`Theme switched to ${def.name}`);
        },
      })),
    ];

    return [...navItems, ...timerItems, ...workspaceItems, ...themeItems, ...projectItems];
  }, [
    projects,
    folderPaths,
    navigate,
    queryClient,
    toast,
    isSidebarCollapsed,
    toggleSidebar,
    isZenMode,
    toggleZenMode,
    themes,
    themeId,
    setTheme,
  ]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Show top navigation, workspace, timer, and up to 5 projects cleanly when empty
      const projectsShown = allItems.filter((i) => i.group === 'Focus Project').slice(0, 5);
      const others = allItems.filter((i) => i.group !== 'Focus Project');
      return [...projectsShown, ...others];
    }
    return allItems.filter((item) => {
      const haystack = `${item.label} ${item.subtitle ?? ''} ${item.keywords ?? ''} ${item.group}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [allItems, query]);

  const grouped = useMemo(() => {
    const map = new Map<CommandItem['group'], CommandItem[]>();
    for (const group of GROUP_ORDER) {
      const items = filteredItems.filter((i) => i.group === group);
      if (items.length > 0) map.set(group, items);
    }
    return map;
  }, [filteredItems]);

  const flatVisible = useMemo(() => {
    const list: CommandItem[] = [];
    for (const items of grouped.values()) {
      list.push(...items);
    }
    return list;
  }, [grouped]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const executeItem = async (item: CommandItem) => {
    closeCommandPalette();
    await item.onSelect();
  };

  useEffect(() => {
    if (!isCommandPaletteOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeCommandPalette();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((prev) => (flatVisible.length === 0 ? 0 : (prev + 1) % flatVisible.length));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((prev) =>
          flatVisible.length === 0 ? 0 : (prev - 1 + flatVisible.length) % flatVisible.length,
        );
        return;
      }
      if (event.key === 'Enter' && flatVisible[activeIndex]) {
        event.preventDefault();
        void executeItem(flatVisible[activeIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, flatVisible, activeIndex, closeCommandPalette]);

  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(`[data-cmd-index="${activeIndex}"]`);
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!isCommandPaletteOpen) return null;

  let runningIdx = 0;

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeCommandPalette();
      }}
      className="animate-modal-backdrop fixed inset-0 z-[1300] flex items-start justify-center bg-black/65 px-4 pt-[13vh] backdrop-blur-md"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="surface-elevated animate-modal-panel flex w-full max-w-xl flex-col overflow-hidden rounded-2xl"
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 border-b border-line-subtle px-4 py-3.5">
          <Search className="h-4 w-4 shrink-0 text-amber-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Switch project, jump to view, or run a timer command..."
            className="w-full bg-transparent text-sm text-fg placeholder-fg-muted focus:outline-none"
          />
          <kbd className="rounded-md border border-line bg-tint px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[54vh] overflow-y-auto p-2">
          {flatVisible.length === 0 ? (
            <div className="py-10 text-center text-xs text-fg-muted">
              No matching commands or projects found.
            </div>
          ) : (
            Array.from(grouped.entries()).map(([groupName, items]) => (
              <div key={groupName} className="mb-2 last:mb-0">
                <div className="px-2.5 pt-2 pb-1 text-[10px] font-semibold tracking-[0.09em] text-fg-muted uppercase">
                  {groupName}
                </div>
                <div className="flex flex-col gap-0.5">
                  {items.map((item) => {
                    const idx = runningIdx++;
                    const isActive = idx === activeIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-cmd-index={idx}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => void executeItem(item)}
                        className={cn(
                          'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                          isActive
                            ? 'bg-amber-500/[0.12] text-fg'
                            : 'text-fg-secondary hover:bg-tint',
                        )}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line-subtle bg-well">
                          {item.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-fg">
                            {item.label}
                          </span>
                          {item.subtitle && (
                            <span className="block truncate text-[11px] text-fg-muted">
                              {item.subtitle}
                            </span>
                          )}
                        </span>
                        {item.shortcut ? (
                          <kbd className="shrink-0 rounded-md border border-line bg-tint px-1.5 py-0.5 font-mono text-[10px] text-fg-secondary">
                            {item.shortcut}
                          </kbd>
                        ) : isActive ? (
                          <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between border-t border-line-subtle bg-well px-4 py-2 text-[11px] text-fg-muted">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-line bg-tint px-1 font-mono text-[10px]">
                ↑↓
              </kbd>
              Navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-line bg-tint px-1 font-mono text-[10px]">
                ↵
              </kbd>
              Run
            </span>
          </div>
          <span className="font-mono text-[10px] text-fg-muted">Solato Command</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
