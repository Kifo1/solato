import LoginButton from '@/features/login/components/LoginButton';
import { ChartLine, FolderDot, LucideIcon, Settings, Timer } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import LoginUser from '@features/login/components/LoginUser.tsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';

interface NavbarItemProps {
  name: string;
  Icon: LucideIcon;
  to: string;
}

function NavbarItem({ name, Icon, to }: Readonly<NavbarItemProps>) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `${
          isActive
            ? 'border-blue-500 bg-blue-500/10 text-blue-500'
            : 'border-transparent text-blue-200 hover:bg-gray-700 hover:text-white'
        } flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors`
      }
    >
      <span className="material-symbols-outlined group-hover:text-primary transition-colors">
        <Icon />
      </span>
      <span className="text-sm font-medium">{name}</span>
    </NavLink>
  );
}

export default function Sidebar() {
  const queryClient = useQueryClient();

  const {
    data: loggedIn,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['loginStatus'],
    queryFn: () => invoke<boolean>('is_logged_in'),
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    const unlisten = listen('auth-status-changed', () => {
      queryClient.invalidateQueries({ queryKey: ['loginStatus'] });
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [queryClient]);

  return (
    <aside className="flex w-64 flex-col justify-between border-r border-blue-300 p-4">
      <div className="flex flex-col gap-6">
        <div className="px-2">
          <h1 className="text-xl font-bold tracking-tight text-white">Solato</h1>
          <p className="text-xs font-normal text-blue-200">Track your time</p>
        </div>
        <nav className="flex flex-col gap-2">
          <NavbarItem name="Timer" Icon={Timer} to="/timer"></NavbarItem>
          <NavbarItem name="Projects" Icon={FolderDot} to="/projects"></NavbarItem>
          <NavbarItem name="Analytics" Icon={ChartLine} to="/analytics"></NavbarItem>
          <NavbarItem name="Settings" Icon={Settings} to="/settings"></NavbarItem>
        </nav>
      </div>
      {isLoading ? (
        <span className="text-xs text-gray-400">Loading...</span>
      ) : error ? (
        <span className="text-xs text-red-400">Error</span>
      ) : loggedIn ? (
        <LoginUser />
      ) : (
        <LoginButton />
      )}
    </aside>
  );
}
