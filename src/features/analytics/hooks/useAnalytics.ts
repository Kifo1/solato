import { Project } from "@/shared/components/layout/ProjectsPage";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function useAnalytics() {
  const queryClient = useQueryClient();

  const { data: selectedProjects = [] } = useQuery<Project[]>({
    queryKey: ["localSelectedProjects"],
    initialData: [],
    staleTime: Infinity,
  });

  const setSelectedProjects = (nextProjects: Project[]) => {
    queryClient.setQueryData(["localSelectedProjects"], nextProjects);
  };

  return { selectedProjects, setSelectedProjects };
}
