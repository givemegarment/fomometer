import { cva, type VariantProps } from 'class-variance-authority';

/** Button styles, kept out of the client component so server components can use them on links. */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-colors duration-150 ease-snap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-accent-button text-white hover:bg-accent-button-hover',
        light: 'bg-white text-bg-base hover:bg-white/90',
        dark: 'bg-black text-white hover:bg-black/85',
        secondary:
          'bg-white/[0.06] text-text-primary hover:bg-white/[0.1]',
        ghost: 'text-text-muted hover:text-text-primary hover:bg-white/5',
        outline:
          'ring-hair text-text-primary hover:bg-white/5',
        danger: 'bg-danger text-white hover:bg-danger/90'
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-[15px]',
        xl: 'h-14 px-8 text-base',
        icon: 'h-9 w-9 p-0'
      }
    },
    defaultVariants: { variant: 'primary', size: 'md' }
  }
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
