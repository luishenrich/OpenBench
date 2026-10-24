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
