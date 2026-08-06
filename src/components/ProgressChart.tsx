// Hand-rolled SVG line chart for the Progress tab (docs/plans/progress-charts.md
// step 4, made multi-series by docs/plans/progress-by-program.md) — no charting
// library. Several series share ONE pair of axes; there is never a second y-axis.
// Colors are supplied by the caller, so this component owns no palette: Body
// Weight passes var(--primary), the per-program charts pass their slot color.
// Retro card shell (hard border/shadow); the chrome colors read straight off the
// app's CSS custom properties so light/dark both work with no extra logic.
// Mobile has no hover, so a tap/focus on a point is the only way to read its
// exact value — the caption below the chart is that readout (see the plan's
// "Point inspection" assumption).
import { useState, type ReactNode } from 'react'
import type { ProgressPoint } from '@/domain/progress'

export interface ChartSeries {
  /** Legend label AND identity key — must be unique within one chart. */
  label: string
  /** CSS color for the line and its markers; a `var(--…)` keeps theming free. */
  color: string
  /** Oldest-first points. An empty series is simply not drawn. */
  points: ProgressPoint[]
}

interface ProgressChartProps {
  series: ChartSeries[]
  formatValue: (value: number) => string
  formatDate: (ms: number) => string
  ariaLabel: string
  /** aria-label for the legend list (only rendered with 2+ drawn series). */
  legendLabel?: string
  /**
   * Y-axis lower bound. `'zero'` (default) anchors the axis at 0 — right for
   * totals, where the bar height IS the quantity. `'auto'` lets the axis follow
   * the data, so a 78→76 kg body-weight trend fills the plot area instead of
   * flattening against a 0 baseline.
   */
  baseline?: 'zero' | 'auto'
  /**
   * Optional action rendered under the readout caption while a point is
   * selected — the chart itself stays generic (Volume/Duration pass nothing).
   */
  renderPointAction?: (point: ProgressPoint) => ReactNode
}

const VIEW_W = 320
const VIEW_H = 180
const PAD = { top: 12, right: 12, bottom: 22, left: 38 }
// Past this many points, per-point circle markers become visual noise —
// keep only the line (matches the plan's "dense data" risk note).
const DENSE_THRESHOLD = 40

/** Classic "nice number" rounding (1/2/5/10 × 10^n) for readable axis ticks. */
function niceNum(range: number, round: boolean): number {
  const exponent = Math.floor(Math.log10(range))
  const fraction = range / 10 ** exponent
  if (round) return (fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10) * 10 ** exponent
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * 10 ** exponent
}

/**
 * ~4 rounded tick values spanning [min, max]. With `floorAtZero` the lower tick
 * is clamped to 0 (totals); without it the axis follows the data (body weight).
 */
