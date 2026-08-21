import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'default' | 'quiet' | 'dark'
}

const toneClasses: Record<NonNullable<CardProps['tone']>, string> = {
  default: 'border-line bg-paper text-ink',
  quiet: 'border-line bg-canvas-raised text-ink',
  dark: 'border-white/10 bg-ink text-paper',
}

export function Card({
  className,
  tone = 'default',
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border p-5 shadow-[0_1px_0_rgba(13,31,42,0.04)] sm:p-6',
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  )
}
