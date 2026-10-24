// First-load skeleton for the use-case page: the header and fact strip, the tab bar, and the body of the tab
// in the URL. Every block mirrors a real one (same paddings, line boxes and grid), so when the data lands the
// page fills in place instead of jumping. Section titles and tab labels are static, so they render for real.
import { Line, LoadingRegion, Skeleton } from '@/components/Skeleton'
import { Panel, Section } from '@/components/ui'
import { TAB_KEYS, TAB_LABEL, type TabKey } from './Tabs'
import { RunsSkeleton } from './Runs'

const chip = 'h-[26px] rounded-md'

export default function UseCaseSkeleton({ tab = 'overview' }: { tab?: TabKey }) {
  return (
    <LoadingRegion label="Loading use case">
      {/* breadcrumb and actions */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Skeleton className={`${chip} w-[78px]`} />
        <div className="flex flex-wrap items-center gap-1.5">
          {[121, 123, 60, 78].map((w) => <Skeleton key={w} className={chip} style={{ width: w }} />)}
        </div>
      </div>

      {/* kind badges, title */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Skeleton className="h-[27px] w-[108px] rounded-md" />
        <Skeleton className="h-[27px] w-[136px] rounded-md" />
      </div>
      <Line lh="mt-2.5 h-10" bar="h-[56%]" className="w-[min(440px,80%)]" />

      {/* two-line description */}
      <div className="mt-2.5 max-w-[70ch] text-[15px]">
        <Line lh="h-[1.625em]" bar="h-[0.6em]" />
        <Line lh="h-[1.625em]" bar="h-[0.6em]" className="w-[55%]" />
      </div>

      {/* fact strip: called from, model today, test cases, must pass */}
      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="min-w-0 bg-panel px-4 py-3">
            <Line lh="h-4" bar="h-2" className="w-20" />
            {i < 2 ? (
              <>
                <Line lh="mt-1 h-6" bar="h-3" className={i === 0 ? 'w-[70%]' : 'w-[55%]'} />
                <Line lh="mt-0.5 h-[18px]" bar="h-2" className="w-[35%]" />
              </>
            ) : (
              <Line lh="mt-1 h-8" bar="h-5" className={i === 2 ? 'w-8' : 'w-20'} />
            )}
          </div>
        ))}
      </div>

      {/* the tab bar is static: real labels, the stored tab underlined */}
      <div className="mt-8 flex gap-7 border-b border-line" aria-hidden>
        {TAB_KEYS.map((k) => (
          <span key={k} className={`-mb-px flex items-center gap-2 border-b-2 pt-1 pb-3 text-sm ${k === tab ? 'border-fg text-fg' : 'border-transparent text-muted'}`}>
            {TAB_LABEL[k]}
            {(k === 'cases' || k === 'runs') && <Skeleton className="h-[18px] w-6 rounded-md" />}
          </span>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'overview' && (
          <div className="space-y-8">
            <SetupSkeleton />
            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
              <LatestRunSkeleton />
              <StartRunSkeleton />
            </div>
          </div>
        )}
        {tab === 'cases' && <Section title="Test cases" aside={<Line lh="h-5" bar="h-2.5" className="w-14" />}><CasesSkeleton withToolbar /></Section>}
        {tab === 'scoring' && (
          <div className="max-w-4xl space-y-12">
            <Section title="What matters for this job" aside={<Line lh="h-5" bar="h-2.5" className="w-[300px] max-w-full" />}>
              <Panel className="p-5 sm:p-6"><WeightsSkeleton /></Panel>
            </Section>
            <Section title="Quality is measured by" aside={<Line lh="h-5" bar="h-2.5" className="w-52" />}>
              <Panel className="divide-y divide-line">{[0, 1, 2].map((i) => <MetricRowSkeleton key={i} />)}</Panel>
            </Section>
          </div>
        )}
        {tab === 'prompt' && (
          <div className="max-w-4xl space-y-6">
            {[96, 48].map((h, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-line bg-panel">
                <div className="flex h-[45px] items-center justify-between border-b border-line px-4"><Skeleton className="h-3 w-28" /><Skeleton className="h-6 w-16 rounded-md" /></div>
                <div className="space-y-2.5 px-4 py-4" style={{ minHeight: h }}>
                  <Skeleton className="h-2.5 w-[80%]" /><Skeleton className="h-2.5 w-[65%]" />{i === 0 && <Skeleton className="h-2.5 w-[40%]" />}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'runs' && <Section className="max-w-4xl" title="Runs" aside={<Line lh="h-5" bar="h-2.5" className="w-64" />}><RunsSkeleton /></Section>}
      </div>
    </LoadingRegion>
  )
}

function SetupSkeleton() {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex min-w-0 items-start gap-2.5 bg-panel px-4 py-3">
          <Skeleton className="mt-0.5 size-5 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <Line lh="h-5" bar="h-2.5" className="w-[60%]" />
            <Line lh="mt-0.5 h-4" bar="h-2" className="w-[85%]" />
          </div>
        </div>
      ))}
    </div>
  )
}

function LatestRunSkeleton() {
  return (
    <Panel className="p-5">
      <div className="flex items-center gap-2">
        <Skeleton className="h-[27px] w-[150px] rounded-md" />
        <Skeleton className="h-[22px] w-14 rounded-md" />
        <Skeleton className="ml-auto h-2 w-24" />
      </div>
      <Line lh="mt-4 h-7" bar="h-4" className="w-[85%]" />
      <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="border-l border-line pl-3"><Line lh="h-7" bar="h-4" className="w-16" /><Line lh="mt-0.5 h-4" bar="h-2" className="w-24" /></div>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
        <Skeleton className="h-2 w-64" />
        <Skeleton className="h-2.5 w-24" />
      </div>
    </Panel>
  )
}

function WeightsSkeleton() {
  return (
    <div className="grid items-center gap-x-10 gap-y-6 md:grid-cols-[minmax(0,280px)_1fr]">
      <div className="mx-auto w-full max-w-[280px]">
        {/* the triangle picker, as a triangle */}
        <div className="flex aspect-[280/254] items-center justify-center">
          <Skeleton className="h-[72%] w-[80%] rounded-none [clip-path:polygon(50%_0,100%_100%,0_100%)]" />
        </div>
        <Line lh="mt-1 h-4" bar="h-2" className="mx-auto w-[80%]" />
      </div>
      <div className="min-w-0 space-y-6">
        <div>
          <Line lh="mb-2 h-4" bar="h-2" className="w-14" />
          <div className="flex flex-wrap gap-2">
            {[86, 104, 121, 108, 124].map((w) => <Skeleton key={w} className="h-[34px] rounded-md" style={{ width: w }} />)}
          </div>
        </div>
        <div>
          <Line lh="h-7" bar="h-3.5" className="w-[85%]" />
          <Line lh="h-7" bar="h-3.5" className="w-[55%]" />
        </div>
        <div className="grid grid-cols-3 gap-4 border-t border-line pt-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="min-w-0">
              <Line lh="h-5" bar="h-2.5" className="w-16" />
              <Line lh="mt-0.5 h-8" bar="h-5" className="w-9" />
              <Line lh="h-4" bar="h-2" className="w-[85%]" />
              <Line lh="h-4" bar="h-2" className="w-[50%]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MetricRowSkeleton() {
  return (
    <div className="p-4">
      <div className="flex justify-between gap-3"><Line lh="h-5" bar="h-2.5" className="w-[50%]" /><Line lh="h-5" bar="h-2.5" className="w-8" /></div>
      <Skeleton className="mt-2 h-1 rounded-full" />
    </div>
  )
}

// CasesTable's <colgroup>: select, input, expected, source, tags, menu
const CASE_GRID = 'grid grid-cols-[2.5rem_minmax(0,1fr)_30%_6rem_16%_2.75rem]'

/** Test-case table rows, same frame and columns as CasesTable. */
export function CasesSkeleton({ rows = 3, withToolbar = false }: { rows?: number; withToolbar?: boolean }) {
  return (
    <LoadingRegion label="Loading test cases">
    {withToolbar && (
      <div className="mb-3 flex flex-wrap items-center gap-2" aria-hidden>
        <Skeleton className="h-9 min-w-[200px] flex-1 rounded-md sm:max-w-xs" />
        <Skeleton className="ml-auto h-9 w-[111px] rounded-md" />
      </div>
    )}
    <div className="overflow-hidden rounded-xl border border-line" aria-hidden>
      <div className={`${CASE_GRID} h-[39px] items-center bg-panel`}>
        <Skeleton className="ml-3 size-3.5 rounded-[3px]" />
        {[36, 52, 44, 30].map((w) => <span key={w} className="px-3"><Skeleton className="h-2" style={{ width: w }} /></span>)}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`${CASE_GRID} h-[76px] border-t border-line py-3`}>
          <span />
          <div className="px-3">
            <Line lh="h-5" bar="h-2.5" className="w-[85%]" />
            <Line lh="h-5" bar="h-2.5" className="w-[55%]" />
          </div>
          <div className="px-3">
            {['90%', '80%', '60%'].map((w) => <Line key={w} lh="h-[17px]" bar="h-2" className="" style={{ width: w }} />)}
          </div>
          <div className="px-3"><Skeleton className="h-[22px] w-12 rounded-md" /></div>
          <div className="px-3"><Line lh="h-4" bar="h-2" className="w-[70%]" /></div>
          <span />
        </div>
      ))}
    </div>
    </LoadingRegion>
  )
}

