import { ChevronRight, LogIn } from 'lucide-react';
import { useState } from 'react';
import LoginModal from './LoginModal';

export default function LoginButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
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

      <LoginModal isOpen={isOpen} setIsOpen={setIsOpen} />
    </>
  );
}
