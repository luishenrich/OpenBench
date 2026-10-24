// Use-case operations shared by the list and the use-case page: rename (optimistic), delete, pin.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useSyncExternalStore } from 'react'
import { api } from '@/lib/api'
import type { UseCase } from '@/types'
import { toast } from './kit'

// --- pins ---------------------------------------------------------------------
// UseCase.pinned is the source of truth (PATCH {pinned}). Only an older API without the field falls back to
// this browser (biy:pins:<workspace_id>); once the field shows up, those local pins are dropped.
const subs = new Set<() => void>()
const cache = new Map<string, string>()
const keyFor = (ws: string) => `biy:pins:${ws}`

function readRaw(ws: string): string {
  try { return localStorage.getItem(keyFor(ws)) ?? '[]' } catch { return cache.get(ws) ?? '[]' }
}
function readPins(ws: string): Set<string> {
  try { return new Set(JSON.parse(readRaw(ws)) as string[]) } catch { return new Set() }
}
function writePins(ws: string, pins: Set<string>) {
  const raw = JSON.stringify([...pins])
  cache.set(ws, raw)
  try { localStorage.setItem(keyFor(ws), raw) } catch { /* storage blocked: kept in memory for this tab */ }
  subs.forEach((f) => f())
}

export const serverPins = (list: UseCase[] | undefined) => !!list?.some((u) => typeof u.pinned === 'boolean')

export function usePins(workspaceId: string | undefined, list: UseCase[] | undefined) {
  const qc = useQueryClient()
  const ws = workspaceId ?? 'local'
  const raw = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => readRaw(ws))
  const server = serverPins(list)
  const local = (() => { try { return new Set(JSON.parse(raw) as string[]) } catch { return new Set<string>() } })()

  useEffect(() => {
    if (!server || raw === '[]') return
    try { localStorage.removeItem(keyFor(ws)) } catch { /* storage blocked */ }
    cache.delete(ws)
    subs.forEach((f) => f())
  }, [server, raw, ws])

  const isPinned = (uc: UseCase) => (server ? !!uc.pinned : local.has(uc.id))

  async function setPinned(ids: string[], pinned: boolean) {
    if (server) {
      // optimistic: the strip moves at once; the refetch brings pinned_at
      const prev = qc.getQueryData<UseCase[]>(['use-cases'])
      qc.setQueryData<UseCase[]>(['use-cases'], (l) => l?.map((u) => (ids.includes(u.id) ? { ...u, pinned } : u)))
      ids.forEach((id) => qc.setQueryData<UseCase>(['use-case', id], (u) => (u ? { ...u, pinned } : u)))
      try {
        await Promise.all(ids.map((id) => api.updateUseCase(id, { pinned })))
      } catch (e) {
        qc.setQueryData(['use-cases'], prev)
        toast(`Could not ${pinned ? 'pin' : 'unpin'}: ${e instanceof Error ? e.message : String(e)}`, 'bad')
      }
      qc.invalidateQueries({ queryKey: ['use-cases'] })
      ids.forEach((id) => qc.invalidateQueries({ queryKey: ['use-case', id] }))
    } else {
      const next = readPins(ws)
      ids.forEach((id) => (pinned ? next.add(id) : next.delete(id)))
      writePins(ws, next)
    }
  }
  return { isPinned, setPinned, server }
}

// --- rename -----------------------------------------------------------------------
export function useRename() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.updateUseCase(id, { name }),
    onMutate: async ({ id, name }) => {
      await qc.cancelQueries({ queryKey: ['use-cases'] })
      await qc.cancelQueries({ queryKey: ['use-case', id] })
      const list = qc.getQueryData<UseCase[]>(['use-cases'])
      const one = qc.getQueryData<UseCase>(['use-case', id])
      qc.setQueryData<UseCase[]>(['use-cases'], (l) => l?.map((u) => (u.id === id ? { ...u, name } : u)))
      qc.setQueryData<UseCase>(['use-case', id], (u) => (u ? { ...u, name } : u))
      return { list, one }
    },
    onError: (err, { id }, ctx) => {
      qc.setQueryData(['use-cases'], ctx?.list)
      qc.setQueryData(['use-case', id], ctx?.one)
      toast(`Rename failed: ${err instanceof Error ? err.message : String(err)}`, 'bad')
    },
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: ['use-cases'] })
      qc.invalidateQueries({ queryKey: ['use-case', id] })
    },
  })
}

// --- delete -----------------------------------------------------------------------
export function useDeleteUseCases() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: Pick<UseCase, 'id' | 'name'>[]) => {
      const results = await Promise.allSettled(items.map((u) => api.deleteUseCase(u.id)))
      return items.map((u, i) => ({ ...u, ok: results[i].status === 'fulfilled', error: results[i].status === 'rejected' ? (results[i] as PromiseRejectedResult).reason : null }))
    },
    onSuccess: (res) => {
      const ok = res.filter((r) => r.ok)
      const failed = res.filter((r) => !r.ok)
      qc.setQueryData<UseCase[]>(['use-cases'], (l) => l?.filter((u) => !ok.some((r) => r.id === u.id)))
      // the ['use-case', id] cache is left alone: removing it would refetch (404) under a page that is navigating away
      qc.invalidateQueries({ queryKey: ['use-cases'] })
      if (ok.length === 1) toast(`Deleted ${ok[0].name}`)
      else if (ok.length > 1) toast(`Deleted ${ok.length} use cases`)
      if (failed.length) toast(`Could not delete ${failed.map((f) => f.name).join(', ')}`, 'bad')
    },
    onError: (err) => toast(`Delete failed: ${err instanceof Error ? err.message : String(err)}`, 'bad'),
  })
}

export const agentInstruction = (uc: Pick<UseCase, 'id' | 'name'>) =>
  `Add 20 realistic test cases to BIY use case ${uc.id} ("${uc.name}") with biy_cases_add; use the repo's fixtures first, then biy_cases_generate.`

export const shortId = (id: string) => `uc_${id.replace(/-/g, '').slice(-8)}`
