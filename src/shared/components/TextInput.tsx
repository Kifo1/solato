import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@shared/lib/utils.js';
import type { InputHTMLAttributes } from 'react';

const inputVariants = cva(
  'text-white w-full px-2 py-1.5 rounded-md focus:outline-none focus:ring-2 focus:border-transparent transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-slate-700 placeholder-gray-400 border border-color-blue',
      },
      scale: {
        sm: 'text-sm',
        md: 'text-base',
        lg: 'text-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      scale: 'md',
    },
  },
);

interface TextInputProps
  extends VariantProps<typeof inputVariants>, InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export function TextInput({ variant, scale, className, ...props }: Readonly<TextInputProps>) {
  return <input className={cn(inputVariants({ variant, scale, className }))} {...props} />;
}
