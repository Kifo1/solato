import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Project } from "./ProjectsPage";
import FirstProjectTutorial from "@/features/projects/components/FirstProjectTutorial";
import AnalyticScopeSelector from "@/features/analytics/components/AnalyticScopeSelector";
import AnalyticStreak from "@/features/analytics/components/AnalyticStreak";
import { AnalyticCalendar } from "@/features/analytics/components/AnalyticCalendar";

export default function AnalyticsPage() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => invoke<Project[]>("get_projects"),
  });

  if (isLoading) return <div className="text-white">Loading...</div>;

  let userHasProjects = projects.length > 0;

  return (
    <div>
      <div className="flex flex-row">
        <div>
          <h1 className="text-white text-5xl font-bold">Analyze Projects</h1>
          <p className="text-blue-200 pt-3">
            See insides and statistics for your projects.
          </p>
        </div>
        <div className="ml-auto">
          <AnalyticScopeSelector />
        </div>
      </div>
      <div>
        {userHasProjects ? (
          <div className="flex gap-5 flex-col">
            <div className="mt-15 border-slate-200/10 bg-slate-200/5 flex items-center justify-between border rounded-2xl p-6">
              <div className="flex-1 flex items-center justify-center">
                <AnalyticStreak />
              </div>
            </div>
            <AnalyticCalendar />
          </div>
        ) : (
          <FirstProjectTutorial />
        )}
      </div>
    </div>
  );
}
