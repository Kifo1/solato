import { useToast } from '@shared/context/ToastContext';
import { getErrorMessage } from '@shared/lib/utils';
import { Loader2, LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface LoginUserProps {
  compact?: boolean;
}

export default function LoginUser({ compact = false }: Readonly<LoginUserProps>) {
  const { logout, isLoggingOut, logoutError } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleLogOut = async () => {
    try {
      await logout();
      toast.info('Signed out', 'Cloud sync paused. Local sessions remain saved.');
    } catch (err) {
      toast.error('Sign out failed', getErrorMessage(err));
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => navigate('/settings?section=account')}
        title="Account · Cloud sync active"
        aria-label="Account · Cloud sync active"
        className="surface-well group relative mx-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-fg-secondary transition-all duration-150 hover:border-line-strong hover:bg-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:outline-none"
      >
        <User className="h-[18px] w-[18px]" />
        <span
          aria-hidden="true"
          className="absolute right-1.5 bottom-1.5 h-2.5 w-2.5 rounded-full bg-teal-400 ring-2 ring-well"
        />
        <span
          role="tooltip"
          className="surface-elevated pointer-events-none absolute top-1/2 left-full z-50 ml-2.5 flex -translate-x-1 -translate-y-1/2 flex-col rounded-lg px-2.5 py-1.5 text-left whitespace-nowrap opacity-0 shadow-2xl transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
        >
          <span className="text-xs font-medium text-fg">Account</span>
          <span className="text-[10px] text-teal-400">Cloud sync active</span>
        </span>
      </button>
    );
  }

  return (
    <div className="surface-well rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-elevated text-fg-secondary">
          <User className="h-4 w-4" />
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-teal-400 ring-2 ring-well"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium leading-tight text-fg">Account</p>
          <p className="mt-0.5 truncate text-[11px] leading-tight text-teal-400/90">
            Cloud sync active
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogOut}
          disabled={isLoggingOut}
          title="Sign out"
          aria-label="Sign out"
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-fg-muted transition-colors duration-150 hover:bg-rose-500/10 hover:text-rose-300 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-well focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
        >
          {isLoggingOut ? (
            <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
        </button>
      </div>

      {logoutError && (
        <p
          role="alert"
          title={logoutError}
          className="mt-2 truncate border-t border-line-subtle pt-2 text-[11px] leading-snug text-rose-400"
        >
          {logoutError}
        </p>
      )}
    </div>
  );
}
