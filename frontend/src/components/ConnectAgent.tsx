// Compact "connect your agent" panel. The full version (Cursor, other clients, keys) is pages/Connections.tsx;
// this stays until the use-case list stops using it.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Panel } from './ui'
import { copyText, mcpUrl } from './connections/mcp'

export default function ConnectAgent() {
  const [copied, setCopied] = useState(false)
  const command = `claude mcp add --transport http biy ${mcpUrl()}`

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
      <p className="mt-2 text-xs text-faint">
        Then run <code className="font-mono text-muted">/mcp</code>, choose biy, Authenticate. Your browser opens to approve.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={copy}>{copied ? 'Copied' : 'Copy command'}</Button>
        <Link to="/connections" className="ml-auto text-xs text-muted hover:text-fg">Cursor, keys and more</Link>
      </div>
    </Panel>
  )
}
