import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

export function useSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => invoke<AppSettings>('get_settings'),
    staleTime: Infinity,
  });

  const { mutate: updateSettings } = useMutation({
    mutationFn: (newSettings: AppSettings) => invoke('update_settings', { newSettings }),

    onMutate: async (newSettings) => {
      await queryClient.cancelQueries({ queryKey: ['settings'] });
      const previousSettings = queryClient.getQueryData(['settings']);
      queryClient.setQueryData(['settings'], newSettings);
      return { previousSettings };
    },

    onError: (_err, _newSettings, context) => {
      queryClient.setQueryData(['settings'], context?.previousSettings);
    },
  });

  return { settings, isLoading, updateSettings };
}
