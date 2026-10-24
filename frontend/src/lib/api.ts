import type {
  Case, CatalogModel, Estimate, Me, MetricInfo, ResultsPage, Run, RunBrief, RunIn, UseCase, UseCasePatch,
} from '@/types'
import { FIXTURES } from './mode'
import { supabase } from './supabase'
import * as fx from './fixtures'

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = data?.detail
    const message = typeof detail === 'string' ? detail : `Request failed (${res.status})`
    throw new ApiError(res.status, message, data)
  }
  return data as T
}

const live = {
  me: () => request<Me>('GET', '/me'),
  rotateMcpKey: () => request<{ key: string }>('POST', '/me/mcp-key'),
  models: () => request<CatalogModel[]>('GET', '/models?shortlist=true'),
  metrics: () => request<MetricInfo[]>('GET', '/metrics'),
  useCases: () => request<UseCase[]>('GET', '/use-cases'),
  useCase: (id: string) => request<UseCase>('GET', `/use-cases/${id}`),
  updateUseCase: (id: string, patch: UseCasePatch) => request<UseCase>('PATCH', `/use-cases/${id}`, patch),
  cases: (id: string) => request<Case[]>('GET', `/use-cases/${id}/cases`),
  runs: (id: string) => request<RunBrief[]>('GET', `/use-cases/${id}/runs`),
  estimate: (req: RunIn) => request<Estimate>('POST', '/runs/estimate', req),
  startRun: (req: RunIn) => request<Run>('POST', '/runs', req),
  run: (id: string) => request<Run>('GET', `/runs/${id}`),
  cancelRun: (id: string) => request<Run>('POST', `/runs/${id}/cancel`),
  results: (id: string, params: { candidate_key?: string; case_id?: string; cursor?: string } = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][])
    return request<ResultsPage>('GET', `/runs/${id}/results?${q}`)
  },
}

export type Api = typeof live
export const api: Api = FIXTURES ? fx.fixtureApi : live
