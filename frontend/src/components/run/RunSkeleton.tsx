// First-load skeleton for a run: header, verdict card, the quality/cost chart and leaderboard rows.
// Section titles are static, so they render for real.
import { Line, LoadingRegion, Skeleton } from '@/components/Skeleton'
import { Panel, Section } from '@/components/ui'
import { LEADERBOARD_COLS as COLS } from '@/components/Leaderboard'

export default function RunSkeleton() {
  return (
    <LoadingRegion label="Loading run" className="space-y-14">
      <div>
        <div className="flex min-h-[38px] items-center gap-3">
          <Skeleton className="h-[27px] w-[124px] rounded-md" />
          <Skeleton className="h-[22px] w-14 rounded-md" />
        </div>
        <Line lh="mt-3 h-10" bar="h-6" className="w-[340px] max-w-full" />
        <Line lh="mt-3 h-6" bar="h-3" className="w-[440px] max-w-full" />
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
          {[220, 380].map((w) => (
            <div key={w}>
              <Line lh="h-4" bar="h-2" className="w-36" />
              <Line lh="mt-1 h-5" bar="h-2.5" style={{ width: w }} />
            </div>
          ))}
        </div>
      </div>

      {/* verdict card */}
      <div className="rounded-2xl border border-line bg-panel p-6 sm:p-10">
        <Skeleton className="h-[27px] w-[120px] rounded-md" />
        <Line lh="mt-5 h-5" bar="h-3" className="w-56" />
        <div className="mt-4 max-w-4xl">
          <Line lh="h-12" bar="h-9" className="w-[90%]" />
          <Line lh="h-12" bar="h-9" className="w-[60%]" />
        </div>
        <div className="mt-8 grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-l border-line pl-4">
              <Line lh="h-10" bar="h-7" className="w-24" />
              <Line lh="mt-1 h-5" bar="h-2.5" className="w-[80%]" />
              <Line lh="mt-0.5 h-4" bar="h-2" className="w-[55%]" />
            </div>
          ))}
        </div>
        <div className="mt-8 border-t border-line pt-6">
          {['42%', '30%', '34%', '52%'].map((w) => <Line key={w} lh="h-6" bar="h-2.5" style={{ width: w }} />)}
        </div>
      </div>

      <Section title="Quality against cost" aside={<Line lh="h-5" bar="h-2.5" className="w-[440px] max-w-full" />}>
        <Panel className="p-4">
          <div className="relative h-[360px]">
            <Skeleton className="absolute inset-y-4 left-10 w-px rounded-none" />
            <Skeleton className="absolute right-4 bottom-10 left-10 h-px rounded-none" />
            {[[18, 30], [32, 22], [44, 18], [26, 52], [30, 72], [78, 16], [62, 22]].map(([x, y]) => (
              <Skeleton key={`${x}-${y}`} className="absolute size-3 rounded-full" style={{ left: `${x}%`, top: `${y}%` }} />
            ))}
          </div>
        </Panel>
      </Section>

      <Section title="Leaderboard" aside={<Line lh="h-5" bar="h-2.5" className="w-[440px] max-w-full" />}>
        <div className="overflow-x-auto rounded-xl border border-line bg-panel">
          <div className="min-w-[860px]">
            <div className={`grid ${COLS} h-[52px] items-end gap-x-2.5 px-4 pt-3 pb-2`}>
              {[10, 40, 90, 48, 56, 48, 32].map((w, i) => <Skeleton key={i} className={`h-2 ${i > 2 ? 'ml-auto' : ''}`} style={{ width: w }} />)}
            </div>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`grid ${COLS} h-[66px] items-center gap-x-2.5 border-t border-line px-4`}>
                <Skeleton className="h-4 w-3" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><Skeleton className="size-4 rounded-full" /><Skeleton className="h-3 w-32" /><Skeleton className="h-[18px] w-20 rounded-[5px]" /></div>
                  <div className="mt-1.5 flex items-center gap-1.5"><Skeleton className="h-2 w-40" /><Skeleton className="ml-1 h-[17px] w-28 rounded-[5px]" /><Skeleton className="h-[17px] w-24 rounded-[5px]" /></div>
                </div>
                <div className="relative h-9">
                  <Skeleton className="absolute top-1/2 h-3 w-[18%] -translate-y-1/2 rounded-[2px]" style={{ left: `${44 + i * 9}%` }} />
                </div>
                <div><Skeleton className="ml-auto h-3 w-12" /><Skeleton className="mt-1.5 ml-auto h-2 w-9" /></div>
                <Skeleton className="ml-auto h-3 w-10" />
                <Skeleton className="ml-auto h-3 w-14" />
                <Skeleton className="ml-auto h-3 w-6" />
              </div>
            ))}
          </div>
        </div>
      </Section>
    </LoadingRegion>
  )
}
