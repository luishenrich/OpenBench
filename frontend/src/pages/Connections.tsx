// Connect a coding agent to BIY over MCP. Primary: OAuth (the client opens a browser to sign in and approve).
// Secondary: a workspace key sent as a header, for CI, headless runs and clients without OAuth.
import { useState, type ReactNode } from 'react'
import { SettingsSection } from '@/components/settings/controls'
import { Tag } from '@/components/ui'
import { KeyMethod } from '@/components/connections/KeyMethod'
import { ClientTabs, CopyButton, Snippet, mcpUrl, type Client } from '@/components/connections/mcp'

function oauthSnippet(client: Client, url: string): { where: string; text: string; then: ReactNode } {
  if (client === 'claude') {
    return {
      where: 'Run in a terminal',
      text: `claude mcp add --transport http biy ${url}`,
      then: <>Then run <code className="font-mono text-fg">/mcp</code>, choose biy, Authenticate. Your browser opens to approve.</>,
    }
  }
  if (client === 'cursor') {
    return {
      where: 'Add to .cursor/mcp.json in your repo',
      text: JSON.stringify({ mcpServers: { biy: { url } } }, null, 2),
      then: 'Then Cursor prompts you to sign in. Your browser opens to approve.',
    }
  }
  return { where: 'Server URL', text: url, then: 'Any MCP client with OAuth support: just the URL. It opens your browser to sign in.' }
}

// Remove once the MCP server's OAuth (401 + WWW-Authenticate) is live in production.
const ROLLOUT_NOTE = 'OAuth sign-in is rolling out; if your client says the server needs no auth or fails, use a key.'

const SCAN = '/mcp__biy__scan_repo'
const STEPS = [
  { title: 'Finds the LLM calls', body: 'The agent reads your repo and lists every place your product calls a model.' },
  { title: 'Creates use cases here, live', body: 'Each call site shows up under Use cases with its prompt, metrics and test cases.' },
  { title: 'Asks before spending money', body: 'Benchmark runs show a cost estimate first. Nothing runs until you confirm.' },
]

export default function Connections() {
  const [client, setClient] = useState<Client>('claude')
  const [keyOpen, setKeyOpen] = useState(false)
  const url = mcpUrl()
  const s = oauthSnippet(client, url)

  return (
    <div>
      <header className="max-w-2xl">
        <h1 className="display text-4xl sm:text-5xl">Connections</h1>
        <p className="mt-3 text-muted text-pretty">
          Connect your coding agent to BIY over MCP. It scans your product repo and sets up use cases for you.
        </p>
      </header>

      <div className="mt-10">
        <SettingsSection
          title="Add BIY to your agent"
          help="Add the server, then sign in from your agent. No key to copy: your browser opens to approve the connection."
        >
          <div className="flex flex-wrap items-center gap-3">
            <ClientTabs value={client} onChange={setClient} />
            <Tag tone="win">Recommended</Tag>
          </div>
          <Snippet where={s.where} text={s.text} />
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {s.then}
          </p>
          {ROLLOUT_NOTE && <p className="mt-4 text-xs text-faint">{ROLLOUT_NOTE}</p>}
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

        <SettingsSection title="Use a key instead" help="For CI, headless runs and clients without OAuth. The agent sends a workspace key with every request.">
          <button
            type="button"
            aria-expanded={keyOpen}
            aria-controls="key-method"
            onClick={() => setKeyOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-panel px-4 py-3 text-left text-sm text-muted hover:border-line-strong hover:text-fg"
          >
            <span>{keyOpen ? 'Hide key setup' : 'Set up with a key'}</span>
            <span aria-hidden className={`text-faint transition-transform ${keyOpen ? 'rotate-90' : ''}`}>›</span>
          </button>
          {keyOpen && <div id="key-method" className="mt-5"><KeyMethod /></div>}
        </SettingsSection>
      </div>
    </div>
  )
}
