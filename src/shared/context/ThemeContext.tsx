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
  | 'paper-minimal';

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

export const THEME_STORAGE_KEY = 'solato.theme';
export const DEFAULT_THEME_ID: ThemeId = 'solar-obsidian';

const THEME_MAP = new Map<ThemeId, ThemeDefinition>(THEMES.map((t) => [t.id, t]));

export function isValidThemeId(value: string | null): value is ThemeId {
  return value !== null && THEME_MAP.has(value as ThemeId);
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

function applyThemeToDocument(def: ThemeDefinition) {
  const root = document.documentElement;
  root.dataset.theme = def.id;
  root.dataset.mode = def.mode;
  root.classList.toggle('dark', def.mode === 'dark');
  root.classList.toggle('light', def.mode === 'light');
}

interface ThemeContextValue {
  themeId: ThemeId;
  theme: ThemeDefinition;
  themes: readonly ThemeDefinition[];
  setTheme: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [themeId, setThemeId] = useState<ThemeId>(readInitialTheme);

  const theme = THEME_MAP.get(themeId) ?? THEMES[0];

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const setTheme = useCallback((nextId: ThemeId) => {
    if (!THEME_MAP.has(nextId)) return;
    setThemeId(nextId);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextId);
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId,
      theme,
      themes: THEMES,
      setTheme,
    }),
    [themeId, theme, setTheme],
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
