import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui'
import { ConfirmDialog, Icon, copyText, focusRing, toast } from '@/components/usecases/kit'
import { agentInstruction, shortId, useDeleteUseCases, usePins, useRename } from '@/components/usecases/ops'
import { RenameInput } from '@/components/usecases/UseCaseRow'
import { api } from '@/lib/api'
import type { UseCase } from '@/types'

const chip = `inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1 text-xs text-muted transition-colors hover:border-line-strong hover:text-fg ${focusRing}`

function CopyButton({ text, label, done, icon, className = chip, mono = false }: { text: string; label: string; done: string; icon: 'copy' | 'agent'; className?: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button" className={className} title={text}
      onClick={async () => {
        const ok = await copyText(text)
        if (!ok) { toast('Could not copy: the clipboard is blocked in this browser', 'bad'); return }
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      }}
    >
      <Icon name={copied ? 'check' : icon} className={`size-3.5 ${copied ? 'text-win' : ''}`} />
      <span className={mono && !copied ? 'font-mono' : ''}>{copied ? done : label}</span>
    </button>
  )
}

/** Breadcrumb, actions (id, copy for agent, pin, delete), badges and the title with inline rename. */
export default function UseCaseHeader({ uc }: { uc: UseCase }) {
  const navigate = useNavigate()
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const list = useQuery({ queryKey: ['use-cases'], queryFn: api.useCases })
  const pins = usePins(me.data?.workspace.id ?? uc.workspace_id, list.data)
  const rename = useRename()
  const del = useDeleteUseCases()
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const pinned = pins.isPinned(uc)

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Link to="/" className={`rounded-md border border-line bg-panel px-2.5 py-1 text-xs text-muted hover:text-fg ${focusRing}`}>Use cases</Link>
        <div className="flex flex-wrap items-center gap-1.5">
          <CopyButton text={uc.id} label={shortId(uc.id)} done="Copied" icon="copy" mono />
          <CopyButton text={agentInstruction(uc)} label="Copy for agent" done="Copied instruction" icon="agent" />
          <button type="button" className={chip} aria-pressed={pinned} onClick={() => void pins.setPinned([uc.id], !pinned)}>
            <Icon name="pin" className={`size-3.5 ${pinned ? 'text-front' : ''}`} />{pinned ? 'Pinned' : 'Pin'}
          </button>
          <button type="button" className={`${chip} hover:border-bad/50 hover:text-bad`} onClick={() => setConfirm(true)}>
            <Icon name="trash" className="size-3.5" />Delete
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Badge tone="front">{uc.kind}</Badge>
        {uc.created_by === 'mcp' && <Badge tone="signal">Found by agent</Badge>}
      </div>
      {editing ? (
        <div className="mt-3">
          <RenameInput
            value={uc.name} className="display py-1 text-3xl sm:text-4xl"
            onDone={(name) => { setEditing(false); if (name) rename.mutate({ id: uc.id, name }) }}
          />
          <p className="mt-1.5 text-xs text-faint">Enter saves, Esc cancels.</p>
        </div>
      ) : (
        <div className="group/title mt-2.5 flex items-start gap-2">
          <h1
            className="display line-clamp-2 min-w-0 text-3xl text-pretty sm:text-4xl" title={`${uc.name} (double-click to rename)`}
            onDoubleClick={() => setEditing(true)}
          >
            {uc.name}
          </h1>
          <button
            type="button" aria-label="Rename use case" onClick={() => setEditing(true)}
            className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-md text-faint opacity-60 transition hover:bg-raised hover:text-fg group-hover/title:opacity-100 focus-visible:opacity-100 ${focusRing}`}
          >
            <Icon name="pencil" />
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title={`Delete “${uc.name}”?`}
        body={<>This also deletes its {uc.case_count} test {uc.case_count === 1 ? 'case' : 'cases'} and its runs. It can't be undone.</>}
        confirmLabel="Delete use case"
        busy={del.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          // mutateAsync: the promise settles even if this header unmounts first
          del.mutateAsync([uc]).then((res) => { setConfirm(false); if (res[0]?.ok) navigate('/') }, () => setConfirm(false))
        }}
      />
    </>
  )
}
