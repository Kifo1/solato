import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemeId =
  | 'solar-obsidian'
  | 'nordic-daylight'
  | 'midnight-slate'
  | 'forest-matcha'
  | 'rosewood-dusk'
  | 'paper-minimal'
  | 'custom';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  tagline: string;
  mode: 'dark' | 'light';
  preview: {
    canvas: string;
    sidebar: string;
    surface: string;
    border: string;
    text: string;
    muted: string;
    accent: string;
    accentSoft: string;
  };
  svg: {
    logoBgTop: string;
    logoBgBottom: string;
    logoBorder: string;
    logoTrack: string;
    arcStart: string;
    arcMid: string;
    arcEnd: string;
    arcGlow: string;
    dialFaceTop: string;
    dialFaceBottom: string;
    dialBorder: string;
    dialTrack: string;
    tickQuarter: string;
    tickFive: string;
    tickMinute: string;
    ambientRgb: string;
  };
  charts: {
    peak: string;
    bar: string;
    zero: string;
    grid: string;
    axis: string;
    tick: string;
    heatmap: readonly [string, string, string, string, string];
  };
}

export const THEMES: readonly ThemeDefinition[] = [
  {
    id: 'solar-obsidian',
    name: 'Solar Obsidian',
    tagline: 'Warm carbon studio with luminous solar amber',
    mode: 'dark',
    preview: {
      canvas: '#0A0B0E',
      sidebar: '#0E1014',
      surface: '#14171D',
      border: 'rgba(255,255,255,0.09)',
      text: '#F4F5F7',
      muted: '#646C7A',
      accent: '#F59E0B',
      accentSoft: 'rgba(245,158,11,0.16)',
    },
    svg: {
      logoBgTop: '#202530',
      logoBgBottom: '#0C0E12',
      logoBorder: 'rgba(255,255,255,0.10)',
      logoTrack: 'rgba(255,255,255,0.15)',
      arcStart: '#FDE68A',
      arcMid: '#F59E0B',
      arcEnd: '#D97706',
      arcGlow: '#F59E0B',
      dialFaceTop: 'rgba(23,27,36,0.58)',
      dialFaceBottom: 'rgba(10,11,14,0.84)',
      dialBorder: 'rgba(255,255,255,0.05)',
      dialTrack: 'rgba(255,255,255,0.09)',
      tickQuarter: 'rgba(255,255,255,0.28)',
      tickFive: 'rgba(255,255,255,0.17)',
      tickMinute: 'rgba(255,255,255,0.075)',
      ambientRgb: '245, 158, 11',
    },
    charts: {
      peak: '#F59E0B',
      bar: '#383F4D',
      zero: '#20242E',
      grid: 'rgba(255,255,255,0.05)',
      axis: 'rgba(255,255,255,0.08)',
      tick: '#646C7A',
      heatmap: ['#1A1E26', '#4A3210', '#7C4D0E', '#B86D0B', '#F59E0B'],
    },
  },
  {
    id: 'nordic-daylight',
    name: 'Nordic Daylight',
    tagline: 'Warm alabaster paper and precision ochre accents',
    mode: 'light',
    preview: {
      canvas: '#F5F3EE',
      sidebar: '#EBE7DF',
      surface: '#FFFFFF',
      border: 'rgba(24,24,27,0.09)',
      text: '#18181B',
      muted: '#878075',
      accent: '#D97706',
      accentSoft: 'rgba(217,119,6,0.14)',
    },
    svg: {
      logoBgTop: '#FFFFFF',
      logoBgBottom: '#EDE8DF',
      logoBorder: 'rgba(24,24,27,0.12)',
      logoTrack: 'rgba(24,24,27,0.12)',
      arcStart: '#F59E0B',
      arcMid: '#D97706',
      arcEnd: '#B45309',
      arcGlow: '#D97706',
      dialFaceTop: 'rgba(255,255,255,0.96)',
      dialFaceBottom: 'rgba(244,240,232,0.94)',
      dialBorder: 'rgba(24,24,27,0.08)',
      dialTrack: 'rgba(24,24,27,0.10)',
      tickQuarter: 'rgba(24,24,27,0.34)',
      tickFive: 'rgba(24,24,27,0.20)',
      tickMinute: 'rgba(24,24,27,0.09)',
      ambientRgb: '217, 119, 6',
    },
    charts: {
      peak: '#D97706',
      bar: '#CFC9BE',
      zero: '#E7E3DA',
      grid: 'rgba(24,24,27,0.07)',
      axis: 'rgba(24,24,27,0.11)',
      tick: '#78716C',
      heatmap: ['#E8E4DB', '#FDE68A', '#FBBF24', '#D97706', '#92400E'],
    },
  },
  {
    id: 'midnight-slate',
    name: 'Midnight Slate',
    tagline: 'Deep marine dark workspace with glacier cyan',
    mode: 'dark',
    preview: {
      canvas: '#080C14',
      sidebar: '#0C121E',
      surface: '#111927',
      border: 'rgba(148,163,184,0.12)',
      text: '#F1F5F9',
      muted: '#64748B',
      accent: '#38BDF8',
      accentSoft: 'rgba(56,189,248,0.16)',
    },
    svg: {
      logoBgTop: '#182438',
      logoBgBottom: '#0A101B',
      logoBorder: 'rgba(148,163,184,0.16)',
      logoTrack: 'rgba(148,163,184,0.18)',
      arcStart: '#BAE6FD',
      arcMid: '#38BDF8',
      arcEnd: '#0284C7',
      arcGlow: '#38BDF8',
      dialFaceTop: 'rgba(20,30,48,0.62)',
      dialFaceBottom: 'rgba(8,12,20,0.86)',
      dialBorder: 'rgba(148,163,184,0.08)',
      dialTrack: 'rgba(148,163,184,0.12)',
      tickQuarter: 'rgba(226,232,240,0.30)',
      tickFive: 'rgba(226,232,240,0.18)',
      tickMinute: 'rgba(226,232,240,0.08)',
      ambientRgb: '56, 189, 248',
    },
    charts: {
      peak: '#38BDF8',
      bar: '#2B3B54',
      zero: '#172133',
      grid: 'rgba(148,163,184,0.07)',
      axis: 'rgba(148,163,184,0.12)',
      tick: '#64748B',
      heatmap: ['#162032', '#0E3A54', '#0B5E86', '#0EA5E9', '#38BDF8'],
    },
  },
  {
    id: 'forest-matcha',
    name: 'Forest Matcha',
    tagline: 'Calm dark pine surfaces with organic emerald',
    mode: 'dark',
    preview: {
      canvas: '#080D0A',
      sidebar: '#0C130F',
      surface: '#121C16',
      border: 'rgba(167,243,208,0.09)',
      text: '#EFF5F1',
      muted: '#62786B',
      accent: '#10B981',
      accentSoft: 'rgba(16,185,129,0.16)',
    },
    svg: {
      logoBgTop: '#192920',
      logoBgBottom: '#09100C',
      logoBorder: 'rgba(167,243,208,0.12)',
      logoTrack: 'rgba(167,243,208,0.16)',
      arcStart: '#A7F3D0',
      arcMid: '#10B981',
      arcEnd: '#059669',
      arcGlow: '#10B981',
      dialFaceTop: 'rgba(20,34,26,0.62)',
      dialFaceBottom: 'rgba(8,13,10,0.86)',
      dialBorder: 'rgba(167,243,208,0.07)',
      dialTrack: 'rgba(167,243,208,0.10)',
      tickQuarter: 'rgba(236,253,245,0.28)',
      tickFive: 'rgba(236,253,245,0.17)',
      tickMinute: 'rgba(236,253,245,0.075)',
      ambientRgb: '16, 185, 129',
    },
    charts: {
      peak: '#10B981',
      bar: '#2B4235',
      zero: '#17241C',
      grid: 'rgba(167,243,208,0.06)',
      axis: 'rgba(167,243,208,0.10)',
      tick: '#62786B',
      heatmap: ['#16231B', '#0F3D2B', '#0B6644', '#059669', '#34D399'],
    },
  },
  {
    id: 'rosewood-dusk',
    name: 'Rosewood Dusk',
    tagline: 'Warm espresso dark studio with coral rose glow',
    mode: 'dark',
    preview: {
      canvas: '#0E0A0C',
      sidebar: '#140E11',
      surface: '#1B1418',
      border: 'rgba(255,228,230,0.09)',
      text: '#F6F1F3',
      muted: '#7B6770',
      accent: '#FB7185',
      accentSoft: 'rgba(251,113,133,0.16)',
    },
    svg: {
      logoBgTop: '#2B1F25',
      logoBgBottom: '#110B0E',
      logoBorder: 'rgba(255,228,230,0.12)',
      logoTrack: 'rgba(255,228,230,0.16)',
      arcStart: '#FECDD3',
      arcMid: '#FB7185',
      arcEnd: '#E11D48',
      arcGlow: '#FB7185',
      dialFaceTop: 'rgba(34,24,29,0.62)',
      dialFaceBottom: 'rgba(14,10,12,0.86)',
      dialBorder: 'rgba(255,228,230,0.07)',
      dialTrack: 'rgba(255,228,230,0.10)',
      tickQuarter: 'rgba(255,241,242,0.28)',
      tickFive: 'rgba(255,241,242,0.17)',
      tickMinute: 'rgba(255,241,242,0.075)',
      ambientRgb: '251, 113, 133',
    },
    charts: {
      peak: '#FB7185',
      bar: '#46333C',
      zero: '#261B21',
      grid: 'rgba(255,228,230,0.06)',
      axis: 'rgba(255,228,230,0.10)',
      tick: '#7B6770',
      heatmap: ['#241A1F', '#55202E', '#8C2741', '#E11D48', '#FB7185'],
    },
  },
  {
    id: 'paper-minimal',
    name: 'Paper Minimal',
    tagline: 'Crisp gallery white with architectural cobalt',
    mode: 'light',
    preview: {
      canvas: '#F8FAFC',
      sidebar: '#F1F5F9',
      surface: '#FFFFFF',
      border: 'rgba(15,23,42,0.09)',
      text: '#0F172A',
      muted: '#64748B',
      accent: '#2563EB',
      accentSoft: 'rgba(37,99,235,0.12)',
    },
    svg: {
      logoBgTop: '#FFFFFF',
      logoBgBottom: '#EEF2F7',
      logoBorder: 'rgba(15,23,42,0.11)',
      logoTrack: 'rgba(15,23,42,0.12)',
      arcStart: '#60A5FA',
      arcMid: '#2563EB',
      arcEnd: '#1D4ED8',
      arcGlow: '#2563EB',
      dialFaceTop: 'rgba(255,255,255,0.98)',
      dialFaceBottom: 'rgba(241,245,249,0.95)',
      dialBorder: 'rgba(15,23,42,0.08)',
      dialTrack: 'rgba(15,23,42,0.10)',
      tickQuarter: 'rgba(15,23,42,0.34)',
      tickFive: 'rgba(15,23,42,0.20)',
      tickMinute: 'rgba(15,23,42,0.08)',
      ambientRgb: '37, 99, 235',
    },
    charts: {
      peak: '#2563EB',
      bar: '#CBD5E1',
      zero: '#E2E8F0',
      grid: 'rgba(15,23,42,0.06)',
      axis: 'rgba(15,23,42,0.10)',
      tick: '#64748B',
      heatmap: ['#E2E8F0', '#BFDBFE', '#60A5FA', '#2563EB', '#1E3A8A'],
    },
  },
];

