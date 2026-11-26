import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@shared/lib/utils';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastApi {
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const VARIANT_CONFIG: Record<
  ToastVariant,
  { icon: typeof CheckCircle2; iconClass: string; borderClass: string }
> = {
  success: {
    icon: CheckCircle2,
    iconClass: 'text-teal-400',
    borderClass: 'border-teal-500/25',
  },
  error: {
    icon: AlertCircle,
    iconClass: 'text-rose-400',
    borderClass: 'border-rose-500/30',
  },
  info: {
    icon: Info,
    iconClass: 'text-amber-400',
    borderClass: 'border-amber-500/25',
  },
};

export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string, description?: string) => {
      const id = nextIdRef.current++;
      setToasts((prev) => [...prev.slice(-3), { id, message, description, variant }]);
      window.setTimeout(() => {
        dismiss(id);
      }, variant === 'error' ? 4800 : 3200);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, description) => push('success', message, description),
      error: (message, description) => push('error', message, description),
      info: (message, description) => push('info', message, description),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toasts.length > 0 &&
        createPortal(
          <div
            aria-live="polite"
            className="pointer-events-none fixed right-5 bottom-5 z-[1400] flex max-w-sm flex-col gap-2"
          >
            {toasts.map((toast) => {
              const cfg = VARIANT_CONFIG[toast.variant];
              const Icon = cfg.icon;
              return (
                <div
                  key={toast.id}
                  role={toast.variant === 'error' ? 'alert' : 'status'}
                  className={cn(
                    'surface-elevated animate-toast-in pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-2xl',
                    cfg.borderClass,
                  )}
                >
                  <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', cfg.iconClass)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-fg">{toast.message}</p>
                    {toast.description && (
                      <p className="mt-0.5 text-[11px] leading-snug text-fg-secondary">
                        {toast.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label="Dismiss notification"
                    onClick={() => dismiss(toast.id)}
                    className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-tint-strong hover:text-fg"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
