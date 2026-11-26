import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Coffee,
  LucideIcon,
  Minus,
  Plus,
  Sofa,
  Timer,
} from 'lucide-react';
import { CustomSlider } from '@shared/components/Slider';
import { useToast } from '@shared/context/ToastContext';
import { cn, getErrorMessage } from '@shared/lib/utils';
import { useSettings } from '../hooks/useSettings';

type DurationKey = 'focus_duration' | 'short_break' | 'long_break';
type AccentColor = 'amber' | 'teal' | 'sky';

interface RhythmPreset {
  id: string;
  name: string;
  tagline: string;
  focus_duration: number;
  short_break: number;
  long_break: number;
}

const RHYTHM_PRESETS: RhythmPreset[] = [
  {
    id: 'classic',
    name: 'Classic',
    tagline: 'Balanced daily flow',
    focus_duration: 25,
    short_break: 5,
    long_break: 15,
  },
  {
    id: 'deep-work',
    name: 'Deep Work',
    tagline: 'Long uninterrupted blocks',
    focus_duration: 50,
    short_break: 10,
    long_break: 20,
  },
  {
    id: 'sprint',
    name: 'Sprint',
    tagline: 'Quick momentum bursts',
    focus_duration: 15,
    short_break: 3,
    long_break: 10,
  },
  {
    id: 'ultradian',
    name: 'Ultradian',
    tagline: 'Extended studio cycle',
    focus_duration: 60,
    short_break: 10,
    long_break: 30,
  },
];

interface DurationControlConfig {
  key: DurationKey;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  accentColor: AccentColor;
  min: number;
  max: number;
  step: number;
}

const DURATION_CONTROLS: DurationControlConfig[] = [
  {
    key: 'focus_duration',
    title: 'Focus',
    subtitle: 'Single work block',
    Icon: Timer,
    accentColor: 'amber',
    min: 5,
    max: 90,
    step: 5,
  },
  {
    key: 'short_break',
    title: 'Short Break',
    subtitle: 'Between blocks',
    Icon: Coffee,
    accentColor: 'teal',
    min: 1,
    max: 15,
    step: 1,
  },
  {
    key: 'long_break',
    title: 'Long Break',
    subtitle: 'After full cycle',
    Icon: Sofa,
    accentColor: 'sky',
    min: 5,
    max: 45,
    step: 5,
  },
];

const ACCENT_UI: Record<
  AccentColor,
  { iconContainer: string; valueTint: string; stepperHover: string }
> = {
  amber: {
    iconContainer: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
    valueTint: 'text-amber-300',
    stepperHover: 'hover:border-amber-400/35 hover:text-amber-300',
  },
  teal: {
    iconContainer: 'border-teal-400/25 bg-teal-400/10 text-teal-300',
    valueTint: 'text-teal-300',
    stepperHover: 'hover:border-teal-400/35 hover:text-teal-300',
  },
  sky: {
    iconContainer: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
    valueTint: 'text-sky-300',
    stepperHover: 'hover:border-sky-400/35 hover:text-sky-300',
  },
};

