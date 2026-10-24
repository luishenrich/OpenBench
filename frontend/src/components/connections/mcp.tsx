// Shared MCP connection logic: the server URL, the user's key, and a copy button.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui'

export const PROD_ORIGIN = 'https://biy.studypdf.net'

/** Local dev and prod share one database, so a key works against prod either way: always point agents at prod. */
export function mcpUrl(): string {
  const origin = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? PROD_ORIGIN : window.location.origin
  return `${origin}/mcp`
}

/**
 * The MCP key. The API returns a full key only once, right after it's created or replaced;
 * otherwise only its last 4 characters are known.
 */
export function useMcpKey() {
  const qc = useQueryClient()
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const rotate = useMutation({ mutationFn: api.rotateMcpKey, onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }) })
  const full = rotate.data?.key ?? null
  const last4 = full ? full.slice(-4) : me.data?.mcp_key_last4 ?? null
  const masked = last4 ? `biy_…${last4}` : null
  return {
    me,
    rotate,
    /** The full key, only right after Replace key */
    full,
    last4,
    /** What snippets should contain: the full key when known, else the masked key or a placeholder */
    shown: full ?? masked ?? '<create a key>',
    hasKey: last4 != null,
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false // clipboard blocked; the text is still selectable
  }
}

export function CopyButton({ text, label = 'Copy', variant = 'secondary' }: { text: string; label?: string; variant?: 'primary' | 'secondary' }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant={variant}
      className="px-2.5 py-1 text-xs"
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }
      }}
    >
      {copied ? 'Copied' : label}
    </Button>
  )
}

export type Client = 'claude' | 'cursor' | 'other'
const CLIENTS: { key: Client; label: string }[] = [
  { key: 'claude', label: 'Claude Code' },
  { key: 'cursor', label: 'Cursor' },
  { key: 'other', label: 'Codex / other' },
]

export function ClientTabs({ value, onChange }: { value: Client; onChange: (c: Client) => void }) {
  return (
    <div role="tablist" aria-label="Client" className="inline-flex overflow-hidden rounded-md border border-line">
      {CLIENTS.map((c) => (
        <button
          key={c.key}
          role="tab"
          type="button"
          aria-selected={value === c.key}
          onClick={() => onChange(c.key)}
          className={`border-l border-line px-3 py-1.5 text-sm first:border-l-0 ${value === c.key ? 'bg-raised text-fg' : 'text-muted hover:text-fg'}`}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}

/** A copyable code block with a caption saying where it goes. */
export function Snippet({ where, text }: { where: string; text: string }) {
  return (
    <div role="tabpanel" className="mt-3 overflow-hidden rounded-lg border border-line bg-bg">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-panel px-3.5 py-2">
        <span className="text-xs text-muted">{where}</span>
        <CopyButton text={text} />
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-words text-muted">{text}</pre>
    </div>
  )
}
