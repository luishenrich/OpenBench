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

// "nebius:zai-org/GLM-5.3-Flash" → "GLM-5.3-Flash"
export const shortModel = (keyOrModel: string) => keyOrModel.split(':').pop()!.split('/').pop()!

export const providerOf = (key: string) => key.split(':')[0]

export function ago(iso: string | null | undefined): string {
  if (!iso) return ''
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString()
}
