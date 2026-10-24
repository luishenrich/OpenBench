// Scoring tab: everything that decides the ranking, read top to bottom: the trade-off weights, how quality is
// measured (metrics and jury), and the gates a model must pass.
import type { ReactNode } from 'react'
import { Button, ErrorNote, Panel, Section } from '@/components/ui'
import Weights from '@/components/Weights'
import { InheritBadge, type Source as InheritSource } from '@/components/settings/inherit'
import type { Gate, Profile, UseCase } from '@/types'

const OP: Record<string, string> = { '>=': '≥', '<=': '≤', '>': '>', '<': '<', '==': '=' }
const pctLabel = (v: number) => `${+(v * 100).toFixed(1)}%`

// A gate as a ruler. Thresholds near 0 or 1 (≥ 0.99, ≤ 0.02) would leave a 1–2 % sliver on a 0–100 % scale,
// so the ruler zooms to the last 10 % next to that end and labels both ends: zoomed, never stretched.
function GateRow({ gate, name }: { gate: Gate; name: ReactNode }) {
  const ratio = gate.value >= 0 && gate.value <= 1
  const passUp = gate.op === '>=' || gate.op === '>'
  const op = OP[gate.op] ?? gate.op
  const value = ratio ? pctLabel(gate.value) : String(gate.value)
  let lo = 0
  let hi = 1
  if (ratio && gate.value >= 0.9) lo = 0.9
  else if (ratio && gate.value <= 0.1) hi = 0.1
  const at = ((gate.value - lo) / (hi - lo)) * 100
  const zoomed = hi - lo < 1
  const passWidth = passUp ? 100 - at : at

  return (
    <div className="grid items-center gap-x-8 gap-y-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm">{name}</div>
          <div className="mt-0.5 text-xs text-faint">
            {ratio ? `passes at ${value} ${passUp ? 'or more' : 'or less'}` : `${gate.metric_id} ${op} ${gate.value}`}
          </div>
        </div>
        <div className="title shrink-0 text-2xl">
          <span className="mr-1 text-muted">{op}</span>{value}
        </div>
      </div>
      {ratio && (
        <div aria-hidden>
          <div className="relative h-5 overflow-hidden rounded-[4px] bg-bad/[0.12] text-[10px] leading-5 font-medium">
            <div className="absolute inset-y-0 bg-win/30" style={passUp ? { left: `${at}%`, right: 0 } : { left: 0, width: `${at}%` }} />
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="absolute bottom-0 h-1.5 w-px bg-fg/15" style={{ left: `${(i + 1) * 10}%` }} />
            ))}
            <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-fg" style={{ left: `${at}%` }} />
            {passWidth >= 9 && (
              <span className="absolute inset-y-0 text-center text-win" style={passUp ? { left: `${at}%`, right: 0 } : { left: 0, width: `${at}%` }}>pass</span>
            )}
            <span className={`absolute inset-y-0 px-2 text-bad/90 ${passUp ? 'text-right' : ''}`} style={passUp ? { left: 0, width: `${at}%` } : { left: `${at}%`, right: 0 }}>fail</span>
          </div>
          <div className="mt-1 flex justify-between font-mono text-[10.5px] text-faint">
            <span>{zoomed && lo > 0 ? '… ' : ''}{pctLabel(lo)}</span>
            <span>{pctLabel(hi)}{zoomed && hi < 1 ? ' …' : ''}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export interface ScoringProps {
  uc: UseCase
  profile: Profile
  draft: Profile | null
  setDraft: (p: Profile | null) => void
  onSave: () => void
  saving: boolean
  saveError: unknown
  /** where the weights and the jury come from, with a reset back to the workspace default */
  inherit: { profile: InheritSource; judge: InheritSource } | null
  resetting: boolean
  onReset: (what: 'profile' | 'judge') => void
  metricLabel: (id: string) => ReactNode
  /** "GPT-6 Luna + DeepSeek V4.1 Flash" when a judge metric applies, else null */
  jury: string | null
  settingUp: boolean
}

export default function Scoring(p: ScoringProps) {
  const { uc: u } = p
  const totalWeight = u.metrics.reduce((s, m) => s + m.weight, 0) || 1
  return (
    <div className="max-w-4xl space-y-12">
      <Section
        title="What matters for this job"
        aside={p.draft ? (
          <span className="flex gap-2">
            <Button variant="ghost" onClick={() => p.setDraft(null)}>Discard</Button>
            <Button onClick={p.onSave} disabled={p.saving}>{p.saving ? 'Saving…' : 'Save weights'}</Button>
          </span>
        ) : (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {p.inherit && <InheritBadge source={p.inherit.profile} resetting={p.resetting} onReset={() => p.onReset('profile')} />}
            <span>Drag the dot or pick a preset. The ranking uses these weights.</span>
          </span>
        )}
      >
        <Panel className="p-5 sm:p-6">
          <Weights profile={p.profile} onChange={p.setDraft} />
        </Panel>
        {p.saveError != null && <div className="mt-3"><ErrorNote error={p.saveError} /></div>}
      </Section>

      <Section title="Quality is measured by" aside="Each metric's share of the quality score.">
        <Panel className="divide-y divide-line">
          {u.metrics.length === 0 && <p className="p-4 text-sm text-muted">{p.settingUp ? 'Your agent is still choosing metrics.' : 'No metrics yet. Ask your agent to choose them.'}</p>}
          {u.metrics.map((m) => (
            <div key={m.metric_id} className="grid items-center gap-x-8 gap-y-2 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <span className="text-sm">{p.metricLabel(m.metric_id)}</span>
              <div className="flex items-center gap-3">
                <div className="h-1 flex-1 rounded-full bg-raised">
                  <div className="h-1 rounded-full bg-fg/80" style={{ width: `${(m.weight / totalWeight) * 100}%` }} />
                </div>
                <span className="w-10 text-right text-sm text-muted tabular-nums">{Math.round((m.weight / totalWeight) * 100)}%</span>
              </div>
            </div>
          ))}
          {p.jury && (
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 p-4">
              <p className="max-w-2xl text-xs leading-relaxed text-muted">
                Judged by <span className="text-fg">{p.jury}</span>. Each judge abstains on its own model family; the score is the mean of the judges that vote.
              </p>
              {p.inherit && <InheritBadge source={p.inherit.judge} resetting={p.resetting} onReset={() => p.onReset('judge')} />}
            </div>
          )}
        </Panel>
      </Section>

      <Section title="Must pass" aside="A model that misses a gate is shown but never ranked.">
        <Panel className="divide-y divide-line">
          {u.gates.length === 0 && <p className="p-4 text-sm text-muted">No gates yet. Every model is ranked on the weights alone.</p>}
          {u.gates.map((g) => <GateRow key={g.metric_id + g.op} gate={g} name={p.metricLabel(g.metric_id)} />)}
        </Panel>
      </Section>
    </div>
  )
}
