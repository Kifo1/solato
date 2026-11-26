import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@shared/lib/utils';
import { HTMLAttributes, ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const modalVariants = cva(
  'relative flex flex-col w-full max-h-[90vh] overflow-y-auto text-left animate-modal-panel',
  {
    variants: {
      variant: {
        default: 'surface-elevated rounded-2xl p-6 sm:p-7',
      },
      scale: {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      scale: 'md',
    },
  },
);

interface ModalProps extends VariantProps<typeof modalVariants>, HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
}

function Modal({
  children,
  variant,
  scale,
  className,
  isOpen,
  setIsOpen,
  closeOnBackdrop = true,
  showCloseButton = true,
  ...props
}: Readonly<ModalProps>) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    globalThis.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, setIsOpen]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div
      role="presentation"
      className="animate-modal-backdrop fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) {
          setIsOpen(false);
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(modalVariants({ variant, scale }), className)}
        {...props}
      >
        {showCloseButton && (
          <button
            type="button"
            aria-label="Close modal"
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#9CA3B0] transition-colors hover:bg-white/[0.08] hover:text-[#F4F5F7] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export default Modal;
