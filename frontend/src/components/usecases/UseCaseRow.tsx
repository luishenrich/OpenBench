import { Link } from 'react-router-dom'
import { ModelIcon } from '@/components/ModelIcon'
import { StatusPill } from '@/components/ui'
import { ago, shortModel, usd } from '@/lib/format'
import { briefVerdict } from '@/lib/verdict'
import type { UseCase } from '@/types'
import { setupState, stateDot, stateLabel } from './group'

const verdictDot = { switch: 'bg-win', keep: 'bg-muted', use: 'bg-front' } as const
const verdictWord = { switch: 'Switch', keep: 'Keep', use: 'Use' } as const

// Shared with the column header in ProjectList so labels line up with the cells.
export const ROW_GRID = 'md:grid-cols-[minmax(0,1fr)_150px_64px_150px_16px] lg:grid-cols-[minmax(0,1fr)_180px_64px_170px_16px]'

export function UseCaseRow({ uc, fresh }: { uc: UseCase; fresh: boolean }) {
  const ref = uc.source_refs[0]
  const run = uc.latest_run
  const state = setupState(uc)
  const v = run?.status === 'done' ? briefVerdict(run) : null
  const savings = run?.status === 'done' ? run.est_monthly_savings_usd ?? 0 : 0

  return (
    <Link
      to={`/use-cases/${uc.id}`}
      className={`group block px-4 py-2.5 transition-colors duration-700 hover:bg-raised ${fresh ? 'bg-front/[0.07]' : 'bg-panel'}`}
    >
      <div className={`grid items-center gap-x-4 gap-y-1 ${ROW_GRID}`}>
        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-medium text-fg">{uc.name}</div>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            {ref && (
              <span className={`truncate font-mono text-[11.5px] text-faint ${run?.status === 'done' ? 'lg:max-w-[55%] lg:shrink-0' : ''}`} title={`${ref.path}${ref.line ? `:${ref.line}` : ''}`}>
                {ref.path}{ref.line ? `:${ref.line}` : ''}
              </span>
            )}
            {uc.created_by === 'mcp' && <span className="shrink-0 text-[11px] text-front/80">found by agent</span>}
            {run?.status === 'done' && run.recommendation_headline && (
              // wide screens: the verdict headline sits inline, next to the path
              <span className="hidden min-w-0 truncate text-[12.5px] text-muted lg:inline" title={run.recommendation_headline}>
                <span className="text-faint">· </span>{run.recommendation_headline}
              </span>
            )}
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
          {uc.current_model
            ? <><ModelIcon model={uc.current_model.model} size={14} /><span className="truncate">{shortModel(uc.current_model.model)}</span></>
            : <span className="text-faint">no model</span>}
        </div>

        <div className={`text-[13px] tabular-nums md:text-right ${uc.case_count ? 'text-muted' : 'text-faint'}`}>
          {uc.case_count} <span className="md:hidden">cases</span>
        </div>

        <div className="flex min-w-0 items-center gap-2 text-[13px]">
          {v ? (
            <>
              <span className={`size-2 shrink-0 rounded-[2px] ${verdictDot[v]}`} />
              <span className={v === 'keep' ? 'text-muted' : 'text-fg'}>{verdictWord[v]}</span>
              {savings > 0 && <span className="truncate text-win">~{usd(savings)}/mo</span>}
            </>
          ) : run && (state === 'running' || state === 'failed') ? (
            <StatusPill status={run.status} />
          ) : (
            <>
              <span className={`size-1.5 shrink-0 rounded-[1px] ${stateDot[state]}`} />
              <span className={state === 'data' ? 'font-medium text-front' : state === 'ready' ? 'text-fg' : 'text-muted'}>{stateLabel[state]}</span>
            </>
          )}
        </div>

        <span className="hidden justify-self-end text-faint transition-colors group-hover:text-fg md:block" aria-hidden>
          <svg viewBox="0 0 16 16" className="size-3.5"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
        </span>
      </div>

      {run?.status === 'done' && run.recommendation_headline && (
        <p className="mt-1 truncate text-[12.5px] text-muted lg:hidden" title={run.recommendation_headline}>
          {run.recommendation_headline}
          {run.finished_at && <span className="ml-2 text-faint">{ago(run.finished_at)}</span>}
        </p>
      )}
    </Link>
  )
}
