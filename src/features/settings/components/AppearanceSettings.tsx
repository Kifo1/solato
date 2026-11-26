import {
  Check,
  Moon,
  Pipette,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Sun,
} from 'lucide-react';
import { SolatoLogo } from '@shared/components/SolatoLogo';
import {
  DEFAULT_CUSTOM_THEME,
  getReadableOnColor,
  getRelativeLuminance,
  useTheme,
  type ThemeDefinition,
} from '@shared/context/ThemeContext';
import { useToast } from '@shared/context/ToastContext';
import { cn } from '@shared/lib/utils';

interface ColorSwatch {
  name: string;
  hex: string;
}

const ACCENT_SWATCHES: readonly ColorSwatch[] = [
  { name: 'Sunset Orange', hex: '#F97316' },
  { name: 'Solar Amber', hex: '#F59E0B' },
  { name: 'Electric Lime', hex: '#84CC16' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Crisp Teal', hex: '#14B8A6' },
  { name: 'Sky Cyan', hex: '#0EA5E9' },
  { name: 'Cobalt Blue', hex: '#3B82F6' },
  { name: 'Royal Indigo', hex: '#6366F1' },
  { name: 'Orchid Violet', hex: '#A855F7' },
  { name: 'Crimson Rose', hex: '#F43F5E' },
];

const DARK_CANVAS_SWATCHES: readonly ColorSwatch[] = [
  { name: 'Carbon', hex: '#0B0B0F' },
  { name: 'Obsidian', hex: '#09090B' },
  { name: 'Deep Navy', hex: '#080D18' },
  { name: 'Pine Dark', hex: '#080F0C' },
  { name: 'Espresso', hex: '#100B0D' },
  { name: 'Graphite', hex: '#12141A' },
];

const LIGHT_CANVAS_SWATCHES: readonly ColorSwatch[] = [
  { name: 'Studio Gray', hex: '#F4F5F7' },
  { name: 'Warm Alabaster', hex: '#F6F3EC' },
  { name: 'Snow White', hex: '#FAFAFA' },
  { name: 'Soft Sage', hex: '#EFF5F1' },
  { name: 'Mist Blue', hex: '#EEF3F8' },
  { name: 'Blush Paper', hex: '#F8F1F3' },
];

function ThemeMiniPreview({ def }: Readonly<{ def: ThemeDefinition }>) {
  const { preview, svg } = def;

  return (
    <div
      className="relative flex h-28 w-full overflow-hidden rounded-xl border transition-transform duration-200 group-hover:scale-[1.01]"
      style={{
        backgroundColor: preview.canvas,
        borderColor: preview.border,
      }}
    >
      {/* Miniature Sidebar Rail */}
      <div
        className="flex w-11 shrink-0 flex-col items-center justify-between border-r py-2.5"
        style={{
          backgroundColor: preview.sidebar,
          borderColor: preview.border,
        }}
      >
        <SolatoLogo size={20} themeOverride={def} showFrame />
        <div className="flex flex-col items-center gap-1.5">
          <span
            className="h-2.5 w-5 rounded-full"
            style={{ backgroundColor: preview.accentSoft, border: `1px solid ${preview.accent}55` }}
          />
          <span className="h-1.5 w-4 rounded-full" style={{ backgroundColor: preview.muted, opacity: 0.45 }} />
          <span className="h-1.5 w-4 rounded-full" style={{ backgroundColor: preview.muted, opacity: 0.35 }} />
        </div>
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: preview.muted, opacity: 0.45 }} />
      </div>

      {/* Miniature Main Studio Canvas */}
      <div className="relative flex flex-1 items-center justify-between gap-3 px-3.5 py-2.5">
        {/* Miniature Dual-Arc Timer Ring (Top-Left & Bottom-Right resting orientation) */}
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
          <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
            <circle
              cx="32"
              cy="32"
              r="25"
              fill={svg.dialFaceTop}
              stroke={svg.dialTrack}
              strokeWidth="3"
            />
            <path
              d="M 7.08 30.2 A 25 25 0 0 1 30.2 7.08"
              fill="none"
              stroke={svg.arcMid}
              strokeWidth="3.6"
              strokeLinecap="round"
            />
            <path
              d="M 56.92 33.8 A 25 25 0 0 1 33.8 56.92"
              fill="none"
              stroke={svg.arcEnd}
              strokeWidth="3.6"
              strokeLinecap="round"
            />
          </svg>
          <span
            className="absolute font-mono text-[9px] font-semibold tabular-nums"
            style={{ color: preview.text }}
          >
            25:00
          </span>
        </div>

        {/* Miniature Surface Card + Accent Button */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div
            className="rounded-lg border p-2"
            style={{
              backgroundColor: preview.surface,
              borderColor: preview.border,
            }}
          >
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: preview.accent }} />
              <span
                className="h-1.5 w-12 rounded-full"
                style={{ backgroundColor: preview.text, opacity: 0.78 }}
              />
            </div>
            <div className="mt-1.5 flex gap-1">
              {def.charts.heatmap.map((hex, i) => (
                <span
                  key={i}
                  className="h-2 w-2 rounded-[2px]"
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className="h-4 w-12 rounded-full"
              style={{ backgroundColor: preview.accent }}
            />
            <span
              className="h-4 w-7 rounded-full border"
              style={{ backgroundColor: preview.surface, borderColor: preview.border }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppearanceSettings() {
  const {
    themeId,
    theme,
    themes,
    setTheme,
    customConfig,
    updateCustomConfig,
    resetCustomConfig,
  } = useTheme();
  const toast = useToast();

  const handleSelect = (def: ThemeDefinition) => {
    if (def.id === themeId) return;
    setTheme(def.id);
    toast.success(`Theme switched to ${def.name}`, def.tagline);
  };

  const darkThemes = themes.filter((t) => t.id !== 'custom' && t.mode === 'dark');
  const lightThemes = themes.filter((t) => t.id !== 'custom' && t.mode === 'light');
  const customThemeDef = themes.find((t) => t.id === 'custom') ?? theme;
  const isCustomSelected = themeId === 'custom';

  const canvasSwatches =
    customConfig.mode === 'dark' ? DARK_CANVAS_SWATCHES : LIGHT_CANVAS_SWATCHES;

  const isDefaultCustom =
    customConfig.mode === DEFAULT_CUSTOM_THEME.mode &&
    customConfig.accent.toUpperCase() === DEFAULT_CUSTOM_THEME.accent.toUpperCase() &&
    customConfig.canvas.toUpperCase() === DEFAULT_CUSTOM_THEME.canvas.toUpperCase() &&
    customConfig.surface === DEFAULT_CUSTOM_THEME.surface;

  const handleModeChange = (nextMode: 'dark' | 'light') => {
    if (customConfig.mode === nextMode && isCustomSelected) return;
    const defaultCanvasForMode = nextMode === 'dark' ? '#0B0B0F' : '#F4F5F7';
    const currentLum = getRelativeLuminance(customConfig.canvas);
    const canvasMatchesMode = nextMode === 'dark' ? currentLum < 0.3 : currentLum > 0.5;
    updateCustomConfig({
      mode: nextMode,
      canvas: canvasMatchesMode ? customConfig.canvas : defaultCanvasForMode,
      surface: null,
    });
  };

  const handleResetCustom = () => {
    resetCustomConfig();
    toast.success('Custom Studio reset', 'Restored default custom palette');
  };

  const renderGroup = (title: string, items: ThemeDefinition[], icon: 'dark' | 'light') => (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          {icon === 'dark' ? (
            <Moon className="h-3.5 w-3.5 text-fg-muted" />
          ) : (
            <Sun className="h-3.5 w-3.5 text-amber-400" />
          )}
          <span className="text-[11px] font-semibold tracking-[0.08em] text-fg-muted uppercase">
            {title}
          </span>
        </div>
        <span className="font-mono text-[11px] text-fg-muted">{items.length} themes</span>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {items.map((def) => {
          const isSelected = def.id === themeId;
          return (
            <button
              key={def.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => handleSelect(def)}
              className={cn(
                'surface-card group flex cursor-pointer flex-col gap-3 rounded-2xl p-3.5 text-left transition-all duration-150 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none',
                isSelected
                  ? 'border-amber-500/45 bg-amber-500/[0.06] ring-1 ring-amber-500/25'
                  : 'hover:border-line-strong hover:bg-tint-subtle',
              )}
            >
              <ThemeMiniPreview def={def} />

              <div className="flex items-start justify-between gap-2 px-0.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tracking-tight text-fg">{def.name}</span>
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-line"
                      style={{ backgroundColor: def.preview.accent }}
                    />
                  </div>
                  <p className="mt-0.5 text-xs leading-snug text-fg-secondary">{def.tagline}</p>
                </div>

                <span
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all',
                    isSelected
                      ? 'border-amber-400 bg-amber-500 text-on-accent'
                      : 'border-line bg-well text-transparent group-hover:border-line-strong',
                  )}
                >
                  <Check className="h-3 w-3 stroke-[2.75]" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const effectiveSurfaceHex = customConfig.surface ?? customThemeDef.preview.surface;
  const accentPickerInk = getReadableOnColor(customConfig.accent);
  const canvasPickerInk = getReadableOnColor(customConfig.canvas);
  const surfacePickerInk = getReadableOnColor(effectiveSurfaceHex);

  return (
    <div className="space-y-6">
      {/* Active Theme Summary Pill */}
      <div className="surface-card flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3.5">
        <div className="flex items-center gap-3">
          <SolatoLogo size={32} isActive />
          <div>
            <p className="text-xs font-medium text-fg-muted">Active Studio Theme</p>
            <p className="text-sm font-semibold text-fg">{theme.name}</p>
          </div>
        </div>
        <span className="surface-well inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] text-fg-secondary">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: theme.preview.accent }}
          />
          {theme.mode === 'dark' ? 'Dark Studio' : 'Light Studio'} · Switch anytime via ⌘K
        </span>
      </div>

      {renderGroup('Dark Studio Themes', darkThemes, 'dark')}
      {renderGroup('Light Studio Themes', lightThemes, 'light')}

      {/* Custom Studio Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold tracking-[0.08em] text-fg-muted uppercase">
              Custom Studio
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetCustom}
            disabled={isDefaultCustom}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border border-line bg-well px-2.5 py-1 text-[11px] font-medium text-fg-secondary transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none',
              isDefaultCustom
                ? 'cursor-not-allowed opacity-45'
                : 'cursor-pointer hover:border-line-strong hover:text-fg',
            )}
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>

        <div className="surface-card overflow-hidden rounded-2xl">
          {/* Selectable Custom Studio Card Header */}
          <button
            type="button"
            aria-pressed={isCustomSelected}
            onClick={() => handleSelect(customThemeDef)}
            className={cn(
              'group flex w-full cursor-pointer flex-col gap-3 border-b border-line-subtle p-4 text-left transition-all duration-150 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none focus-visible:ring-inset',
              isCustomSelected
                ? 'bg-amber-500/[0.06]'
                : 'hover:bg-tint-subtle',
            )}
          >
            <ThemeMiniPreview def={customThemeDef} />

            <div className="flex items-start justify-between gap-3 px-0.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold tracking-tight text-fg">
                    {customThemeDef.name}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-400 uppercase">
                    Custom
                  </span>
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-line"
                    style={{ backgroundColor: customThemeDef.preview.accent }}
                  />
                </div>
                <p className="mt-0.5 text-xs leading-snug text-fg-secondary">
                  {customThemeDef.tagline} — tweak any color below to apply live.
                </p>
              </div>

              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all',
                  isCustomSelected
                    ? 'border-amber-400 bg-amber-500 text-on-accent'
                    : 'border-line bg-well text-transparent group-hover:border-line-strong',
                )}
              >
                <Check className="h-3 w-3 stroke-[2.75]" />
              </span>
            </div>
          </button>

          {/* Live Customizer Controls */}
          <div className="space-y-5 p-4 sm:p-5">
            {/* Base Mode */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-fg">Base Mode</p>
                <p className="text-[11px] text-fg-muted">
                  Balances ink contrast, borders, and depth automatically
                </p>
              </div>
              <div className="surface-well inline-flex rounded-xl p-1">
                <button
                  type="button"
                  aria-pressed={customConfig.mode === 'dark'}
                  onClick={() => handleModeChange('dark')}
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none',
                    customConfig.mode === 'dark'
                      ? 'bg-amber-500 text-on-accent shadow-sm'
                      : 'text-fg-secondary hover:text-fg',
                  )}
                >
                  <Moon className="h-3.5 w-3.5" />
                  Dark
                </button>
                <button
                  type="button"
                  aria-pressed={customConfig.mode === 'light'}
                  onClick={() => handleModeChange('light')}
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none',
                    customConfig.mode === 'light'
                      ? 'bg-amber-500 text-on-accent shadow-sm'
                      : 'text-fg-secondary hover:text-fg',
                  )}
                >
                  <Sun className="h-3.5 w-3.5" />
                  Light
                </button>
              </div>
            </div>

            <div className="h-px bg-line-subtle" />

            {/* Accent Color */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-fg">Accent Color</p>
                  <p className="text-[11px] text-fg-muted">
                    Timer arcs, primary actions, highlights & analytics peak
                  </p>
                </div>
                <span className="surface-well inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-[11px] text-fg-secondary">
                  <span
                    className="h-2.5 w-2.5 rounded-full ring-1 ring-line"
                    style={{ backgroundColor: customConfig.accent }}
                  />
                  {customConfig.accent.toUpperCase()}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {ACCENT_SWATCHES.map((swatch) => {
                  const active = customConfig.accent.toUpperCase() === swatch.hex.toUpperCase();
                  const ink = getReadableOnColor(swatch.hex);
                  return (
                    <button
                      key={swatch.hex}
                      type="button"
                      title={`${swatch.name} (${swatch.hex})`}
                      aria-label={`Select accent color ${swatch.name}`}
                      aria-pressed={active}
                      onClick={() => updateCustomConfig({ accent: swatch.hex })}
                      className={cn(
                        'relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border transition-transform duration-150 hover:scale-105 focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:outline-none',
                        active
                          ? 'scale-105 border-fg ring-2 ring-amber-400/45'
                          : 'border-line hover:border-line-strong',
                      )}
                      style={{ backgroundColor: swatch.hex }}
                    >
                      {active && <Check className="h-3.5 w-3.5 stroke-[2.75]" style={{ color: ink }} />}
                    </button>
                  );
                })}

                <label
                  title="Pick any custom accent color"
                  className="relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-well px-2.5 text-[11px] font-medium text-fg-secondary transition-colors hover:border-line-strong hover:text-fg focus-within:ring-2 focus-within:ring-amber-400/60"
                >
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-full ring-1 ring-line"
                    style={{ backgroundColor: customConfig.accent }}
                  >
                    <Pipette className="h-2.5 w-2.5" style={{ color: accentPickerInk }} />
                  </span>
                  <span>Pick</span>
                  <input
                    type="color"
                    aria-label="Custom accent color picker"
                    value={customConfig.accent}
                    onChange={(e) => updateCustomConfig({ accent: e.target.value })}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
              </div>
            </div>

            <div className="h-px bg-line-subtle" />

            {/* Canvas Background */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-fg">Canvas Background</p>
                  <p className="text-[11px] text-fg-muted">
                    Studio backdrop — sidebar & recessed wells derive smoothly
                  </p>
                </div>
                <span className="surface-well inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-[11px] text-fg-secondary">
                  <span
                    className="h-2.5 w-2.5 rounded-full ring-1 ring-line"
                    style={{ backgroundColor: customConfig.canvas }}
                  />
                  {customConfig.canvas.toUpperCase()}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canvasSwatches.map((swatch) => {
                  const active = customConfig.canvas.toUpperCase() === swatch.hex.toUpperCase();
                  const ink = getReadableOnColor(swatch.hex);
                  return (
                    <button
                      key={swatch.hex}
                      type="button"
                      title={`${swatch.name} (${swatch.hex})`}
                      aria-label={`Select canvas background ${swatch.name}`}
                      aria-pressed={active}
                      onClick={() => updateCustomConfig({ canvas: swatch.hex })}
                      className={cn(
                        'relative flex h-8 w-10 cursor-pointer items-center justify-center rounded-xl border transition-transform duration-150 hover:scale-105 focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:outline-none',
                        active
                          ? 'border-amber-400 ring-2 ring-amber-400/35'
                          : 'border-line hover:border-line-strong',
                      )}
                      style={{ backgroundColor: swatch.hex }}
                    >
                      {active && <Check className="h-3.5 w-3.5 stroke-[2.75]" style={{ color: ink }} />}
                    </button>
                  );
                })}

                <label
                  title="Pick any custom canvas background color"
                  className="relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-well px-2.5 text-[11px] font-medium text-fg-secondary transition-colors hover:border-line-strong hover:text-fg focus-within:ring-2 focus-within:ring-amber-400/60"
                >
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-md ring-1 ring-line"
                    style={{ backgroundColor: customConfig.canvas }}
                  >
                    <Pipette className="h-2.5 w-2.5" style={{ color: canvasPickerInk }} />
                  </span>
                  <span>Pick</span>
                  <input
                    type="color"
                    aria-label="Custom canvas background picker"
                    value={customConfig.canvas}
                    onChange={(e) => updateCustomConfig({ canvas: e.target.value })}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
              </div>
            </div>

            <div className="h-px bg-line-subtle" />

            {/* Card Surface */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-fg">Card Surface</p>
                <p className="text-[11px] text-fg-muted">
                  Auto-harmonize with canvas or choose an explicit card tone
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="surface-well inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-[11px] text-fg-secondary">
                  <span
                    className="h-2.5 w-2.5 rounded-full ring-1 ring-line"
                    style={{ backgroundColor: effectiveSurfaceHex }}
                  />
                  {effectiveSurfaceHex.toUpperCase()}
                  {customConfig.surface === null && (
                    <span className="text-fg-muted">· Auto</span>
                  )}
                </span>

                <button
                  type="button"
                  aria-pressed={customConfig.surface === null}
                  onClick={() => updateCustomConfig({ surface: null })}
                  className={cn(
                    'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none',
                    customConfig.surface === null
                      ? 'border-amber-500/45 bg-amber-500/15 text-amber-400'
                      : 'border-line bg-well text-fg-secondary hover:border-line-strong hover:text-fg',
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Auto
                </button>

                <label
                  title="Pick a custom card surface color"
                  className={cn(
                    'relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-all focus-within:ring-2 focus-within:ring-amber-400/60',
                    customConfig.surface !== null
                      ? 'border-amber-500/45 bg-amber-500/15 text-amber-400'
                      : 'border-line bg-well text-fg-secondary hover:border-line-strong hover:text-fg',
                  )}
                >
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-md ring-1 ring-line"
                    style={{ backgroundColor: effectiveSurfaceHex }}
                  >
                    <Pipette className="h-2.5 w-2.5" style={{ color: surfacePickerInk }} />
                  </span>
                  <span>Custom</span>
                  <input
                    type="color"
                    aria-label="Custom card surface color picker"
                    value={effectiveSurfaceHex}
                    onChange={(e) => updateCustomConfig({ surface: e.target.value })}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
