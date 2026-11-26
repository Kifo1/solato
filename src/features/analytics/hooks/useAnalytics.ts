import { Project } from '@shared/lib/models/project';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

export function useAnalytics() {
  const queryClient = useQueryClient();

  const { data: selectedProjects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['localSelectedProjects'],
    queryFn: async () => {
      return await invoke<Project[]>('get_selected_projects');
    },
    staleTime: 60_000,
  });

  const setSelectedProjects = (nextProjects: Project[]) => {
    queryClient.setQueryData<Project[]>(['localSelectedProjects'], nextProjects);
  };

  return { selectedProjects, setSelectedProjects, isLoading };
}
