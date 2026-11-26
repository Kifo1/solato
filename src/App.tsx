import { useEffect, useRef } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Sidebar from './shared/components/layout/Sidebar';
import TimerPage from '@features/timer/TimerPage.tsx';
import ProjectsPage from '@features/projects/ProjectsPage.tsx';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import AnalyticsPage from '@features/analytics/AnalyticsPage.tsx';
import SettingsPage from '@features/settings/SettingsPage.tsx';
import SleepRecoveryModal from '@features/timer/components/SleepRecoveryModal.tsx';
import { LayoutProvider, useLayout } from '@shared/context/LayoutContext';
import { ToastProvider } from '@shared/context/ToastContext';
import { ThemeProvider } from '@shared/context/ThemeContext';
import { CommandPalette } from '@shared/components/CommandPalette';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppShell() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const { setZenMode } = useLayout();

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    // Automatically exit Zen Mode if user navigates away from Timer
    if (location.pathname !== '/timer') {
      setZenMode(false);
    }
  }, [location.pathname, setZenMode]);

  return (
    <div className="studio-canvas text-fg flex h-screen w-screen overflow-hidden transition-colors duration-200">
      <Sidebar />
      <main ref={mainRef} className="relative flex-1 overflow-x-hidden overflow-y-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/timer" replace />} />
          <Route path="/timer" element={<TimerPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <CommandPalette />
      <SleepRecoveryModal />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <LayoutProvider>
            <BrowserRouter>
              <AppShell />
            </BrowserRouter>
          </LayoutProvider>
        </ToastProvider>
      </ThemeProvider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

export default App;
