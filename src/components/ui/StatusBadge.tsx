import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'critical'

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone
}

const toneClasses: Record<StatusTone, string> = {
  neutral: 'border-line-strong bg-canvas-raised text-ink-muted',
  info: 'border-blue/30 bg-blue/10 text-blue',
  success: 'border-green/30 bg-green/10 text-green',
  warning: 'border-gold/40 bg-gold/12 text-gold-dark',
  critical: 'border-danger/35 bg-danger/10 text-danger-dark',
}

export function StatusBadge({
  className,
  tone = 'neutral',
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em]',
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  )
}
