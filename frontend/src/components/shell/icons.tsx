// Nav icons for the app shell: 16 px grid, 1.4 stroke, round caps (same family as usecases/kit Icon).
const PATHS = {
  list: 'M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01',
  plug: 'M6 2.5v3M10 2.5v3M4.5 5.5h7v2.5a3.5 3.5 0 01-7 0V5.5zM8 11.5v2',
  gear: 'M8 10a2 2 0 100-4 2 2 0 000 4zM8 1.8v1.7M8 12.5v1.7M1.8 8h1.7M12.5 8h1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M3.6 12.4l1.2-1.2M11.2 4.8l1.2-1.2',
  repo: 'M3.5 2.5h8a1 1 0 011 1v9h-8a1 1 0 00-1 1v-10a1 1 0 011-1zM3.5 12.5v1h9',
  stack: 'M8 2.5l5.5 3L8 8.5l-5.5-3L8 2.5zM2.5 8L8 11l5.5-3M2.5 10.5L8 13.5l5.5-3',
  menu: 'M2.5 4.5h11M2.5 8h11M2.5 11.5h11',
  x: 'M4 4l8 8M12 4l-8 8',
  out: 'M6.5 2.5h-3a1 1 0 00-1 1v9a1 1 0 001 1h3M10 5l3 3-3 3M13 8H6.5',
} as const
export type NavIconName = keyof typeof PATHS

export function NavIcon({ name, className = 'size-4' }: { name: NavIconName; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`shrink-0 ${className}`} aria-hidden>
      <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
