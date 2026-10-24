// First-load skeleton for Settings: the real page title, then sections on the SettingsSection grid.
import { Line, LoadingRegion, Skeleton } from '@/components/Skeleton'
import { HEADER } from './controls'

const SECTIONS: { title: number; controls: 'input' | 'weights' | 'rows' | 'chips' }[] = [
  { title: 130, controls: 'input' },
  { title: 80, controls: 'weights' },
  { title: 70, controls: 'rows' },
  { title: 96, controls: 'chips' },
]

export default function SettingsSkeleton() {
  return (
    <LoadingRegion label="Loading settings">
      <header className={HEADER}>
        <h1 className="display min-w-0 truncate text-3xl">Settings</h1>
        {/* Same sentence as the page, so it wraps the same; only the workspace name is unknown yet */}
        <p className="text-sm text-faint text-pretty">
          Defaults for every use case in this workspace. A use case keeps these until you change a setting on its own page.
        </p>
      </header>
      <div className="mt-6">
        {SECTIONS.map((s, i) => (
          <section key={i} className="grid gap-x-12 gap-y-4 border-t border-line py-8 md:grid-cols-[260px_minmax(0,1fr)]" aria-hidden>
            <div>
              <Line lh="h-6" bar="h-3" style={{ width: s.title }} />
              <div className="mt-1.5">
                <Line lh="h-[22px]" bar="h-2.5" className="w-full" />
                <Line lh="h-[22px]" bar="h-2.5" className="w-[70%]" />
              </div>
            </div>
            <div className="min-w-0">
              {s.controls === 'input' && <Skeleton className="h-[34px] w-full max-w-sm rounded-md" />}
              {s.controls === 'weights' && (
                <div className="grid items-center gap-x-10 gap-y-6 md:grid-cols-[minmax(0,280px)_1fr]">
                  <div className="flex aspect-[280/254] w-full max-w-[280px] items-center justify-center">
                    <Skeleton className="h-[72%] w-[80%] rounded-none [clip-path:polygon(50%_0,100%_100%,0_100%)]" />
                  </div>
                  <div className="space-y-6">
                    <div className="flex flex-wrap gap-2">{[86, 104, 121, 108, 124].map((w) => <Skeleton key={w} className="h-[34px] rounded-md" style={{ width: w }} />)}</div>
                    <Line lh="h-7" bar="h-3.5" className="w-[70%]" />
                    <div className="grid grid-cols-3 gap-4 border-t border-line pt-4">
                      {[0, 1, 2].map((j) => <div key={j}><Line lh="h-5" bar="h-2.5" className="w-16" /><Line lh="mt-0.5 h-8" bar="h-5" className="w-9" /></div>)}
                    </div>
                  </div>
                </div>
              )}
              {s.controls === 'rows' && (
                <div className="space-y-3">{[0, 1].map((j) => <div key={j} className="flex items-center gap-3"><Line lh="h-5" bar="h-2.5" className="w-24" /><Skeleton className="h-[34px] w-28 rounded-md" /></div>)}</div>
              )}
              {s.controls === 'chips' && (
                <div className="flex flex-wrap gap-2">{[150, 132, 170, 120].map((w) => <Skeleton key={w} className="h-9 rounded-md" style={{ width: w }} />)}</div>
              )}
            </div>
          </section>
        ))}
      </div>
    </LoadingRegion>
  )
}
