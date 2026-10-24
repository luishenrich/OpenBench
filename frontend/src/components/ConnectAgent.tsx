// Compact "connect your agent" panel. The full version is pages/Connections.tsx; this stays until the
// use-case list stops using it.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, ErrorNote, Panel } from './ui'
import { copyText, mcpUrl, useMcpKey } from './connections/mcp'

export default function ConnectAgent() {
  const k = useMcpKey()
  const [copied, setCopied] = useState(false)
  const command = `claude mcp add --transport http biy ${mcpUrl()} --header "Authorization: Bearer ${k.shown}"`

  async function copy() {
    if (await copyText(command)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <Panel className="p-5">
      <Badge tone="front">MCP</Badge>
      <h2 className="title mt-4 text-lg">Connect your coding agent</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Add BIY as an MCP server, open your product repo and run <code className="rounded bg-raised px-1 py-0.5 font-mono text-[12px] text-fg">/mcp__biy__scan_repo</code>.
        The agent finds the LLM calls and proposes use cases with metrics and cases. They show up here.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-bg p-3 font-mono text-[11.5px] leading-relaxed break-all whitespace-pre-wrap text-muted">{command}</pre>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={copy}>{copied ? 'Copied' : 'Copy command'}</Button>
        <Button variant="secondary" onClick={() => k.rotate.mutate()} disabled={k.rotate.isPending}>
          {k.hasKey ? 'Replace key' : 'Create key'}
        </Button>
        <Link to="/connections" className="ml-auto text-xs text-muted hover:text-fg">Cursor, Codex and more</Link>
      </div>
      {k.full && <p className="mt-3 text-xs text-front">This key is shown once. Replacing it disconnects agents that use the old one.</p>}
      {k.rotate.error && <div className="mt-3"><ErrorNote error={k.rotate.error} /></div>}
    </Panel>
  )
}