export default function PhaseDurationSliders() {
  const { settings, updateSettings, updateSingleSetting, isUpdating } = useSettings();
  const toast = useToast();

  const [draft, setDraft] = useState({
    focus_duration: settings?.focus_duration ?? 25,
    short_break: settings?.short_break ?? 5,
    long_break: settings?.long_break ?? 15,
  });
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setDraft({
      focus_duration: settings.focus_duration,
      short_break: settings.short_break,
      long_break: settings.long_break,
    });
  }, [settings]);

  const cycleMetrics = useMemo(() => {
    const focus = Math.max(1, draft.focus_duration);
    const shortBreak = Math.max(1, draft.short_break);
    const longBreak = Math.max(1, draft.long_break);
    const totalMinutes = focus * 2 + shortBreak + longBreak;
    const focusRatio = Math.round(((focus * 2) / totalMinutes) * 100);
    return {
      focus,
      shortBreak,
      longBreak,
      totalMinutes,
      focusRatio,
      segments: [
        {
          id: 'focus-1',
          label: 'Focus',
          minutes: focus,
          pct: (focus / totalMinutes) * 100,
          barClass: 'bg-gradient-to-r from-amber-500 to-amber-400 text-[#0A0B0E]',
        },
        {
          id: 'short-1',
          label: 'Short',
          minutes: shortBreak,
          pct: (shortBreak / totalMinutes) * 100,
          barClass: 'bg-teal-400/90 text-[#0A0B0E]',
        },
        {
          id: 'focus-2',
          label: 'Focus',
          minutes: focus,
          pct: (focus / totalMinutes) * 100,
          barClass: 'bg-gradient-to-r from-amber-500 to-amber-400 text-[#0A0B0E]',
        },
        {
          id: 'long-1',
          label: 'Long',
          minutes: longBreak,
          pct: (longBreak / totalMinutes) * 100,
          barClass: 'bg-sky-400/90 text-[#0A0B0E]',
        },
      ],
    };
  }, [draft]);

  if (!settings) return null;

  const activePresetId =
    RHYTHM_PRESETS.find(
      (preset) =>
        preset.focus_duration === draft.focus_duration &&
        preset.short_break === draft.short_break &&
        preset.long_break === draft.long_break,
    )?.id ?? null;

  const handleApplyPreset = async (preset: RhythmPreset) => {
    if (activePresetId === preset.id) return;
    const previous = { ...draft };
    setDraft({
      focus_duration: preset.focus_duration,
      short_break: preset.short_break,
      long_break: preset.long_break,
    });
    setSaveError(null);

    try {
      await updateSettings({
        ...settings,
        focus_duration: preset.focus_duration,
        short_break: preset.short_break,
        long_break: preset.long_break,
      });
      toast.success(
        `${preset.name} rhythm applied`,
        `${preset.focus_duration}m focus · ${preset.short_break}m short · ${preset.long_break}m long`,
      );
    } catch (err) {
      setDraft(previous);
      const message = getErrorMessage(err, 'Failed to apply preset.');
      setSaveError(message);
      toast.error('Could not apply preset', message);
    }
  };

  const handleLiveChange = (key: DurationKey, value: number) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (saveError) setSaveError(null);
  };

  const handleCommitChange = async (key: DurationKey, value: number) => {
    if (value === settings[key]) return;
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaveError(null);

    try {
      await updateSingleSetting({ [key]: value });
    } catch (err) {
      setDraft((prev) => ({ ...prev, [key]: settings[key] }));
      const message = getErrorMessage(err, 'Failed to save duration.');
      setSaveError(message);
      toast.error('Could not save duration', message);
    }
  };

  return (
    <div className="space-y-4">
      {/* 4 Tactile Rhythm Presets */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[11px] font-semibold tracking-[0.08em] text-[#646C7A] uppercase">
            Quick Presets
          </span>
          <span className="font-mono text-[11px] text-[#646C7A]">
            {activePresetId ? 'Preset active' : 'Custom cadence'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {RHYTHM_PRESETS.map((preset) => {
            const isSelected = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={isUpdating}
                aria-pressed={isSelected}
                onClick={() => void handleApplyPreset(preset)}
                className={cn(
                  'group relative flex cursor-pointer flex-col items-start rounded-2xl border p-3.5 text-left transition-all duration-150 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
                  isSelected
                    ? 'border-amber-400/45 bg-amber-500/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_24px_-10px_rgba(245,158,11,0.6)]'
                    : 'surface-card hover:border-white/[0.14] hover:bg-[#1A1E27]',
                )}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span
                    className={cn(
                      'text-sm font-semibold tracking-tight transition-colors',
                      isSelected ? 'text-amber-300' : 'text-[#F4F5F7]',
                    )}
                  >
                    {preset.name}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border transition-all',
                      isSelected
                        ? 'border-amber-400 bg-amber-400 text-[#0A0B0E]'
                        : 'border-white/[0.10] bg-white/[0.02] text-transparent group-hover:border-white/[0.20]',
                    )}
                  >
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                  </span>
                </div>

                <span className="mt-1 text-[11px] leading-snug text-[#9CA3B0]">
                  {preset.tagline}
                </span>

                <div
                  className={cn(
                    'mt-3 inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums',
                    isSelected
                      ? 'border-amber-400/30 bg-amber-500/15 text-amber-200'
                      : 'border-white/[0.07] bg-[#0F1116] text-[#9CA3B0]',
                  )}
                >
                  <span>{preset.focus_duration}</span>
                  <span className="text-[#646C7A]">/</span>
                  <span>{preset.short_break}</span>
                  <span className="text-[#646C7A]">/</span>
                  <span>{preset.long_break}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Proportional Cycle Visualizer */}
      <div className="surface-card rounded-2xl p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-[#F4F5F7]">Cycle Cadence</h3>
            <p className="mt-0.5 text-xs text-[#646C7A]">
              Proportional 4-step Pomodoro loop preview
            </p>
          </div>
          <div className="font-mono text-xs tabular-nums text-[#9CA3B0]">
            <span className="font-semibold text-[#F4F5F7]">{cycleMetrics.totalMinutes} min</span>{' '}
            full cycle <span className="mx-1 text-white/20">·</span>
            <span className="font-semibold text-amber-400">{cycleMetrics.focusRatio}%</span> focus
            ratio
          </div>
        </div>

        {/* Proportional Segmented Track */}
        <div
          aria-label={`Pomodoro cycle: ${cycleMetrics.focus}m focus, ${cycleMetrics.shortBreak}m short break, ${cycleMetrics.focus}m focus, ${cycleMetrics.longBreak}m long break`}
          className="surface-well mt-4 flex h-9 w-full items-stretch gap-1 overflow-hidden rounded-xl p-1"
        >
          {cycleMetrics.segments.map((segment) => (
            <div
              key={segment.id}
              style={{ width: `${segment.pct}%` }}
              title={`${segment.label}: ${segment.minutes} min`}
              className={cn(
                'flex min-w-[20px] items-center justify-center overflow-hidden rounded-lg px-1.5 font-mono text-[11px] font-semibold whitespace-nowrap tabular-nums transition-[width] duration-200 ease-out',
                segment.barClass,
              )}
            >
              {segment.pct >= 14 ? (
                <span>
                  {segment.label} · {segment.minutes}m
                </span>
              ) : segment.pct >= 7 ? (
                <span>{segment.minutes}m</span>
              ) : null}
            </div>
          ))}
        </div>

        {/* Legend Strip */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[11px] tabular-nums text-[#9CA3B0]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span>Focus ×2</span>
            <span className="text-[#646C7A]">({cycleMetrics.focus * 2}m)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-teal-400" />
            <span>Short Break</span>
            <span className="text-[#646C7A]">({cycleMetrics.shortBreak}m)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            <span>Long Break</span>
            <span className="text-[#646C7A]">({cycleMetrics.longBreak}m)</span>
          </span>
        </div>
      </div>

      {/* 3 Side-by-Side Precision Control Cards */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {DURATION_CONTROLS.map((ctrl) => {
          const value = draft[ctrl.key];
          const styles = ACCENT_UI[ctrl.accentColor];
          const Icon = ctrl.Icon;
          const canDecrement = value > ctrl.min;
          const canIncrement = value < ctrl.max;

          const stepBy = (delta: number) => {
            const next = Math.min(ctrl.max, Math.max(ctrl.min, value + delta));
            if (next !== value) {
              void handleCommitChange(ctrl.key, next);
            }
          };

          return (
            <div
              key={ctrl.key}
              className="surface-card flex flex-col justify-between rounded-2xl p-4"
            >
              {/* Card Header */}
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border',
                    styles.iconContainer,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-semibold tracking-tight text-[#F4F5F7]">
                    {ctrl.title}
                  </h4>
                  <p className="truncate text-[11px] text-[#646C7A]">{ctrl.subtitle}</p>
                </div>
              </div>

              {/* Tactile Stepper + Tabular Readout */}
              <div className="surface-well mt-4 flex items-center justify-between gap-2 rounded-xl p-1.5">
                <button
                  type="button"
                  disabled={!canDecrement}
                  aria-label={`Decrease ${ctrl.title} by ${ctrl.step} minutes`}
                  onClick={() => stepBy(-ctrl.step)}
                  className={cn(
                    'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/[0.08] bg-[#161A22] text-[#9CA3B0] transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35',
                    styles.stepperHover,
                  )}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>

                <div className="flex items-baseline justify-center gap-1 select-none">
                  <span className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-[#F4F5F7]">
                    {value}
                  </span>
                  <span className={cn('font-mono text-xs font-medium', styles.valueTint)}>min</span>
                </div>

                <button
                  type="button"
                  disabled={!canIncrement}
                  aria-label={`Increase ${ctrl.title} by ${ctrl.step} minutes`}
                  onClick={() => stepBy(ctrl.step)}
                  className={cn(
                    'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/[0.08] bg-[#161A22] text-[#9CA3B0] transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35',
                    styles.stepperHover,
                  )}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Compact Crisp Slider + Min/Max Endpoints */}
              <div className="mt-3">
                <CustomSlider
                  value={value}
                  min={ctrl.min}
                  max={ctrl.max}
                  step={ctrl.step}
                  accentColor={ctrl.accentColor}
                  ariaLabel={`${ctrl.title} duration`}
                  valueLabelFormat={(v) => `${v}m`}
                  onChange={(val) => handleLiveChange(ctrl.key, val)}
                  onChangeCommitted={(val) => void handleCommitChange(ctrl.key, val)}
                  className="px-0.5 pt-2 pb-1.5"
                />
                <div className="flex items-center justify-between px-0.5 font-mono text-[10px] tabular-nums text-[#646C7A]">
                  <span>{ctrl.min}m</span>
                  <span>{ctrl.max}m</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {saveError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{saveError}</span>
        </div>
      )}
    </div>
  );
}
