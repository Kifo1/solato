import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@shared/lib/utils.js';
import type { ButtonHTMLAttributes } from 'react';

const buttonVariants = cva('hover:cursor-pointer rounded', {
  variants: {
    variant: {
      primary:
        'text-white bg-blue-500 hover:bg-blue-600 rounded-full font-bold text-xl tracking-wide transition-all transform hover:scale-101 active:scale-100 flex items-center justify-center gap-3',
      secondary:
        'text-white bg-slate-900 rounded-full font-semibold hover:scale-101 hover:border-white disabled:border-none tracking-whide transition-all flex justify-center gap-3 disabled:hover:cursor-default disabled:text-gray-400 disabled:font-semibold',
      danger: '',
      success: '',
      ghost: 'text-gray-400 font-semibold rounded-full flex justify-center gap-3',
    },
    scale: {
      sm: 'pt-1.5 pb-1.5 pl-4 pr-4',
      md: 'pt-2 pb-2 pl-4 pr-4',
      lg: '',
    },
  },
  defaultVariants: {
    variant: 'primary',
    scale: 'md',
  },
});

interface ButtonComponentProps
  extends VariantProps<typeof buttonVariants>, ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
}

export default function Button({
  children,
  variant,
  scale,
  className,
  ...props
}: Readonly<ButtonComponentProps>) {
  return (
    <button className={cn(buttonVariants({ variant, scale, className }))} {...props}>
      {children}
    </button>
  );
}
