import { type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

const variants = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  ghost: 'px-3 py-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] rounded-lg transition-all duration-200 font-mono text-xs',
  icon: 'p-1.5 rounded-lg hover:bg-white/[0.05] text-zinc-400 hover:text-zinc-200 transition-all duration-200',
} as const;

type Variant = keyof typeof variants;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'secondary', className, children, ...props }: ButtonProps) {
  return (
    <button className={clsx(variants[variant], className)} {...props}>
      {children}
    </button>
  );
}
