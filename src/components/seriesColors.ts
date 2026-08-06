// Categorical colours for the Progress tab's per-program lines
// (docs/plans/progress-by-program.md). Eight fixed slots in a fixed order,
// assigned by a program's position in the range- and selection-independent
// program index and NEVER cycled — so a colour follows the PROGRAM rather than
// its rank on screen, and narrowing the range cannot repaint the survivors.
// The hexes live in index.css as --series-1…8 with a light and a dark step
// each, so theming stays pure CSS exactly like the rest of the chart's colours.

/** How many programs the "All programs" view can colour distinctly. */
export const PROGRAM_SLOTS = 8

/**
 * The CSS colour for a program's slot. Past the eighth there is no safe distinct
 * hue left, so the line falls back to neutral ink — which only ever happens for a
 * program shown ALONE (the combined view plots the first PROGRAM_SLOTS), where
 * one line cannot be confused with another.
 */
export function seriesColor(index: number): string {
  return index >= 0 && index < PROGRAM_SLOTS
    ? `var(--series-${index + 1})`
    : 'var(--muted-foreground)'
}
