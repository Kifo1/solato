import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Sidebar from './shared/components/layout/Sidebar';
import TimerPage from './shared/components/layout/TimerPage';
import ProjectsPage from './shared/components/layout/ProjectsPage';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import AnalyticsPage from './shared/components/layout/AnalyticsPage';
import SettingsPage from './shared/components/layout/SettingsPage';
import { updatePresence, WorkingState } from '@shared/lib/discord.ts';

const queryClient = new QueryClient();

function App() {
  updatePresence(WorkingState.IDLING);
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="flex h-full w-full">
          <Sidebar />
          <div className="flex-1 overflow-y-auto p-8">
            <Routes>
              <Route path="/" element={<Navigate to="/timer" />} />
              <Route path="/timer" element={<TimerPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
