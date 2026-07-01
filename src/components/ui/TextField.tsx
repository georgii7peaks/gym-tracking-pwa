// RetroUI text input: bold border, square corners, clear focus ring.
import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextField({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-11 w-full border-2 border-border bg-background px-3 text-base text-foreground',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          'disabled:opacity-50',
          className
        )}
        {...props}
      />
    )
  }
)
