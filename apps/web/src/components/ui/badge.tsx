import { cn } from '@/lib/utils';

export function Badge({ className, variant = 'default', ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'success' | 'warn' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variant === 'default' && 'bg-muted text-foreground',
        variant === 'success' && 'bg-emerald-900/50 text-emerald-300',
        variant === 'warn' && 'bg-amber-900/50 text-amber-300',
        className
      )}
      {...props}
    />
  );
}