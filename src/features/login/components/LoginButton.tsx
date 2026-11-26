import { ChevronRight, LogIn } from 'lucide-react';
import { useState } from 'react';
import LoginModal from './LoginModal';

interface LoginButtonProps {
  compact?: boolean;
}

export default function LoginButton({ compact = false }: Readonly<LoginButtonProps>) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title="Sign in to sync"
          aria-label="Sign in to sync"
          className="surface-well group relative mx-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-amber-400 transition-all duration-150 hover:border-amber-400/35 hover:bg-amber-500/[0.12] hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1014] focus-visible:outline-none"
        >
          <LogIn className="h-[18px] w-[18px]" />
          <span
            role="tooltip"
            className="surface-elevated pointer-events-none absolute top-1/2 left-full z-50 ml-2.5 flex -translate-x-1 -translate-y-1/2 flex-col rounded-lg px-2.5 py-1.5 text-left whitespace-nowrap opacity-0 shadow-2xl transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
          >
            <span className="text-xs font-medium text-[#F4F5F7]">Sign in</span>
            <span className="text-[10px] text-[#9CA3B0]">Enable cloud sync</span>
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="surface-well group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 hover:border-white/[0.12] hover:bg-[#151820] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1014] focus-visible:outline-none"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400 transition-colors duration-150 group-hover:border-amber-400/35 group-hover:bg-amber-500/15">
            <LogIn className="h-4 w-4" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium leading-tight text-[#F4F5F7]">
              Sign in
            </span>
            <span className="mt-0.5 block truncate text-[11px] leading-tight text-[#646C7A]">
              Enable cloud sync
            </span>
          </span>

          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#646C7A] transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-[#9CA3B0]" />
        </button>
      )}

      <LoginModal isOpen={isOpen} setIsOpen={setIsOpen} />
    </>
  );
}
