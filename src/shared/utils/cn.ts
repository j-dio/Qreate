/**
 * cn (className) utility
 *
 * Combines multiple className strings and handles conflicts intelligently.
 * Uses clsx to merge class names and tailwind-merge to handle Tailwind conflicts.
 *
 * Example:
 *   cn('px-2 py-1', 'px-4') // Result: 'py-1 px-4' (px-4 overrides px-2)
 *   cn('text-red-500', condition && 'text-blue-500') // Conditional classes
 */

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
