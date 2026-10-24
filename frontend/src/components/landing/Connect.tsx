import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Code, Container, SectionHead, linkPrimary } from './shared'

// OAuth: no key in the command. Claude Code opens the BIY sign-in when you authenticate.
const PARTS = ['claude mcp add', '--transport http', 'biy', 'https://biy.studypdf.net/mcp']
const COMMAND = PARTS.join(' ')

export default function Connect() {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(COMMAND)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked; the command is still selectable
    }
  }

  return (
    <section aria-labelledby="connect-title" id="connect" className="scroll-mt-16 border-b border-line/60 py-20 sm:py-28">
      <Container className="grid gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
        <SectionHead id="connect-title" badge="MCP" tone="front" title="Connect your agent."
          lede="BIY is an MCP server. Any coding agent that speaks MCP over HTTP can use it; this is the command for Claude Code." />

        <div className="lg:pt-12">
          <ol className="space-y-8">
            <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
              <span className="font-mono text-xs leading-6 text-faint">01</span>
              <div className="min-w-0">
                <p className="font-medium">Add the server</p>
                {/* the terminal: hairline light on its edge and a little coral light pooled under it */}
                <div className="lp-pool mt-3">
                <div className="lp-hairline rounded-lg border border-line bg-panel">
                  <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-muted">
                    <span className="text-faint select-none">$ </span>
                    {/* each part stays whole so a narrow screen wraps between flags, never inside one */}
                    {PARTS.map((part, i) => <span key={part}>{i ? ' ' : ''}<span className="inline-block whitespace-nowrap">{part}</span></span>)}
                    <span aria-hidden className="lp-caret ml-1 inline-block h-[1.1em] w-[0.5em] translate-y-[0.18em] bg-front/80" />
                  </pre>
                  <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5">
                    <span className="font-mono text-[11px] text-faint">claude code</span>
                    <button type="button" onClick={copy}
                      className={`inline-flex items-center gap-1.5 rounded-md border bg-raised px-2.5 py-1 text-xs font-medium transition-colors hover:border-line-strong ${copied ? 'border-win/40 text-win' : 'border-line text-fg'}`}>
                      {copied && <svg aria-hidden viewBox="0 0 12 12" className="size-3"><path d="M2.5 6.5l2.2 2.2L9.5 3.5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                </div>
                <p className="sr-only" aria-live="polite">{copied ? 'Command copied' : ''}</p>
              </div>
            </li>
            <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
              <span className="font-mono text-xs leading-6 text-faint">02</span>
              <div>
                <p className="font-medium">Authenticate</p>
                <p className="mt-1 text-sm text-muted">
                  Then run <Code>/mcp</Code> → Authenticate. You sign in to BIY in the browser; there is no key to paste.
                </p>
              </div>
            </li>
            <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
              <span className="font-mono text-xs leading-6 text-faint">03</span>
              <div>
                <p className="font-medium">Open your repo and scan it</p>
                <p className="mt-1 text-sm text-muted">
                  Run <Code>/mcp__biy__scan_repo</Code>. The proposed use cases show up in BIY, ready to benchmark.
                </p>
              </div>
            </li>
          </ol>
          <div className="mt-10 pl-11">
            <Link to="/login" className={`${linkPrimary} lp-cta`}>Sign in</Link>
          </div>
        </div>
      </Container>
    </section>
  )
}
