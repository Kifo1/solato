import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@shared/lib/utils.js';
import { HTMLAttributes, ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import Button from './Button';

const modalVariants = cva(
  'relative flex justify-center text-center px-10 mx-6 p-10 overflow-y-auto',
  {
    variants: {
      variant: {
        default: 'bg-slate-800 rounded-2xl',
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

interface ModalProps extends VariantProps<typeof modalVariants>, HTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  className?: string;
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
}

function Modal({
  children,
  variant,
  scale,
  className,
  isOpen,
  setIsOpen,
  ...props
}: Readonly<ModalProps>) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <>
      {isOpen && (
        <button
          className="fixed inset-0 z-1000 flex h-full w-full items-center justify-center bg-black/50"
          onClick={() => setIsOpen(false)}
        >
          <button
            className={cn(modalVariants({ variant, scale, className }))}
            onClick={(e) => e.stopPropagation()}
            {...props}
          >
            <Button
              variant="icon"
              scale="icon_md"
              className="absolute top-4 right-4"
              onClick={() => setIsOpen(false)}
            >
              <X
                color="white"
                className="cursor-pointer transition-transform duration-200 hover:scale-110 hover:brightness-90"
              ></X>
            </Button>
            {children}
          </button>
        </button>
      )}
    </>
  );
}

export default Modal;
