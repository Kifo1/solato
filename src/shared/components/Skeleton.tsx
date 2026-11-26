import { cn } from '@shared/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: Readonly<SkeletonProps>) {
  return <div className={cn('animate-pulse rounded-lg bg-tint', className)} />;
}
