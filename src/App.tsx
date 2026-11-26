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

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="studio-canvas flex h-screen w-screen overflow-hidden text-[#F4F5F7]">
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
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell />
        <SleepRecoveryModal />
      </BrowserRouter>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

export default App;
