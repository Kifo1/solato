import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

interface ToggleSwitchProps extends VariantProps<typeof switchVariants> {
  isOn: boolean;
  setIsOn: (val: boolean) => void;
  className?: string;
}

const switchVariants = cva('relative rounded-4xl select-none', {
  variants: {
    scale: {
      sm: 'w-10 h-5',
      md: 'w-14 h-8',
      lg: 'w-20 h-10',
    },
    variant: {
      default: ``,
    },
  },
  defaultVariants: {
    scale: 'md',
    variant: 'default',
  },
});

const sliderVariants = cva(
  'absolute inset-0 rounded-full cursor-pointer transition-colors duration-300',
  {
    variants: {
      variant: {
        default: '',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export default function Switch({
  isOn,
  setIsOn,
  scale,
  variant,
  className,
}: Readonly<ToggleSwitchProps>) {
  const bgColor = isOn ? 'bg-blue-500/75' : 'bg-gray-400';

  const knobTranslate = isOn ? 'translate-x-full' : 'translate-x-0';
  const knobVariants = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <label className={cn(switchVariants({ variant, scale, className }))}>
      <input
        type="checkbox"
        checked={isOn}
        onChange={(e) => setIsOn(e.target.checked)}
        className="sr-only"
      />
      <span className={cn(sliderVariants({ variant }), bgColor)}>
        <span
          className={cn(
            `absolute top-1 left-1 rounded-full bg-white transition-transform duration-300`,
            knobVariants[scale ?? 'md'],
            knobTranslate,
          )}
        ></span>
      </span>
    </label>
  );
}
