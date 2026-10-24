import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { Button, ErrorNote, Panel } from './ui'

export default function ConnectAgent() {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const rotate = useMutation({ mutationFn: api.rotateMcpKey })
  const [copied, setCopied] = useState(false)
  const key = rotate.data?.key
  const shownKey = key ?? (me.data?.mcp_key_last4 ? `biy_…${me.data.mcp_key_last4}` : '<create a key>')
  const command = `claude mcp add --transport http biy ${window.location.origin}/mcp --header "Authorization: Bearer ${shownKey}"`

  async function copy() {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked; the command is still selectable
    }
  }

  return (
    <Panel className="p-5">
      <h2 className="font-semibold">Connect your coding agent</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Add BIY as an MCP server, open your product repo, and run <code className="rounded bg-paper px-1 py-0.5 text-ink">/mcp__biy__scan_repo</code>.
        The agent finds the LLM calls, proposes use cases with metrics and cases, and they show up here.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-md bg-ink p-3 text-xs leading-relaxed whitespace-pre-wrap break-all text-white/90">{command}</pre>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={copy}>{copied ? 'Copied' : 'Copy command'}</Button>
        <Button variant="ghost" onClick={() => rotate.mutate()} disabled={rotate.isPending}>
          {me.data?.mcp_key_last4 ? 'Replace key' : 'Create key'}
        </Button>
      </div>
      {key && <p className="mt-3 text-xs text-bad">This key is shown once. Replacing it disconnects agents that use the old one.</p>}
      {rotate.error && <div className="mt-3"><ErrorNote error={rotate.error} /></div>}
    </Panel>
  )
}
