import { CommandResponse, LoginRequest, RegisterRequest, UserInfo } from '@/shared/lib/models/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

const AUTH_QUERY_KEY = ['auth-user'];

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<UserInfo | null>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      return await invoke<UserInfo | null>('get_current_user');
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (payload: LoginRequest) => {
      const res = await invoke<CommandResponse>('login_user', { payload });
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (payload: RegisterRequest) => {
      const res = await invoke<CommandResponse>('register_user', { payload });
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });

  return {
    user,
    isLoggedIn: !!user,
    isLoading,

    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error?.message || null,

    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error?.message || null,
  };
}
