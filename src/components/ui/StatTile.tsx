// A single stat tile for the workout stats bar (design: TIME / VOLUME / SETS).
interface StatTileProps {
  value: string
  label: string
}

export function StatTile({ value, label }: StatTileProps) {
  return (
    <div className="border-2 border-border bg-muted px-2 py-2.5 text-center">
      <div className="font-mono text-lg font-bold leading-tight tabular-nums">{value}</div>
      <div className="mt-1 font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  )
}
