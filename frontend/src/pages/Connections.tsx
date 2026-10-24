// Connect a coding agent to BIY over MCP: the key, a snippet per client, and what to run next.
import { useState } from 'react'
import { Button, ErrorNote } from '@/components/ui'
import { SettingsSection } from '@/components/settings/controls'
import { CopyButton, mcpUrl, useMcpKey } from '@/components/connections/mcp'

type Client = 'claude' | 'cursor' | 'other'
const CLIENTS: { key: Client; label: string }[] = [
  { key: 'claude', label: 'Claude Code' },
  { key: 'cursor', label: 'Cursor' },
  { key: 'other', label: 'Codex / other' },
]

function snippet(client: Client, url: string, key: string): { where: string; text: string } {
  if (client === 'claude') {
    return { where: 'Run in a terminal', text: `claude mcp add --transport http biy ${url} --header "Authorization: Bearer ${key}"` }
  }
  if (client === 'cursor') {
    const json = { mcpServers: { biy: { url, headers: { Authorization: `Bearer ${key}` } } } }
    return { where: 'Add to .cursor/mcp.json in your repo', text: JSON.stringify(json, null, 2) }
  }
  return {
    where: 'Any client that speaks Streamable HTTP',
    text: `URL        ${url}\nTransport  Streamable HTTP\nHeader     Authorization: Bearer ${key}`,
  }
}

const SCAN = '/mcp__biy__scan_repo'
const STEPS = [
  { title: 'Finds the LLM calls', body: 'The agent reads your repo and lists every place your product calls a model.' },
  { title: 'Creates use cases here, live', body: 'Each call site shows up under Use cases with its prompt, metrics and test cases.' },
  { title: 'Asks before spending money', body: 'Benchmark runs show a cost estimate first. Nothing runs until you confirm.' },
]

export default function Connections() {
  const k = useMcpKey()
  const [client, setClient] = useState<Client>('claude')
  const [confirming, setConfirming] = useState(false)
  const url = mcpUrl()
  const s = snippet(client, url, k.shown)

  return (
    <div>
      <header className="max-w-2xl">
        <h1 className="display text-4xl sm:text-5xl">Connections</h1>
        <p className="mt-3 text-muted text-pretty">
          Connect your coding agent to BIY over MCP. It scans your product repo and sets up use cases for you.
        </p>
      </header>

      <div className="mt-10">
        <SettingsSection title="Key" help="Your agent sends this key with every request. One key per workspace.">
          <div className="rounded-lg border border-line bg-panel px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <div className="min-w-0 flex-1">
                {k.full ? (
                  <code className="block font-mono text-sm break-all text-fg">{k.full}</code>
                ) : (
                  <code className="font-mono text-sm text-fg">
                    {k.last4 ? <>biy_<span className="text-faint">••••••••••••</span>{k.last4}</> : <span className="text-muted">No key yet</span>}
                  </code>
                )}
                <div className="mt-1 text-xs text-faint">
                  {k.full ? 'Copy it now. It is shown only once.' : k.last4 ? `Ends in ${k.last4}` : 'Create a key to connect an agent.'}
                </div>
              </div>
              {k.full && <CopyButton text={k.full} label="Copy key" variant="primary" />}
              {!confirming && (
                <Button
                  variant="secondary"
                  className="px-2.5 py-1 text-xs"
                  onClick={() => (k.hasKey ? setConfirming(true) : k.rotate.mutate())}
                  disabled={k.rotate.isPending}
                >
                  {k.rotate.isPending ? 'Creating…' : k.hasKey ? 'Replace key' : 'Create key'}
                </Button>
              )}
            </div>
            {confirming && (
              <div role="alertdialog" aria-label="Replace key" className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
                <p className="min-w-0 flex-1 text-sm text-muted">
                  The old key stops working immediately. Agents that use it disconnect until you paste the new one.
                </p>
                <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => setConfirming(false)}>Cancel</Button>
                <Button
                  variant="danger"
                  className="px-2.5 py-1 text-xs"
                  onClick={() => { k.rotate.mutate(); setConfirming(false) }}
                >
                  Replace key
                </Button>
              </div>
            )}
          </div>
          {k.rotate.error && <div className="mt-3"><ErrorNote error={k.rotate.error} /></div>}
        </SettingsSection>

        <SettingsSection title="Add BIY to your agent" help="Pick your client and paste the snippet. The server URL is the same for every client.">
          <div role="tablist" aria-label="Client" className="inline-flex overflow-hidden rounded-md border border-line">
            {CLIENTS.map((c) => (
              <button
                key={c.key}
                role="tab"
                type="button"
                aria-selected={client === c.key}
                onClick={() => setClient(c.key)}
                className={`border-l border-line px-3 py-1.5 text-sm first:border-l-0 ${client === c.key ? 'bg-raised text-fg' : 'text-muted hover:text-fg'}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="mt-3 overflow-hidden rounded-lg border border-line bg-bg">
            <div className="flex items-center justify-between gap-3 border-b border-line bg-panel px-3.5 py-2">
              <span className="text-xs text-muted">{s.where}</span>
              <CopyButton text={s.text} />
            </div>
            <pre className="overflow-x-auto p-3.5 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-words text-muted">{s.text}</pre>
          </div>
          {!k.full && k.hasKey && (
            <p className="mt-2.5 text-xs text-faint">
              The snippet shows your key masked. Replace the key to get a full one you can paste; the API shows a key only once.
            </p>
          )}
        </SettingsSection>

        <SettingsSection title="Then run" help="Open your product repo in the agent and run the scan.">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-bg px-3.5 py-2.5">
            <code className="font-mono text-sm text-fg">{SCAN}</code>
            <CopyButton text={SCAN} />
          </div>
          <ol className="mt-5 grid gap-3 lg:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-lg border border-line bg-panel px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex size-5 items-center justify-center rounded-[5px] border border-line-strong text-[11px] tabular-nums text-muted">{i + 1}</span>
                  <span className="text-sm text-fg">{step.title}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-faint">{step.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-faint">
            To check the connection, run <code className="font-mono text-muted">/mcp</code> in Claude Code: biy should show as connected.
          </p>
        </SettingsSection>
      </div>
    </div>
  )
}
