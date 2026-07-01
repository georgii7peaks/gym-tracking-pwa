// Centred placeholder for empty tabs/lists (APP_SPECIFICATION.md §5.1, §5.6).
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  hint?: string
}

export function EmptyState({ icon: Icon, title, hint }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <Icon aria-hidden className="h-12 w-12 text-muted-foreground" strokeWidth={2.25} />
      <p className="text-lg font-bold">{title}</p>
      {hint && <p className="max-w-xs text-sm text-muted-foreground">{hint}</p>}
    </div>
  )
}