export interface CustomThemeConfig {
  mode: 'dark' | 'light';
  accent: string; // hex e.g. '#F97316'
  canvas: string; // hex e.g. '#0B0B0F'
  surface: string | null; // null = auto-harmonized from canvas, or explicit hex
}

export const THEME_STORAGE_KEY = 'solato.theme';
export const CUSTOM_THEME_STORAGE_KEY = 'solato.customTheme';
export const DEFAULT_THEME_ID: ThemeId = 'solar-obsidian';

export const DEFAULT_CUSTOM_THEME: CustomThemeConfig = {
  mode: 'dark',
  accent: '#F97316',
  canvas: '#0B0B0F',
  surface: null,
};

const HEX_6_RE = /^#[0-9a-fA-F]{6}$/;
const HEX_3_RE = /^#[0-9a-fA-F]{3}$/;

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export function normalizeHex(input: string, fallback: string): string {
  const trimmed = input.trim();
  if (HEX_6_RE.test(trimmed)) return trimmed.toUpperCase();
  if (HEX_3_RE.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback;
}

export function hexToRgb(hex: string): RgbColor {
  const clean = normalizeHex(hex, '#000000').slice(1);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RgbColor): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function mixHex(hexA: string, hexB: string, weightB: number): string {
  const t = Math.max(0, Math.min(1, weightB));
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

function rgbaFromHex(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  const clamped = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${Number(clamped.toFixed(3))})`;
}

/** WCAG 2.1 relative luminance in [0, 1]. */
export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const linearize = (channel: number) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function getContrastRatio(hexA: string, hexB: string): number {
  const l1 = getRelativeLuminance(hexA);
  const l2 = getRelativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Automatically selects '#0A0B0E' or '#FFFFFF' for maximum WCAG contrast against bgHex. */
export function getReadableOnColor(bgHex: string): '#0A0B0E' | '#FFFFFF' {
  const darkInk = '#0A0B0E';
  const lightInk = '#FFFFFF';
  return getContrastRatio(bgHex, darkInk) >= getContrastRatio(bgHex, lightInk)
    ? darkInk
    : lightInk;
}

function sanitizeCustomConfig(raw: unknown): CustomThemeConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_CUSTOM_THEME;
  const obj = raw as Record<string, unknown>;
  const mode: 'dark' | 'light' = obj.mode === 'light' ? 'light' : 'dark';
  const defaultCanvas = mode === 'dark' ? DEFAULT_CUSTOM_THEME.canvas : '#F4F5F7';
  const accent =
    typeof obj.accent === 'string'
      ? normalizeHex(obj.accent, DEFAULT_CUSTOM_THEME.accent)
      : DEFAULT_CUSTOM_THEME.accent;
  const canvas =
    typeof obj.canvas === 'string'
      ? normalizeHex(obj.canvas, defaultCanvas)
      : defaultCanvas;
  const surface =
    typeof obj.surface === 'string' && (HEX_6_RE.test(obj.surface.trim()) || HEX_3_RE.test(obj.surface.trim()))
      ? normalizeHex(obj.surface, canvas)
      : null;

  return { mode, accent, canvas, surface };
}

function deriveCustomPalette(cfg: CustomThemeConfig) {
  const isDark = cfg.mode === 'dark';
  const canvas = normalizeHex(cfg.canvas, isDark ? DEFAULT_CUSTOM_THEME.canvas : '#F4F5F7');
  const accent = normalizeHex(cfg.accent, DEFAULT_CUSTOM_THEME.accent);
  const accentRgb = hexToRgb(accent);

  const autoSurface = isDark ? mixHex(canvas, '#FFFFFF', 0.062) : '#FFFFFF';
  const surface = cfg.surface ? normalizeHex(cfg.surface, autoSurface) : autoSurface;
  const sidebar = isDark ? mixHex(canvas, '#FFFFFF', 0.028) : mixHex(canvas, '#0F172A', 0.042);
  const elevated = isDark
    ? mixHex(surface, '#FFFFFF', 0.055)
    : cfg.surface
      ? mixHex(surface, '#FFFFFF', 0.35)
      : '#FFFFFF';
  const well = isDark
    ? getRelativeLuminance(canvas) > 0.025
      ? mixHex(canvas, '#000000', 0.22)
      : mixHex(canvas, '#FFFFFF', 0.03)
    : mixHex(canvas, '#0F172A', 0.045);

  const textPrimary = isDark ? mixHex('#F5F6F8', canvas, 0.03) : mixHex('#111318', canvas, 0.03);
  const textBright = isDark ? mixHex('#D4D8E0', canvas, 0.06) : mixHex('#232730', canvas, 0.04);
  const textSecondary = isDark ? mixHex('#9FA6B4', canvas, 0.1) : mixHex('#525866', canvas, 0.06);
  const textMuted = isDark ? mixHex('#68707F', canvas, 0.12) : mixHex('#7A818F', canvas, 0.08);
  const textOnAccent = getReadableOnColor(accent);

  const borderSubtle = isDark ? 'rgba(255, 255, 255, 0.065)' : 'rgba(15, 23, 42, 0.075)';
  const borderDefault = isDark ? 'rgba(255, 255, 255, 0.105)' : 'rgba(15, 23, 42, 0.12)';
  const borderStrong = isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(15, 23, 42, 0.2)';

  const overlaySubtle = isDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(15, 23, 42, 0.03)';
  const overlayDefault = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.055)';
  const overlayStrong = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.095)';

  return {
    isDark,
    canvas,
    sidebar,
    surface,
    elevated,
    well,
    accent,
    accentRgb,
    textPrimary,
    textBright,
    textSecondary,
    textMuted,
    textOnAccent,
    borderSubtle,
    borderDefault,
    borderStrong,
    overlaySubtle,
    overlayDefault,
    overlayStrong,
  };
}

export function buildCustomThemeDefinition(cfg: CustomThemeConfig): ThemeDefinition {
  const p = deriveCustomPalette(cfg);
  const { isDark, canvas, sidebar, surface, accent, accentRgb, textPrimary, textMuted, borderDefault } = p;

  const arcStart = mixHex(accent, '#FFFFFF', isDark ? 0.52 : 0.32);
  const arcMid = accent;
  const arcEnd = mixHex(accent, '#000000', 0.22);

  const heatmap: readonly [string, string, string, string, string] = isDark
    ? [
        mixHex(surface, '#FFFFFF', 0.03),
        mixHex(surface, accent, 0.28),
        mixHex(surface, accent, 0.52),
        mixHex(surface, accent, 0.76),
        accent,
      ]
    : [
        mixHex(canvas, '#0F172A', 0.07),
        mixHex(surface, accent, 0.26),
        mixHex(surface, accent, 0.56),
        accent,
        mixHex(accent, '#000000', 0.28),
      ];

  return {
    id: 'custom',
    name: 'Custom Studio',
    tagline: isDark
      ? 'Your personalized dark studio palette'
      : 'Your personalized light studio palette',
    mode: cfg.mode,
    preview: {
      canvas,
      sidebar,
      surface,
      border: borderDefault,
      text: textPrimary,
      muted: textMuted,
      accent,
      accentSoft: rgbaFromHex(accent, isDark ? 0.16 : 0.13),
    },
    svg: {
      logoBgTop: isDark ? mixHex(surface, '#FFFFFF', 0.09) : surface,
      logoBgBottom: isDark ? mixHex(canvas, '#000000', 0.1) : mixHex(canvas, '#0F172A', 0.04),
      logoBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)',
      logoTrack: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.12)',
      arcStart,
      arcMid,
      arcEnd,
      arcGlow: accent,
      dialFaceTop: isDark
        ? rgbaFromHex(mixHex(surface, '#FFFFFF', 0.04), 0.62)
        : rgbaFromHex(surface, 0.97),
      dialFaceBottom: isDark ? rgbaFromHex(canvas, 0.86) : rgbaFromHex(canvas, 0.95),
      dialBorder: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)',
      dialTrack: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.10)',
      tickQuarter: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(15,23,42,0.34)',
      tickFive: isDark ? 'rgba(255,255,255,0.17)' : 'rgba(15,23,42,0.20)',
      tickMinute: isDark ? 'rgba(255,255,255,0.075)' : 'rgba(15,23,42,0.085)',
      ambientRgb: `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`,
    },
    charts: {
      peak: accent,
      bar: isDark ? mixHex(surface, '#FFFFFF', 0.16) : mixHex(canvas, '#0F172A', 0.16),
      zero: isDark ? mixHex(surface, '#FFFFFF', 0.04) : mixHex(canvas, '#0F172A', 0.07),
      grid: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.065)',
      axis: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.105)',
      tick: textMuted,
      heatmap,
    },
  };
}

const CUSTOM_CSS_VAR_KEYS: readonly string[] = [
  '--bg-canvas',
  '--bg-sidebar',
  '--bg-surface',
  '--bg-elevated',
  '--bg-well',
  '--text-primary',
  '--text-bright',
  '--text-secondary',
  '--text-muted',
  '--text-on-accent',
  '--border-subtle',
  '--border-default',
  '--border-strong',
  '--overlay-subtle',
  '--overlay-default',
  '--overlay-strong',
  '--canvas-glow',
  '--card-bg',
  '--card-border',
  '--card-shadow',
  '--elevated-bg',
  '--elevated-border',
  '--elevated-shadow',
  '--well-shadow',
  '--accent-glow',
  '--scrollbar-thumb',
  '--scrollbar-thumb-hover',
  '--color-amber-200',
  '--color-amber-300',
  '--color-amber-400',
  '--color-amber-500',
  '--color-amber-600',
  '--color-teal-300',
  '--color-teal-400',
  '--color-sky-300',
  '--color-sky-400',
  '--color-rose-200',
  '--color-rose-300',
  '--color-rose-400',
];

export function buildCustomThemeCssVars(cfg: CustomThemeConfig): Record<string, string> {
  const p = deriveCustomPalette(cfg);
  const { isDark, canvas, sidebar, surface, elevated, well, accent } = p;

  const cardBg = isDark
    ? `linear-gradient(180deg, ${rgbaFromHex(mixHex(surface, '#FFFFFF', 0.035), 0.9)} 0%, ${rgbaFromHex(mixHex(surface, '#000000', 0.06), 0.97)} 100%)`
    : `linear-gradient(180deg, ${surface} 0%, ${mixHex(surface, canvas, 0.25)} 100%)`;

  const elevatedBg = isDark
    ? `linear-gradient(180deg, ${mixHex(elevated, '#FFFFFF', 0.025)} 0%, ${mixHex(elevated, '#000000', 0.12)} 100%)`
    : elevated;

  const accentLum = getRelativeLuminance(accent);
  const lightTextDeepen = accentLum > 0.42 ? 0.34 : 0.2;

  const amber200 = isDark
    ? mixHex(accent, '#FFFFFF', 0.62)
    : mixHex(accent, '#000000', lightTextDeepen + 0.06);
  const amber300 = isDark
    ? mixHex(accent, '#FFFFFF', 0.4)
    : mixHex(accent, '#000000', lightTextDeepen);
  const amber400 = isDark
    ? mixHex(accent, '#FFFFFF', 0.16)
    : mixHex(accent, '#000000', accentLum > 0.42 ? 0.22 : 0.08);
  const amber500 = accent;
  const amber600 = mixHex(accent, '#000000', 0.2);

  const vars: Record<string, string> = {
    '--bg-canvas': canvas,
    '--bg-sidebar': sidebar,
    '--bg-surface': surface,
    '--bg-elevated': elevated,
    '--bg-well': well,

    '--text-primary': p.textPrimary,
    '--text-bright': p.textBright,
    '--text-secondary': p.textSecondary,
    '--text-muted': p.textMuted,
    '--text-on-accent': p.textOnAccent,

    '--border-subtle': p.borderSubtle,
    '--border-default': p.borderDefault,
    '--border-strong': p.borderStrong,

    '--overlay-subtle': p.overlaySubtle,
    '--overlay-default': p.overlayDefault,
    '--overlay-strong': p.overlayStrong,

    '--canvas-glow': rgbaFromHex(accent, isDark ? 0.06 : 0.06),
    '--card-bg': cardBg,
    '--card-border': isDark ? 'rgba(255, 255, 255, 0.075)' : 'rgba(15, 23, 42, 0.085)',
    '--card-shadow': isDark
      ? 'inset 0 1px 0 rgba(255, 255, 255, 0.045), 0 12px 32px -16px rgba(0, 0, 0, 0.7)'
      : 'inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 8px 24px -14px rgba(15, 23, 42, 0.13)',

    '--elevated-bg': elevatedBg,
    '--elevated-border': isDark ? 'rgba(255, 255, 255, 0.11)' : 'rgba(15, 23, 42, 0.12)',
    '--elevated-shadow': isDark
      ? 'inset 0 1px 0 rgba(255, 255, 255, 0.065), 0 24px 60px -16px rgba(0, 0, 0, 0.8)'
      : '0 22px 50px -16px rgba(15, 23, 42, 0.2), 0 4px 12px -4px rgba(15, 23, 42, 0.07)',

    '--well-shadow': isDark
      ? 'inset 0 1px 2px rgba(0, 0, 0, 0.38)'
      : 'inset 0 1px 2px rgba(15, 23, 42, 0.055)',
    '--accent-glow': rgbaFromHex(accent, isDark ? 0.55 : 0.38),
    '--scrollbar-thumb': isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(15, 23, 42, 0.16)',
    '--scrollbar-thumb-hover': isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(15, 23, 42, 0.28)',

    '--color-amber-200': amber200,
    '--color-amber-300': amber300,
    '--color-amber-400': amber400,
    '--color-amber-500': amber500,
    '--color-amber-600': amber600,
  };

  if (!isDark) {
    vars['--color-teal-300'] = '#0f766e';
    vars['--color-teal-400'] = '#0d9488';
    vars['--color-sky-300'] = '#0369a1';
    vars['--color-sky-400'] = '#0284c7';
    vars['--color-rose-200'] = '#9f1239';
    vars['--color-rose-300'] = '#be123c';
    vars['--color-rose-400'] = '#e11d48';
  }

  return vars;
}

const BUILTIN_THEME_MAP = new Map<ThemeId, ThemeDefinition>(THEMES.map((t) => [t.id, t]));

export function isValidThemeId(value: string | null): value is ThemeId {
  return value === 'custom' || (value !== null && BUILTIN_THEME_MAP.has(value as ThemeId));
}

function readInitialTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isValidThemeId(stored)) return stored;
  } catch {
    // Ignore storage access errors
  }
  return DEFAULT_THEME_ID;
}

function readInitialCustomConfig(): CustomThemeConfig {
  try {
    const raw = localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_CUSTOM_THEME;
    return sanitizeCustomConfig(JSON.parse(raw));
  } catch {
    return DEFAULT_CUSTOM_THEME;
  }
}

function applyThemeToDocument(def: ThemeDefinition, customConfig?: CustomThemeConfig) {
  const root = document.documentElement;
  root.dataset.theme = def.id;
  root.dataset.mode = def.mode;
  root.classList.toggle('dark', def.mode === 'dark');
  root.classList.toggle('light', def.mode === 'light');

  // Clear any pre-boot inline background-color so CSS variable --bg-canvas drives the canvas cleanly
  root.style.removeProperty('background-color');

  if (def.id === 'custom' && customConfig) {
    const vars = buildCustomThemeCssVars(customConfig);
    for (const key of CUSTOM_CSS_VAR_KEYS) {
      const val = vars[key];
      if (val !== undefined) {
        root.style.setProperty(key, val);
      } else {
        root.style.removeProperty(key);
      }
    }
  } else {
    for (const key of CUSTOM_CSS_VAR_KEYS) {
      root.style.removeProperty(key);
    }
  }
}

interface ThemeContextValue {
  themeId: ThemeId;
  theme: ThemeDefinition;
  themes: readonly ThemeDefinition[];
  setTheme: (id: ThemeId) => void;
  customConfig: CustomThemeConfig;
  updateCustomConfig: (partial: Partial<CustomThemeConfig>) => void;
  resetCustomConfig: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [themeId, setThemeId] = useState<ThemeId>(readInitialTheme);
  const [customConfig, setCustomConfig] = useState<CustomThemeConfig>(readInitialCustomConfig);

  const customThemeDef = useMemo(() => buildCustomThemeDefinition(customConfig), [customConfig]);
  const themes = useMemo<readonly ThemeDefinition[]>(
    () => [...THEMES, customThemeDef],
    [customThemeDef],
  );

  const theme =
    themeId === 'custom' ? customThemeDef : (BUILTIN_THEME_MAP.get(themeId) ?? THEMES[0]);

  useEffect(() => {
    applyThemeToDocument(theme, theme.id === 'custom' ? customConfig : undefined);
  }, [theme, customConfig]);

  const setTheme = useCallback((nextId: ThemeId) => {
    if (!isValidThemeId(nextId)) return;
    setThemeId(nextId);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextId);
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const updateCustomConfig = useCallback((partial: Partial<CustomThemeConfig>) => {
    setCustomConfig((prev) => {
      const nextMode =
        partial.mode === 'light' || partial.mode === 'dark' ? partial.mode : prev.mode;
      const nextAccent =
        typeof partial.accent === 'string'
          ? normalizeHex(partial.accent, prev.accent)
          : prev.accent;
      const nextCanvas =
        typeof partial.canvas === 'string'
          ? normalizeHex(partial.canvas, prev.canvas)
          : prev.canvas;
      let nextSurface = prev.surface;
      if (partial.surface === null) {
        nextSurface = null;
      } else if (typeof partial.surface === 'string') {
        nextSurface = normalizeHex(partial.surface, prev.surface ?? nextCanvas);
      }

      const next: CustomThemeConfig = {
        mode: nextMode,
        accent: nextAccent,
        canvas: nextCanvas,
        surface: nextSurface,
      };

      try {
        localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage access errors
      }
      return next;
    });

    setThemeId((prevId) => {
      if (prevId !== 'custom') {
        try {
          localStorage.setItem(THEME_STORAGE_KEY, 'custom');
        } catch {
          // Ignore storage access errors
        }
      }
      return 'custom';
    });
  }, []);

  const resetCustomConfig = useCallback(() => {
    setCustomConfig(DEFAULT_CUSTOM_THEME);
    try {
      localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(DEFAULT_CUSTOM_THEME));
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId,
      theme,
      themes,
      setTheme,
      customConfig,
      updateCustomConfig,
      resetCustomConfig,
    }),
    [themeId, theme, themes, setTheme, customConfig, updateCustomConfig, resetCustomConfig],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