function StartRunSkeleton() {
  return (
    <Panel className="p-5">
      <Skeleton className="h-[27px] w-[78px] rounded-md" />
      <Line lh="mt-4 h-7" bar="h-4" className="w-[55%]" />
      <Line lh="mt-1 h-5" bar="h-2.5" className="w-[60%]" />
      <Skeleton className="mt-4 h-[46px] rounded-md" />
      <div className="mt-4 flex justify-between"><Line lh="h-5" bar="h-2" className="w-32" /><Line lh="h-5" bar="h-2.5" className="w-28" /></div>
      <Line lh="mt-1.5 h-5" bar="h-2.5" className="w-full" />
      <Line lh="h-5" bar="h-2.5" className="w-[70%]" />
      <div className="mt-3 border-t border-line pt-3">
        <div className="flex justify-between"><Line lh="h-4" bar="h-2" className="w-48" /><Line lh="h-4" bar="h-2" className="w-14" /></div>
        <Line lh="mt-1.5 h-6" bar="h-2.5" className="w-[60%]" />
        <Line lh="h-6" bar="h-2.5" className="w-[55%]" />
      </div>
      <div className="mt-3 border-t border-line pt-4">
        <Skeleton className="h-[30px] w-[190px] rounded-md" />
        <Line lh="mt-2 h-4" bar="h-2" className="w-[75%]" />
      </div>
      <Skeleton className="mt-4 h-9 w-full rounded-md" />
    </Panel>
  )
}
