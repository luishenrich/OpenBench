import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ModelIcon } from '@/components/ModelIcon'
import { StatusPill } from '@/components/ui'
import { ago, shortModel, usd } from '@/lib/format'
import { briefVerdict } from '@/lib/verdict'
import type { UseCase } from '@/types'
import { setupState, stateDot, stateLabel } from './group'
import { Checkbox, Icon, RowMenu, copyText, focusRing, toast } from './kit'

const verdictDot = { switch: 'bg-win', keep: 'bg-muted', use: 'bg-front' } as const
const verdictWord = { switch: 'Switch', keep: 'Keep', use: 'Use' } as const

// Shared with the column header in ProjectList so labels line up with the cells. The select (left) and
// menu (right) cells sit outside this grid with fixed widths: SELECT_W and MENU_W.
export const ROW_GRID = 'md:grid-cols-[minmax(0,1fr)_150px_64px_150px] lg:grid-cols-[minmax(0,1fr)_180px_64px_170px]'
export const SELECT_W = 'w-10'
// rows sit under their section label: chevron (14px) + gap (12px)
export const ROW_INDENT = 'pl-[26px]'
export const MENU_W = 'w-11'

export interface RowActions {
  selected: boolean
  selecting: boolean
  onSelect: (v: boolean) => void
  pinned: boolean
  onPin: (v: boolean) => void
  onRename: (name: string) => void
  onDelete: () => void
}

/** Name that turns into an input: Enter saves, Esc cancels, blur saves. */
export function RenameInput({ value, onDone, className = '' }: { value: string; onDone: (name: string | null) => void; className?: string }) {
  const [v, setV] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  const finish = (name: string | null) => {
    if (done.current) return
    done.current = true
    const t = name?.trim()
    onDone(t && t !== value ? t : null)
  }
  return (
    <input
      ref={ref} value={v} onChange={(e) => setV(e.target.value)} aria-label="Use case name"
      onKeyDown={(e) => { if (e.key === 'Enter') finish(v); if (e.key === 'Escape') finish(null) }}
      onBlur={() => finish(v)}
      className={`w-full rounded-md border border-signal/60 bg-bg px-2 py-0.5 text-fg outline-none ${className}`}
    />
  )
}

export function UseCaseRow({ uc, fresh, actions }: { uc: UseCase; fresh: boolean; actions: RowActions }) {
  const ref = uc.source_refs[0]
  const run = uc.latest_run
  const state = setupState(uc)
  const v = run?.status === 'done' ? briefVerdict(run) : null
  const savings = run?.status === 'done' ? run.est_monthly_savings_usd ?? 0 : 0
  const [renaming, setRenaming] = useState(false)

  const name = renaming
    ? <RenameInput value={uc.name} className="text-[14px] font-medium" onDone={(n) => { setRenaming(false); if (n) actions.onRename(n) }} />
    : (
      <div className="flex min-w-0 items-center gap-1.5">
        {actions.pinned && <Icon name="pin" className="size-3 shrink-0 text-front" />}
        <span className="truncate text-[14.5px] font-medium text-fg">{uc.name}</span>
      </div>
    )

  const cells: ReactNode = (
    <div className={`grid items-center gap-x-4 gap-y-1 ${ROW_GRID}`}>
      <div className="min-w-0">
        {name}
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
    </div>
  )

  return (
    <div
      className={`group/row flex items-stretch transition-colors duration-700 hover:bg-raised ${actions.selected ? 'bg-signal/[0.07]' : fresh ? 'bg-front/[0.07]' : 'bg-panel'}`}
    >
      <div className={`grid shrink-0 place-items-center ${SELECT_W}`}>
        <Checkbox
          checked={actions.selected} onChange={actions.onSelect} label={`Select ${uc.name}`}
          className={actions.selecting || actions.selected ? '' : 'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100'}
        />
      </div>
      {renaming ? (
        <div className={`min-w-0 flex-1 py-2.5 pr-1 ${ROW_INDENT}`}>{cells}</div>
      ) : (
        <Link to={`/use-cases/${uc.id}`} className={`block min-w-0 flex-1 rounded-sm py-2.5 pr-1 ${ROW_INDENT} ${focusRing}`}>
          {cells}
          {run?.status === 'done' && run.recommendation_headline && (
            <p className="mt-1 truncate text-[12.5px] text-muted lg:hidden" title={run.recommendation_headline}>
              {run.recommendation_headline}
              {run.finished_at && <span className="ml-2 text-faint">{ago(run.finished_at)}</span>}
            </p>
          )}
        </Link>
      )}
      <div className={`grid shrink-0 place-items-center ${MENU_W}`}>
        <RowMenu
          label={`Actions for ${uc.name}`}
          items={[
            { label: 'Rename', icon: 'pencil', onSelect: () => setRenaming(true) },
            { label: actions.pinned ? 'Unpin' : 'Pin to top', icon: 'pin', onSelect: () => actions.onPin(!actions.pinned) },
            { label: 'Copy id', icon: 'copy', onSelect: async () => toast((await copyText(uc.id)) ? 'Copied the use case id' : 'Could not copy: clipboard blocked', 'plain') },
            { label: 'Delete…', icon: 'trash', danger: true, onSelect: actions.onDelete },
          ]}
        />
      </div>
    </div>
  )
}
