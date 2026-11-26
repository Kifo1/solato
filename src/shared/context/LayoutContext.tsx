import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const SIDEBAR_STORAGE_KEY = 'solato.sidebarCollapsed';

interface LayoutContextValue {
  isSidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  isZenMode: boolean;
  setZenMode: (zen: boolean) => void;
  toggleZenMode: () => void;
  isCommandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

function readInitialSidebarState(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function LayoutProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [isSidebarCollapsed, setIsSidebarCollapsedState] = useState<boolean>(readInitialSidebarState);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setIsSidebarCollapsedState(collapsed);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
    } catch {
      // Ignore storage errors in restricted environments
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const setZenMode = useCallback((zen: boolean) => {
    setIsZenMode(zen);
  }, []);

  const toggleZenMode = useCallback(() => {
    setIsZenMode((prev) => !prev);
  }, []);

  const openCommandPalette = useCallback(() => setIsCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(() => setIsCommandPaletteOpen(false), []);
  const toggleCommandPalette = useCallback(() => setIsCommandPaletteOpen((prev) => !prev), []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;

      // Cmd/Ctrl + K -> Command Palette
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Cmd/Ctrl + B -> Collapse / expand sidebar
      if (mod && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        if (isZenMode) {
          setIsZenMode(false);
        } else {
          toggleSidebar();
        }
        return;
      }

      // Escape exits Zen Mode when no dialog/command palette is open
      if (
        event.key === 'Escape' &&
        isZenMode &&
        !isCommandPaletteOpen &&
        !document.querySelector('[role="dialog"]')
      ) {
        event.preventDefault();
        setIsZenMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZenMode, isCommandPaletteOpen, toggleSidebar]);

  const value = useMemo<LayoutContextValue>(
    () => ({
      isSidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebar,
      isZenMode,
      setZenMode,
      toggleZenMode,
      isCommandPaletteOpen,
      openCommandPalette,
      closeCommandPalette,
      toggleCommandPalette,
    }),
    [
      isSidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebar,
      isZenMode,
      setZenMode,
      toggleZenMode,
      isCommandPaletteOpen,
      openCommandPalette,
      closeCommandPalette,
      toggleCommandPalette,
    ],
  );

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayout(): LayoutContextValue {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return ctx;
}
