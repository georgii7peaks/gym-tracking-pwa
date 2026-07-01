// Transient toast pill (design). Rendered by a screen; the caller controls its
// lifetime. Purely presentational.
interface ToastProps {
  message: string
}

export function Toast({ message }: ToastProps) {
  return (
    <div
      role="status"
      className="pointer-events-none fixed bottom-24 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap border-2 border-border bg-foreground px-4 py-2.5 font-mono text-xs font-bold tracking-wide text-background shadow-retro"
    >
      {message}
    </div>
  )
}
