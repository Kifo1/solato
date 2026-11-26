import {
  CommandResponse,
  LoginRequest,
  RegisterRequest,
  VerifyRequest,
} from '@/shared/lib/models/auth';
import { getErrorMessage } from '@shared/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

export const AUTH_QUERY_KEY = ['loginStatus'] as const;

const USER_DATA_QUERY_KEYS = [
  ['projects'],
  ['folders'],
  ['timer_projects'],
  ['sessions'],
  ['analytics'],
  ['localSelectedProjects'],
] as const;

export function useAuth() {
  const queryClient = useQueryClient();

  const invalidateUserData = () => {
    for (const queryKey of USER_DATA_QUERY_KEYS) {
      queryClient.invalidateQueries({ queryKey });
    }
  };

  const {
    data: loggedIn,
    isLoading,
    error: authError,
    refetch,
  } = useQuery<boolean>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      return await invoke<boolean>('is_logged_in');
    },
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: true,
  });

  const loginMutation = useMutation({
    mutationFn: async (payload: LoginRequest) => {
      const res = await invoke<CommandResponse>('login_user', { payload });
      if (!res.success) throw new Error(res.message || 'Sign in failed.');
      return res;
    },
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, true);
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
      invalidateUserData();
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (payload: RegisterRequest) => {
      const res = await invoke<CommandResponse>('register_user', { payload });
      if (!res.success) throw new Error(res.message || 'Registration failed.');
      return res;
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (payload: VerifyRequest) => {
      const res = await invoke<CommandResponse>('verify_user', { payload });
      if (!res.success) throw new Error(res.message || 'Verification failed.');
      return res;
    },
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, true);
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
      invalidateUserData();
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await invoke<string>('logout');
    },
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, false);
      invalidateUserData();
    },
  });

  return {
    isLoggedIn: Boolean(loggedIn),
    isLoading,
    error: authError ? getErrorMessage(authError) : null,
    refetch,

    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error ? getErrorMessage(loginMutation.error) : null,

    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error ? getErrorMessage(registerMutation.error) : null,

    verify: verifyMutation.mutateAsync,
    isVerifying: verifyMutation.isPending,
    verifyError: verifyMutation.error ? getErrorMessage(verifyMutation.error) : null,

    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
    logoutError: logoutMutation.error ? getErrorMessage(logoutMutation.error) : null,
  };
}
