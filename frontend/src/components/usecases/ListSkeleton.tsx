// First-load skeleton for the use-case list: the live status line, the toolbar, and one project with a
// section header and rows on the real row grid (ROW_GRID, SELECT_W, ROW_INDENT), so rows fill in place.
import { Line, LoadingRegion, Skeleton } from '@/components/Skeleton'
import { ColumnHeader } from './ProjectList'
import { MENU_W, ROW_GRID, ROW_INDENT, SELECT_W } from './UseCaseRow'

const NAME_W = ['62%', '48%', '70%', '55%', '40%', '66%']

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <LoadingRegion label="Loading use cases">
      <section aria-hidden>
        <header className="mb-3">
          <Line lh="h-7" bar="h-4" className="w-48" />
          <Line lh="mt-1 h-5" bar="h-2.5" className="w-[340px] max-w-full" />
        </header>
        <Skeleton className="mb-4 h-1 rounded-full" />
        <div className="overflow-hidden rounded-xl border border-line">
          <ColumnHeader />
          <div className="flex h-10 items-center gap-3 border-b border-line bg-panel">
            <span className={`shrink-0 ${SELECT_W}`} />
            <Skeleton className="size-3.5 rounded-[3px]" />
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-[18px] w-7 rounded-md" />
            <Skeleton className="mr-4 ml-auto h-2 w-40" />
          </div>
          <ul className="divide-y divide-line">
            {Array.from({ length: rows }, (_, i) => (
              <li key={i} className="flex items-stretch bg-panel">
                <span className={`shrink-0 ${SELECT_W}`} />
                <div className={`min-w-0 flex-1 py-2.5 pr-1 ${ROW_INDENT}`}>
                  <div className={`grid items-center gap-x-4 gap-y-1 ${ROW_GRID}`}>
                    <div className="min-w-0">
                      <Line lh="h-[22px]" bar="h-3" style={{ width: NAME_W[i % NAME_W.length] }} />
                      <Line lh="mt-0.5 h-[17px]" bar="h-2" className="w-[38%]" />
                    </div>
                    <div className="flex items-center gap-1.5"><Skeleton className="size-3.5 rounded-full" /><Skeleton className="h-2.5 w-20" /></div>
                    <div className="flex md:justify-end"><Skeleton className="h-2.5 w-6" /></div>
                    <div className="flex items-center gap-2"><Skeleton className="size-2 rounded-[2px]" /><Skeleton className="h-2.5 w-16" /></div>
                  </div>
                </div>
                <span className={`shrink-0 ${MENU_W}`} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </LoadingRegion>
  )
}

/** Where the live status line and the toolbar sit once the list arrives. */
export function StatusLineSkeleton() {
  return <Line lh="mt-5 h-5" bar="h-2.5" className="w-[420px] max-w-full" />
}

export function ToolbarSkeleton() {
  return (
    <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2.5" aria-hidden>
      <Skeleton className="h-[34px] min-w-[180px] flex-1 rounded-md sm:max-w-xs" />
      <div className="flex gap-1">
        {[52, 70, 84, 64].map((w) => <Skeleton key={w} className="h-[30px] rounded-md" style={{ width: w }} />)}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Skeleton className="h-[30px] w-[150px] rounded-md" />
        <Skeleton className="h-[30px] w-[106px] rounded-md" />
      </div>
    </div>
  )
}
