import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { AppSettings } from '@shared/lib/models/settings';

export function useSettings() {
  const queryClient = useQueryClient();

  const {
    data: settings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['settings'],
    queryFn: () => invoke<AppSettings>('get_settings'),
    staleTime: Infinity,
  });

  const { mutateAsync: updateSettingsAsync, isPending: isUpdating } = useMutation({
    mutationFn: (newSettings: AppSettings) => invoke('update_settings', { newSettings }),

    onMutate: async (newSettings) => {
      await queryClient.cancelQueries({ queryKey: ['settings'] });
      const previousSettings = queryClient.getQueryData<AppSettings>(['settings']);
      queryClient.setQueryData<AppSettings>(['settings'], newSettings);
      return { previousSettings };
    },

    onError: (_err, _newSettings, context) => {
      if (context?.previousSettings !== undefined) {
        queryClient.setQueryData<AppSettings>(['settings'], context.previousSettings);
      }
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const updateSingleSetting = async (partial: Partial<AppSettings>) => {
    const currentSettings = queryClient.getQueryData<AppSettings>(['settings']) ?? settings;
    if (!currentSettings) return;

    return await updateSettingsAsync({
      ...currentSettings,
      ...partial,
    });
  };

  return {
    settings,
    isLoading,
    error,
    isUpdating,
    updateSingleSetting,
    updateSettings: updateSettingsAsync,
  };
}
