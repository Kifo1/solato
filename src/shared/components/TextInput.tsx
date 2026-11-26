import { forwardRef, type InputHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@shared/lib/utils';

const inputVariants = cva(
  'w-full rounded-xl text-fg placeholder-fg-muted transition-all duration-150 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-well border border-line hover:border-line-strong focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20',
        error:
          'bg-well border border-rose-500/50 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20',
      },
      scale: {
        sm: 'h-8.5 px-3 text-xs',
        md: 'h-10 px-3.5 text-sm',
        lg: 'h-11 px-4 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      scale: 'md',
    },
  },
);

export interface TextInputProps
  extends VariantProps<typeof inputVariants>,
    InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const TextInput = forwardRef<HTMLInputElement, Readonly<TextInputProps>>(
  function TextInput({ variant, scale, className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(inputVariants({ variant, scale }), className)}
        {...props}
      />
    );
  },
);