function niceTicks(min: number, max: number, floorAtZero: boolean, count = 4): number[] {
  const pad = min === max ? Math.max(1, Math.abs(min) * 0.1) : 0
  const lo = min - pad
  const hi = max + pad
  const step = niceNum(niceNum(hi - lo, false) / (count - 1), true)
  const dataMin = Math.floor(lo / step) * step
  const niceMin = floorAtZero ? Math.max(0, dataMin) : dataMin
  const niceMax = Math.ceil(hi / step) * step
  const ticks: number[] = []
  for (let v = niceMin; v <= niceMax + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  return ticks
}

export function ProgressChart({
  series,
  formatValue,
  formatDate,
  ariaLabel,
  legendLabel,
  baseline = 'zero',
  renderPointAction,
}: ProgressChartProps) {
  // Keyed by point id, not by index: after a delete or a grouping switch an
  // index would silently highlight a DIFFERENT point, while an id that no
  // longer exists simply resolves to "nothing selected". Ids stay unique across
  // series here — a training point carries its Workout Session's id, and a
  // session belongs to exactly one program.
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const drawn = series.filter((s) => s.points.length > 0)
  const allPoints = drawn.flatMap((s) => s.points)
  if (allPoints.length === 0) return null

  // ONE pair of axes spanning every series — never a second y-axis.
  const values = allPoints.map((p) => p.value)
  const ticks = niceTicks(Math.min(...values), Math.max(...values), baseline === 'zero')
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const times = allPoints.map((p) => p.at)
  const xMin = Math.min(...times)
  const xMax = Math.max(...times)

  const innerW = VIEW_W - PAD.left - PAD.right
  const innerH = VIEW_H - PAD.top - PAD.bottom
  const xAt = (ms: number) =>
    PAD.left + (xMax === xMin ? innerW / 2 : ((ms - xMin) / (xMax - xMin)) * innerW)
  const yAt = (value: number) => PAD.top + innerH - ((value - yMin) / (yMax - yMin || 1)) * innerH

  const plotted = drawn.map((s) => {
    const coords = s.points.map((p) => ({ x: xAt(p.at), y: yAt(p.value), point: p }))
    return {
      ...s,
      coords,
      linePath: coords
        .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
        .join(' '),
    }
  })

  // Density is a property of the whole canvas, not of one line.
  const dense = allPoints.length > DENSE_THRESHOLD
  // One flag drives every multi-series difference (legend, caption prefix,
  // point label prefix), so a single-series chart renders exactly as before.
  const multi = plotted.length > 1
  const active = plotted
    .flatMap((s) => s.coords.map((c) => ({ ...c, label: s.label })))
    .find((c) => c.point.id === selectedId)
  const toggle = (id: string) => setSelectedId((prev) => (prev === id ? null : id))
  const prefix = (label: string) => (multi ? `${label} · ` : '')

  return (
    <div className="flex flex-col gap-2 border-2 border-border bg-card p-3 shadow-retro">
      <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full">
        {ticks.map((tick) => {
          const y = yAt(tick)
          return (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={VIEW_W - PAD.right}
                y1={y}
                y2={y}
                style={{ stroke: 'var(--border)' }}
                strokeWidth={1}
                opacity={0.4}
              />
              <text
                x={PAD.left - 6}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                style={{ fill: 'var(--muted-foreground)' }}
                fontSize={8}
                className="font-mono"
              >
                {formatValue(tick)}
              </text>
            </g>
          )
        })}

        <text
          x={PAD.left}
          y={VIEW_H - 6}
          textAnchor="start"
          style={{ fill: 'var(--muted-foreground)' }}
          fontSize={8}
          className="font-mono"
        >
          {formatDate(xMin)}
        </text>
        {xMax !== xMin && (
          <text
            x={VIEW_W - PAD.right}
            y={VIEW_H - 6}
            textAnchor="end"
            style={{ fill: 'var(--muted-foreground)' }}
            fontSize={8}
            className="font-mono"
          >
            {formatDate(xMax)}
          </text>
        )}

        {plotted.map((s) => (
          <g key={s.label} data-series={s.label}>
            {s.coords.length > 1 && (
              <path
                d={s.linePath}
                fill="none"
                style={{ stroke: s.color }}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {s.coords.map((c) => {
              const isSelected = selectedId === c.point.id
              // A one-point series draws no path, so hiding its marker on a dense
              // canvas would render that series as nothing at all.
              const showMarker = !dense || isSelected || s.coords.length === 1
              return (
                <g key={c.point.id}>
                  {showMarker && (
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={isSelected ? 6 : 4}
                      style={{ fill: s.color, stroke: 'var(--card)' }}
                      strokeWidth={2}
                    />
                  )}
                  {/* Hit target is bigger than the visible marker (touch-friendly). */}
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={12}
                    fill="transparent"
                    // A transparent fill isn't "painted", so it's invisible to hit-testing
                    // under the default `pointer-events: visiblePainted` — taps would fall
                    // through to whatever's underneath. Force `all` so the full (larger
                    // than the visible marker) hit target actually receives them.
                    pointerEvents="all"
                    tabIndex={0}
                    role="button"
                    aria-label={`${prefix(s.label)}${formatDate(c.point.at)}: ${formatValue(c.point.value)}`}
                    onClick={() => toggle(c.point.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggle(c.point.id)
                      }
                    }}
                    style={{ cursor: 'pointer', outline: 'none' }}
                  />
                </g>
              )
            })}
          </g>
        ))}
      </svg>

      {/* Identity is never colour-alone: the swatch is decorative, the name is
          real text in a text token, and the swatch's border keeps a pale slot
          legible on the light theme's white card. */}
      {multi && (
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1" aria-label={legendLabel}>
          {plotted.map((s) => (
            <li key={s.label} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2 w-6 border border-border"
                style={{ backgroundColor: s.color }}
              />
              <span className="font-mono text-xs text-muted-foreground">{s.label}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="min-h-[1.25rem] text-center font-mono text-sm font-bold" aria-live="polite">
        {active
          ? `${prefix(active.label)}${formatValue(active.point.value)}— ${formatDate(active.point.at)}`
          : ' '}
      </p>
      {active && renderPointAction?.(active.point)}
    </div>
  )
}
