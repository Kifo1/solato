import { Check, Moon, Sun } from 'lucide-react';
import { SolatoLogo } from '@shared/components/SolatoLogo';
import { useTheme, type ThemeDefinition } from '@shared/context/ThemeContext';
import { useToast } from '@shared/context/ToastContext';
import { cn } from '@shared/lib/utils';

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
        {/* Miniature Dual-Arc Timer Ring */}
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
              d="M 33.8 7.08 A 25 25 0 0 1 56.92 30.2"
              fill="none"
              stroke={svg.arcMid}
              strokeWidth="3.6"
              strokeLinecap="round"
            />
            <path
              d="M 30.2 56.92 A 25 25 0 0 1 7.08 33.8"
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
  const { themeId, theme, themes, setTheme } = useTheme();
  const toast = useToast();

  const handleSelect = (def: ThemeDefinition) => {
    if (def.id === themeId) return;
    setTheme(def.id);
    toast.success(`Theme switched to ${def.name}`, def.tagline);
  };

  const darkThemes = themes.filter((t) => t.mode === 'dark');
  const lightThemes = themes.filter((t) => t.mode === 'light');

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
    </div>
  );
}
