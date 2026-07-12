import Button from '@/shared/components/Button';
import { UserIcon } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useQueryClient } from '@tanstack/react-query';

export default function LoginUser() {
  const queryClient = useQueryClient();

  const handleLogOut = async () => {
    try {
      await invoke('logout');
      queryClient.setQueryData(['loginStatus'], false);
    } catch (error) {
      console.error('Fehler beim Logout:', error);
    }
  };

  return (
    <div className="flex content-center justify-center">
      <UserIcon className="h-full text-blue-200" />
      <Button className="ml-3 bg-blue-900/50" variant="secondary" onClick={handleLogOut}>
        Logout
      </Button>
    </div>
  );
}
