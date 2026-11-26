import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@shared/lib/utils';
import type { ButtonHTMLAttributes } from 'react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-45 active:scale-[0.985]',
  {
    variants: {
      variant: {
        primary:
          'bg-amber-500 text-on-accent font-semibold shadow-[0_1px_0_rgba(255,255,255,0.28)_inset,0_6px_18px_-6px_var(--accent-glow)] hover:bg-amber-400',
        secondary:
          'bg-elevated text-fg border border-line shadow-[0_1px_0_rgba(255,255,255,0.05)_inset] hover:bg-elevated hover:border-line-strong',
        danger:
          'bg-rose-500/15 text-rose-300 border border-rose-500/25 hover:bg-rose-500/25 hover:text-rose-200 hover:border-rose-400/40',
        success:
          'bg-teal-500/15 text-teal-300 border border-teal-500/25 hover:bg-teal-500/25 hover:text-teal-200',
        ghost:
          'bg-transparent text-fg-secondary hover:bg-tint hover:text-fg',
        icon: 'bg-transparent text-fg-secondary hover:bg-tint-strong hover:text-fg',
      },
      scale: {
        sm: 'h-8 px-3 rounded-lg text-xs',
        md: 'h-9.5 px-4 rounded-xl text-sm',
        lg: 'h-11 px-6 rounded-xl text-sm font-semibold',
        icon_sm: 'h-7 w-7 p-1 rounded-lg',
        icon_md: 'h-9 w-9 p-2 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'primary',
      scale: 'md',
    },
  },
);

export interface ButtonComponentProps
  extends VariantProps<typeof buttonVariants>,
    ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
}

export default function Button({
  children,
  variant,
  scale,
  className,
  type = 'button',
  ...props
}: Readonly<ButtonComponentProps>) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, scale }), className)} {...props}>
      {children}
    </button>
  );
}
