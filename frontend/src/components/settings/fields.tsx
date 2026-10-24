// Targets, candidate pool and run defaults.
import type { CandidatePool, Profile, Provider } from '@/types'
import { ProviderIcon } from '@/components/ModelIcon'
import { NumberField, Row, Switch } from './controls'
import { POOL_PROVIDERS } from './defaults'

const TARGETS: { key: string; label: string; unit?: string; prefix?: string }[] = [
  { key: 'ttft_ms_p95', label: 'Target', unit: 'ms' },
  { key: 'ttft_ms_p95_max', label: 'Worst acceptable', unit: 'ms' },
  { key: 'cost_per_call_usd', label: 'Target', prefix: '$' },
  { key: 'cost_per_call_usd_max', label: 'Worst acceptable', prefix: '$' },
]

export function Targets({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  const set = (key: string, v: number | null) => {
    const targets = { ...profile.targets }
    if (v == null) delete targets[key]
    else targets[key] = v
    onChange({ ...profile, targets })
  }
  const group = (title: string, hint: string, keys: typeof TARGETS) => (
    <div className="rounded-lg border border-line bg-panel px-4 py-3.5">
      <div className="text-sm text-fg">{title}</div>
      <div className="mt-0.5 text-xs text-faint">{hint}</div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
        {keys.map((t) => (
          <label key={t.key} className="flex flex-col gap-1">
            <span className="text-xs text-muted">{t.label}</span>
            <NumberField
              label={`${title}: ${t.label}`}
              value={profile.targets[t.key] ?? null}
              onChange={(v) => set(t.key, v)}
              unit={t.unit}
              prefix={t.prefix}
              min={0}
              width="w-24"
            />
          </label>
        ))}
      </div>
    </div>
  )
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {group('Time to first token', 'p95, per call', TARGETS.slice(0, 2))}
      {group('Cost', 'Per call, in USD', TARGETS.slice(2))}
    </div>
  )
}

export function Pool({ value, onChange }: { value: CandidatePool; onChange: (v: CandidatePool) => void }) {
  const toggleProvider = (p: Provider) => {
    const excluded = value.exclude_providers.includes(p)
    onChange({ ...value, exclude_providers: excluded ? value.exclude_providers.filter((x) => x !== p) : [...value.exclude_providers, p] })
  }
  const included = POOL_PROVIDERS.filter((p) => !value.exclude_providers.includes(p.key))
  return (
    <div className="divide-y divide-line">
      <Row label="Shortlist only" hint="Only models the team has verified for text, JSON and tools.">
        <Switch checked={value.shortlist_only} onChange={(v) => onChange({ ...value, shortlist_only: v })} label="Shortlist only" />
      </Row>
      <Row label="Serve candidates from" hint="Turn a provider off to leave its models out.">
        <div className="flex gap-2">
          {POOL_PROVIDERS.map((p) => {
            const on = !value.exclude_providers.includes(p.key)
            const last = on && included.length === 1
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={on}
                disabled={last}
                title={last ? 'At least one provider stays on' : undefined}
                onClick={() => toggleProvider(p.key)}
                className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-sm transition-colors disabled:cursor-not-allowed ${
                  on ? 'border-fg/40 bg-raised text-fg' : 'border-line text-faint line-through decoration-faint hover:text-muted'
                }`}
              >
                <ProviderIcon provider={p.key} size={12} className={on ? '' : 'opacity-50'} />
                {p.name}
              </button>
            )
          })}
        </div>
      </Row>
      <Row label="Max output price" hint="Leave empty for no limit.">
        <NumberField
          label="Max output price per 1M tokens"
          value={value.max_output_usd_per_1m}
          onChange={(v) => onChange({ ...value, max_output_usd_per_1m: v })}
          prefix="$"
          unit="/ 1M output tokens"
          placeholder="No limit"
          min={0}
          width="w-20"
        />
      </Row>
    </div>
  )
}

export function Runs({
  repeats, maxCost, onRepeats, onMaxCost,
}: { repeats: number; maxCost: number | null; onRepeats: (n: number) => void; onMaxCost: (v: number | null) => void }) {
  return (
    <div className="divide-y divide-line">
      <Row label="Repeats" hint="How often each case runs per model. More repeats, tighter confidence intervals.">
        <div role="radiogroup" aria-label="Repeats" className="inline-flex overflow-hidden rounded-md border border-line">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={repeats === n}
              onClick={() => onRepeats(n)}
              className={`w-9 border-l border-line py-1 text-sm tabular-nums first:border-l-0 ${
                repeats === n ? 'bg-raised text-fg' : 'text-muted hover:text-fg'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </Row>
      <Row label="Cost cap per run" hint="Runs estimated above this ask before they start. Empty means no cap.">
        <NumberField label="Cost cap per run" value={maxCost} onChange={onMaxCost} prefix="$" placeholder="No cap" min={0} width="w-24" />
      </Row>
    </div>
  )
}
