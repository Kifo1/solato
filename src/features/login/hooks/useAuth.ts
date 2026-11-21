import {
  CommandResponse,
  LoginRequest,
  RegisterRequest,
  VerifyRequest,
} from '@/shared/lib/models/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

const AUTH_QUERY_KEY = ['loginStatus'];

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: loggedIn, isLoading } = useQuery<boolean>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      return await invoke<boolean>('is_logged_in');
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
  });

  const verifyMutation = useMutation({
    mutationFn: async (payload: VerifyRequest) => {
      const res = await invoke<CommandResponse>('verify_user', { payload });
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });

  return {
    isLoggedIn: Boolean(loggedIn),
    isLoading,

    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error?.message || null,

    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error?.message || null,

    verify: verifyMutation.mutateAsync,
    isVerifying: verifyMutation.isPending,
    verifyError: verifyMutation.error?.message || null,
  };
}
