// Hand-rolled SVG line chart for the Progress tab (docs/plans/progress-charts.md
// step 4) — no charting library. Retro card shell (hard border/shadow); colors
// read straight off the app's CSS custom properties so light/dark both work
// with no extra logic. Mobile has no hover, so a tap/focus on a point is the
// only way to read its exact value — the caption below the chart is that
// readout (see the plan's "Point inspection" assumption).
import { useState } from 'react'
import type { ProgressPoint } from '@/domain/progress'

interface ProgressChartProps {
  points: ProgressPoint[]
  formatValue: (value: number) => string
  formatDate: (ms: number) => string
  ariaLabel: string
  /**
   * Y-axis lower bound. `'zero'` (default) anchors the axis at 0 — right for
   * totals, where the bar height IS the quantity. `'auto'` lets the axis follow
   * the data, so a 78→76 kg body-weight trend fills the plot area instead of
   * flattening against a 0 baseline.
   */
  baseline?: 'zero' | 'auto'
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
  points,
  formatValue,
  formatDate,
  ariaLabel,
  baseline = 'zero',
}: ProgressChartProps) {
  const [selected, setSelected] = useState<number | null>(null)
  if (points.length === 0) return null

  const values = points.map((p) => p.value)
  const ticks = niceTicks(Math.min(...values), Math.max(...values), baseline === 'zero')
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const xMin = points[0].at
  const xMax = points[points.length - 1].at

  const innerW = VIEW_W - PAD.left - PAD.right
  const innerH = VIEW_H - PAD.top - PAD.bottom
  const xAt = (ms: number) =>
    PAD.left + (xMax === xMin ? innerW / 2 : ((ms - xMin) / (xMax - xMin)) * innerW)
  const yAt = (value: number) => PAD.top + innerH - ((value - yMin) / (yMax - yMin || 1)) * innerH

  const coords = points.map((p) => ({ x: xAt(p.at), y: yAt(p.value), point: p }))
  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ')
  const dense = points.length > DENSE_THRESHOLD
  const active = selected !== null ? coords[selected] : undefined
  const toggle = (i: number) => setSelected((prev) => (prev === i ? null : i))

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

        {coords.length > 1 && (
          <path
            d={linePath}
            fill="none"
            style={{ stroke: 'var(--primary)' }}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {coords.map((c, i) => {
          const isSelected = selected === i
          const showMarker = !dense || isSelected
          return (
            <g key={c.point.id}>
              {showMarker && (
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isSelected ? 6 : 4}
                  style={{ fill: 'var(--primary)', stroke: 'var(--card)' }}
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
                aria-label={`${formatDate(c.point.at)}: ${formatValue(c.point.value)}`}
                onClick={() => toggle(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggle(i)
                  }
                }}
                style={{ cursor: 'pointer', outline: 'none' }}
              />
            </g>
          )
        })}
      </svg>

      <p className="min-h-[1.25rem] text-center font-mono text-sm font-bold" aria-live="polite">
        {active ? `${formatValue(active.point.value)} — ${formatDate(active.point.at)}` : ' '}
      </p>
    </div>
  )
}
