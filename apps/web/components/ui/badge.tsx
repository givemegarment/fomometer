import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        default: 'border-border bg-bg-chip text-text-muted',
        success: 'border-success/40 bg-success-soft text-success',
        danger: 'border-danger/40 bg-danger-soft text-danger',
        warning: 'border-warning/40 bg-warning-soft text-warning',
        accent: 'border-accent/40 bg-accent/10 text-accent'
      }
    },
    defaultVariants: { variant: 'default' }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
