export const pct = (x: number | null | undefined, digits = 1) =>
  x == null ? '–' : `${(x * 100).toFixed(digits)}%`

export const num = (x: number | null | undefined, digits = 3) => (x == null ? '–' : x.toFixed(digits))

export function usd(x: number | null | undefined): string {
  if (x == null) return '–'
  if (x === 0) return '$0'
  if (Math.abs(x) >= 100) return `$${Math.round(x).toLocaleString('en-US')}`
  if (Math.abs(x) >= 0.1) return `$${x.toFixed(2)}`
  if (Math.abs(x) >= 0.01) return `$${x.toFixed(3)}`
  return `$${Number(x.toPrecision(2))}`
}

export function ms(x: number | null | undefined): string {
  if (x == null) return '–'
  return x >= 1000 ? `${(x / 1000).toFixed(x >= 10000 ? 0 : 1)} s` : `${Math.round(x)} ms`
}

// "nebius:zai-org/GLM-5.3-Flash" → "GLM-5.3-Flash"; a reasoning-effort suffix ("…@medium") is dropped
// "openrouter:deepseek/deepseek-v4-flash:nitro@medium" -> "deepseek-v4-flash:nitro". Only the provider prefix is
// stripped: a trailing ":nitro" / ":floor" / ":free" is an OpenRouter routing variant and stays visible.
export const shortModel = (keyOrModel: string) =>
  keyOrModel.split('@')[0].replace(/^(nebius|openrouter|openai):/, '').split('/').pop()!

// Reasoning effort is part of a model's identity: "openrouter:openai/gpt-6.1-sol@medium", or params.reasoning_effort.
export function effortOf(keyOrModel: string | null | undefined, params?: Record<string, unknown> | null): string | null {
  const p = params?.reasoning_effort
  if (typeof p === 'string' && p) return p
  const at = keyOrModel?.lastIndexOf('@') ?? -1
  return keyOrModel && at > 0 ? keyOrModel.slice(at + 1) : null
}

// Effort from the run's candidate list when the key itself doesn't carry it
export function effortIn(key: string, candidates: { provider: string; model: string; params?: Record<string, unknown> }[] = []): string | null {
  const own = effortOf(key)
  if (own) return own
  const bare = key.split('@')[0]
  const c = candidates.find((m) => `${m.provider}:${m.model}` === bare)
  return effortOf(null, c?.params)
}

export const compact = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)))

export const providerOf = (key: string) => key.split(':')[0]

export function ago(iso: string | null | undefined): string {
  if (!iso) return ''
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString()
}
