import { Project } from "@/shared/components/layout/ProjectsPage";
import { useState } from "react";

export function useAnalytics() {
  const [selectedProjects, setSelectedProjects] = useState<Project[]>([]);

  return {
    selectedProjects,
    setSelectedProjects,
  };
}
