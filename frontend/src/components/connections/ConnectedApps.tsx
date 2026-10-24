// "Connected apps": the MCP clients signed in to BIY over OAuth, with Revoke.
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Tag } from '@/components/ui'
import { LoadingRegion, Skeleton } from '@/components/Skeleton'
import { ConfirmDialog, Toaster, toast } from '@/components/usecases/kit'
import { GrantsUnavailable, connectedAgo, hostOf, knownIcon, listGrants, revokeGrant, type OAuthGrant } from '@/components/connections/grants'

export function ConnectedApps() {
  const qc = useQueryClient()
  const grants = useQuery({ queryKey: ['oauth-grants'], queryFn: listGrants, retry: (n, e) => !(e instanceof GrantsUnavailable) && n < 1 })
  const [confirm, setConfirm] = useState<OAuthGrant | null>(null)
  const revoke = useMutation({
    mutationFn: (g: OAuthGrant) => revokeGrant(g.client.id),
    // Refetch first, so the row is gone by the time the toast says so
    onSuccess: async (_, g) => {
      await qc.invalidateQueries({ queryKey: ['oauth-grants'] })
      toast(`Revoked ${g.client.name}`)
    },
    onError: (e, g) => {
      toast(e instanceof Error ? e.message : `Couldn't revoke ${g.client.name}.`, 'bad')
      void qc.invalidateQueries({ queryKey: ['oauth-grants'] })
    },
  })

  let body
  if (grants.isPending) {
    body = (
      <LoadingRegion label="Loading connected apps">
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel" aria-hidden>
          {[0, 1].map((i) => (
            <li key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="size-9 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5"><Skeleton className="h-3 w-24" /><Skeleton className="h-2 w-20" /></div>
                <div className="mt-2 flex items-center gap-1.5">
                  {[46, 42, 50].map((w) => <Skeleton key={w} className="h-[22px] rounded-md" style={{ width: w }} />)}
                  <Skeleton className="ml-1 h-2 w-24" />
                </div>
              </div>
              <Skeleton className="h-8 w-[74px] shrink-0 rounded-md" />
            </li>
          ))}
        </ul>
      </LoadingRegion>
    )
  } else if (grants.error instanceof GrantsUnavailable) {
    body = <Note>Connected apps show up here once OAuth sign-in is on for this server.</Note>
  } else if (grants.isError) {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">
        <span>{grants.error instanceof Error ? grants.error.message : "Couldn't load your connected apps."}</span>
        <button type="button" onClick={() => grants.refetch()} className="text-xs text-muted underline-offset-2 hover:text-fg hover:underline">Try again</button>
      </div>
    )
  } else if (grants.data.length === 0) {
    body = <Note>No apps connected yet. Add BIY in your agent above, then Authenticate.</Note>
  } else {
    body = (
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel">
        {grants.data.map((g) => (
          <GrantRow
            key={g.client.id}
            grant={g}
            revoking={revoke.isPending && revoke.variables?.client.id === g.client.id}
            onRevoke={() => setConfirm(g)}
          />
        ))}
      </ul>
    )
  }

  return (
    <>
      {body}
      <ConfirmDialog
        open={confirm !== null}
        title={`Revoke ${confirm?.client.name ?? 'this app'}?`}
        body="It loses access immediately; the agent has to sign in again."
        confirmLabel="Revoke"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) revoke.mutate(confirm)
          setConfirm(null)
        }}
      />
      <Toaster />
    </>
  )
}

function Note({ children }: { children: string }) {
  return <p className="rounded-lg border border-dashed border-line px-4 py-3.5 text-sm text-muted">{children}</p>
}

function GrantRow({ grant, revoking, onRevoke }: { grant: OAuthGrant; revoking: boolean; onRevoke: () => void }) {
  const { client, scopes, granted_at } = grant
  const host = hostOf(client.uri)
  const ago = connectedAgo(granted_at)
  return (
    <li className={`flex items-center gap-4 px-4 py-3.5 ${revoking ? 'opacity-60' : ''}`}>
      <ClientTile name={client.name} logo={client.logo_uri} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span className="truncate text-sm font-medium text-fg">{client.name || 'Unnamed app'}</span>
          {host && <span className="truncate text-xs text-faint">{host}</span>}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {scopes.map((s) => <Tag key={s}>{s}</Tag>)}
          {ago && (
            <span className={`text-xs text-faint ${scopes.length ? 'ml-1' : ''}`} title={new Date(granted_at).toLocaleString()}>
              Connected {ago}
            </span>
          )}
        </div>
      </div>
      <Button variant="danger" onClick={onRevoke} disabled={revoking} className="shrink-0 px-3 py-1.5 text-[13px]">
        {revoking ? 'Revoking…' : 'Revoke'}
      </Button>
    </li>
  )
}

function ClientTile({ name, logo }: { name: string; logo: string }) {
  const src = knownIcon(name) ?? (logo || null)
  const [broken, setBroken] = useState<string | null>(null)
  return (
    <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-raised">
      {src && broken !== src ? (
        <img src={src} alt="" className="size-5 object-contain" draggable={false} onError={() => setBroken(src)} />
      ) : (
        <span className="text-sm font-semibold text-muted">{(name.match(/[a-z0-9]/i)?.[0] ?? '?').toUpperCase()}</span>
      )}
    </span>
  )
}
