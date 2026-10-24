// The secondary way to connect: a workspace key sent as an Authorization header (CI, headless, clients without OAuth).
import { useState } from 'react'
import { Button, ErrorNote } from '@/components/ui'
import { ClientTabs, CopyButton, Snippet, mcpUrl, useMcpKey, type Client } from '@/components/connections/mcp'

function keySnippet(client: Client, url: string, key: string): { where: string; text: string } {
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

export function KeyMethod() {
  const k = useMcpKey()
  const [client, setClient] = useState<Client>('claude')
  const [confirming, setConfirming] = useState(false)
  const s = keySnippet(client, mcpUrl(), k.shown)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm text-fg">Key</h3>
        <p className="mt-1 text-xs text-faint">Your agent sends this key with every request. One key per workspace.</p>
        <div className="mt-3 rounded-lg border border-line bg-panel px-4 py-3.5">
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
              <Button variant="danger" className="px-2.5 py-1 text-xs" onClick={() => { k.rotate.mutate(); setConfirming(false) }}>
                Replace key
              </Button>
            </div>
          )}
        </div>
        {k.rotate.error && <div className="mt-3"><ErrorNote error={k.rotate.error} /></div>}
      </div>

      <div>
        <h3 className="text-sm text-fg">Add BIY with the key</h3>
        <div className="mt-3">
          <ClientTabs value={client} onChange={setClient} />
          <Snippet where={s.where} text={s.text} />
        </div>
        {!k.full && k.hasKey && (
          <p className="mt-2.5 text-xs text-faint">
            The snippet shows your key masked. Replace the key to get a full one you can paste; the API shows a key only once.
          </p>
        )}
      </div>
    </div>
  )
}
