// Minimal className combiner (avoids a clsx/tailwind-merge dependency for now).
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
