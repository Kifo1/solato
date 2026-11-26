import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Cloud,
  Database,
  HardDrive,
  Keyboard,
  Loader2,
  LogIn,
  LogOut,
  LucideIcon,
  Palette,
  PanelLeft,
  Radio,
  RefreshCw,
  Timer,
  Zap,
} from 'lucide-react';
import LoginModal from '@features/login/components/LoginModal';
import { useAuth } from '@features/login/hooks/useAuth';
import AppearanceSettings from '@features/settings/components/AppearanceSettings.tsx';
import DiscordSettings from '@features/settings/components/DiscordSettings.tsx';
import PhaseDurationSliders from '@features/settings/components/PhaseDurationSliders.tsx';
import PowerSettings from '@features/settings/components/PowerSettings.tsx';
import { useSettings } from '@features/settings/hooks/useSettings.ts';
import Button from '@shared/components/Button';
import { Skeleton } from '@shared/components/Skeleton.tsx';
import Switch from '@shared/components/Switch';
import { useLayout } from '@shared/context/LayoutContext';
import { useToast } from '@shared/context/ToastContext';
import { cn, getErrorMessage } from '@shared/lib/utils.ts';

type SettingsSectionId =
  | 'rhythm'
  | 'appearance'
  | 'power'
  | 'integrations'
  | 'workspace'
  | 'account';

interface SettingsNavItem {
  id: SettingsSectionId;
  label: string;
  description: string;
  Icon: LucideIcon;
}

const SETTINGS_SECTIONS: SettingsNavItem[] = [
  {
    id: 'rhythm',
    label: 'Focus Rhythm',
    description: 'Choose a Pomodoro preset or fine-tune each interval with millisecond-clean control.',
    Icon: Timer,
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Personalize Solato with curated dark and daylight studio color themes.',
    Icon: Palette,
  },
  {
    id: 'power',
    label: 'System & Power',
    description: 'Control desktop sleep prevention and keep phase alerts dependable.',
    Icon: Zap,
  },
  {
    id: 'integrations',
    label: 'Integrations',
    description: 'Connect Solato with external desktop apps and live status surfaces.',
    Icon: Radio,
  },
  {
    id: 'workspace',
    label: 'Workspace & Keys',
    description: 'Tailor navigation chrome and master keyboard-first focus shortcuts.',
    Icon: Keyboard,
  },
  {
    id: 'account',
    label: 'Account & Sync',
    description: 'Manage your Solato Cloud connection and offline-first local storage.',
    Icon: Cloud,
  },
];

const VALID_SECTIONS = new Set<SettingsSectionId>(SETTINGS_SECTIONS.map((s) => s.id));

interface ShortcutEntry {
  keys: string[];
  label: string;
  context: string;
}

const KEYBOARD_SHORTCUTS: ShortcutEntry[] = [
  { keys: ['Space'], label: 'Start / Pause timer', context: 'Timer' },
  { keys: ['R'], label: 'Reset active timer', context: 'Timer' },
  { keys: ['F'], label: 'Toggle Zen Focus Mode', context: 'Timer' },
  { keys: ['⌘K', 'Ctrl+K'], label: 'Open Command Palette', context: 'Global' },
  { keys: ['⌘B', 'Ctrl+B'], label: 'Collapse / Expand Sidebar', context: 'Global' },
  { keys: ['Esc'], label: 'Exit Zen Mode or close dialogs', context: 'Global' },
];

function SettingsPaneSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[0, 1, 2, 3].map((idx) => (
          <div key={idx} className="surface-card space-y-2.5 rounded-2xl p-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-5 w-16 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="surface-card space-y-4 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-9 w-full rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {[0, 1, 2].map((idx) => (
          <div key={idx} className="surface-card space-y-4 rounded-2xl p-4">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-8 w-8 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkspaceAndKeysSection() {
  const { isSidebarCollapsed, setSidebarCollapsed, openCommandPalette } = useLayout();
  const toast = useToast();

  const handleSidebarToggle = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    toast.info(
      collapsed ? 'Compact icon rail enabled' : 'Expanded sidebar enabled',
      'You can toggle this anytime with ⌘B / Ctrl+B.',
    );
  };

  return (
    <div className="space-y-4">
      {/* Sidebar Rail Preference */}
      <div className="surface-card rounded-2xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors',
                isSidebarCollapsed
                  ? 'border-amber-500/30 bg-amber-500/12 text-amber-400'
                  : 'border-line bg-tint-subtle text-fg-secondary',
              )}
            >
              <PanelLeft className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold tracking-tight text-fg">
                  Compact icon rail by default
                </h3>
                <span className="rounded-md border border-line bg-tint px-1.5 py-0.5 font-mono text-[10px] text-fg-secondary">
                  {isSidebarCollapsed ? 'Collapsed' : 'Expanded'}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-fg-secondary">
                Keep the left navigation sidebar folded to an icon rail so your timer and analytics
                get maximum canvas breathing room.
              </p>
            </div>
          </div>

          <Switch
            isOn={isSidebarCollapsed}
            setIsOn={handleSidebarToggle}
            ariaLabel="Compact icon rail by default"
          />
        </div>
      </div>

      {/* Keyboard Shortcuts Reference */}
      <div className="surface-card rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-fg">
              Keyboard Shortcuts
            </h3>
            <p className="mt-0.5 text-xs text-fg-muted">
              Fast desktop controls designed to keep your hands on the keyboard.
            </p>
          </div>

          <Button
            variant="secondary"
            scale="sm"
            onClick={openCommandPalette}
            className="font-mono text-[11px]"
          >
            Try ⌘K Palette
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {KEYBOARD_SHORTCUTS.map((item) => (
            <div
              key={item.label}
              className="surface-well flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-fg">{item.label}</p>
                <p className="mt-0.5 text-[10px] font-medium tracking-wider text-fg-muted uppercase">
                  {item.context}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {item.keys.map((keyCombo, idx) => (
                  <span key={keyCombo} className="inline-flex items-center gap-1">
                    {idx > 0 && <span className="text-[10px] text-fg-muted">/</span>}
                    <kbd className="inline-flex min-w-6 items-center justify-center rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] font-medium text-fg-bright shadow-[inset_0_-1px_0_rgba(0,0,0,0.45)]">
                      {keyCombo}
                    </kbd>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AccountAndSyncSection() {
  const { isLoggedIn, isLoading, error, refetch, logout, isLoggingOut } = useAuth();
  const toast = useToast();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await logout();
      toast.info(
        'Signed out of Solato Cloud',
        'Switched to Local-Only Mode. Your local SQLite data remains intact.',
      );
    } catch (err) {
      toast.error('Sign out failed', getErrorMessage(err, 'Could not clear session.'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="surface-card rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors',
                isLoggedIn
                  ? 'border-teal-400/30 bg-teal-400/12 text-teal-300'
                  : 'border-amber-500/25 bg-amber-500/10 text-amber-400',
              )}
            >
              {isLoggedIn ? (
                <Cloud className="h-4.5 w-4.5" />
              ) : (
                <HardDrive className="h-4.5 w-4.5" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold tracking-tight text-fg">
                  Solato Cloud Sync
                </h3>
                {isLoading ? (
                  <Skeleton className="h-5 w-24 rounded-full" />
                ) : isLoggedIn ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/25 bg-teal-400/10 px-2.5 py-0.5 text-[11px] font-medium text-teal-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Local-Only Mode
                  </span>
                )}
              </div>

              <p className="mt-1 max-w-lg text-xs leading-relaxed text-fg-secondary">
                {isLoggedIn
                  ? 'Your projects, folders, and recorded focus sessions are backed up automatically to Solato Cloud every 60 seconds.'
                  : 'Everything is safely persisted in your local SQLite database. Sign in anytime to enable encrypted cloud backup across devices.'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isLoggedIn ? (
              <Button
                variant="secondary"
                scale="md"
                disabled={isLoggingOut}
                onClick={() => void handleSignOut()}
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing out...
                  </>
                ) : (
                  <>
                    <LogOut className="h-4 w-4 text-fg-secondary" />
                    Sign Out
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="primary"
                scale="md"
                disabled={isLoading}
                onClick={() => setIsLoginModalOpen(true)}
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200"
          >
            <div className="flex min-w-0 items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span className="truncate">{error}</span>
            </div>
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-rose-400/25 bg-rose-500/15 px-2.5 py-1 text-[11px] font-medium text-rose-200 transition-colors hover:bg-rose-500/25"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}

        {/* Offline-first SQLite + Auto-Sync details */}
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-line-subtle pt-5 sm:grid-cols-2">
          <div className="surface-well flex items-start gap-3 rounded-xl p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-tint-subtle text-amber-400">
              <Database className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-fg">Offline-First SQLite Engine</p>
              <p className="mt-1 text-[11px] leading-relaxed text-fg-secondary">
                Every timer session and project edit writes locally first. Solato remains instant
                and reliable with or without an internet connection.
              </p>
            </div>
          </div>

          <div className="surface-well flex items-start gap-3 rounded-xl p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-tint-subtle text-teal-300">
              <RefreshCw className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-fg">60s Background Cloud Sync</p>
              <p className="mt-1 text-[11px] leading-relaxed text-fg-secondary">
                Signed-in workspaces merge changes automatically using UUIDs and latest-timestamp
                conflict resolution, with tokens stored in your OS keyring.
              </p>
            </div>
          </div>
        </div>
      </div>

      <LoginModal isOpen={isLoginModalOpen} setIsOpen={setIsLoginModalOpen} />
    </div>
  );
}

export default function SettingsPage() {
  const { settings, isLoading, error } = useSettings();
  const { isLoggedIn } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawSection = searchParams.get('section') as SettingsSectionId | null;
  const activeSection: SettingsSectionId =
    rawSection && VALID_SECTIONS.has(rawSection) ? rawSection : 'rhythm';

  const currentMeta =
    SETTINGS_SECTIONS.find((section) => section.id === activeSection) ?? SETTINGS_SECTIONS[0];

  const handleSelectSection = (id: SettingsSectionId) => {
    if (id === 'rhythm') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ section: id }, { replace: true });
    }
  };

  const needsBackendSettings =
    activeSection === 'rhythm' || activeSection === 'power' || activeSection === 'integrations';

  const renderSectionContent = () => {
    if (needsBackendSettings) {
      if (isLoading) {
        return <SettingsPaneSkeleton />;
      }
      if (error) {
        return (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3.5 text-sm text-rose-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <div>
              <p className="font-medium text-rose-200">Unable to load settings</p>
              <p className="mt-0.5 text-xs text-rose-300/80">
                {getErrorMessage(error, 'Failed to read your local preferences.')}
              </p>
            </div>
          </div>
        );
      }
    }

    switch (activeSection) {
      case 'rhythm':
        return <PhaseDurationSliders />;
      case 'appearance':
        return <AppearanceSettings />;
      case 'power':
        return <PowerSettings />;
      case 'integrations':
        return <DiscordSettings />;
      case 'workspace':
        return <WorkspaceAndKeysSection />;
      case 'account':
        return <AccountAndSyncSection />;
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-7 sm:px-8">
      <header className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1.5 text-sm text-fg-secondary">
          Tune your focus cadence, desktop behavior, and integrations.
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[216px_minmax(0,1fr)]">
        {/* Left Sticky Category Rail (horizontal pill strip on mobile) */}
        <nav
          aria-label="Settings categories"
          className="surface-card flex gap-1.5 overflow-x-auto rounded-2xl p-2 md:sticky md:top-7 md:flex-col md:gap-1 md:overflow-visible"
        >
          {SETTINGS_SECTIONS.map(({ id, label, Icon }) => {
            const isActive = activeSection === id;

            // Subtle live status indicator dot for Integrations & Account
            let statusDotClass: string | null = null;
            if (id === 'integrations' && settings?.discord_rich_presence) {
              statusDotClass = 'bg-sky-400';
            } else if (id === 'power' && settings?.keep_awake_pomodoro) {
              statusDotClass = 'bg-teal-400';
            } else if (id === 'account') {
              statusDotClass = isLoggedIn ? 'bg-teal-400' : 'bg-amber-400/80';
            }

            return (
              <button
                key={id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => handleSelectSection(id)}
                className={cn(
                  'group relative flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium whitespace-nowrap transition-all duration-150 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none md:w-full md:text-[13px]',
                  isActive
                    ? 'bg-amber-500/[0.11] text-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'text-fg-secondary hover:bg-tint hover:text-fg',
                )}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="solar-glow hidden md:block md:absolute md:top-1/2 md:left-0 md:h-4.5 md:w-[3px] md:-translate-y-1/2 md:rounded-r-full md:bg-amber-400"
                  />
                )}
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    isActive ? 'text-amber-400' : 'text-fg-muted group-hover:text-fg',
                  )}
                />
                <span className="truncate">{label}</span>
                {statusDotClass && (
                  <span
                    aria-hidden="true"
                    className={cn('ml-auto hidden h-1.5 w-1.5 shrink-0 rounded-full md:block', statusDotClass)}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Content Pane */}
        <section aria-labelledby="settings-section-heading" className="min-w-0 space-y-4">
          <div className="px-0.5">
            <h2
              id="settings-section-heading"
              className="text-base font-semibold tracking-tight text-fg"
            >
              {currentMeta.label}
            </h2>
            <p className="mt-0.5 text-xs text-fg-secondary">{currentMeta.description}</p>
          </div>

          {renderSectionContent()}
        </section>
      </div>
    </div>
  );
}
