import { Container, SectionHead } from './shared'

const numbers = [
  { n: '135', title: 'models verified', body: 'Text and vision. Capabilities are actually probed, not taken from provider claims.' },
  { n: '29', title: 'on the shortlist', body: 'The current candidates, chosen with the Artificial Analysis Intelligence Index.' },
  { n: '159', title: 'metrics in the bank', body: 'Structured output, accuracy, vision, LLM judges, reliability, latency and cost.' },
]

// A few real ids from the metric bank (contract/fixtures/metrics.json).
const sample = ['json_schema_valid', 'field_accuracy', 'classification_accuracy', 'cer', 'bbox_iou', 'rubric_score', 'pairwise_vs_baseline', 'error_rate', 'e2e_ms', 'cost_per_success_usd']

export default function Catalogue() {
  return (
    <section aria-labelledby="metrics-title" id="metrics" className="scroll-mt-16 border-b border-line/60 py-24 sm:py-32">
      <Container>
        <SectionHead id="metrics-title" badge="Catalogue and metrics" tone="win" title="Measured, not copied from a spec sheet."
          lede="Prices are what the endpoint really charges. The official list price is kept next to it for reference." />

        <dl className="mt-16 grid border-t border-line sm:grid-cols-3">
          {numbers.map((x, i) => (
            <div key={x.n} className={`py-8 sm:px-8 ${i ? 'border-t border-line sm:border-t-0 sm:border-l' : 'sm:pl-0'}`}>
              <dt className="flex items-baseline gap-3">
                <span className="display text-6xl sm:text-7xl">{x.n}</span>
                <span className="text-sm font-medium">{x.title}</span>
              </dt>
              <dd className="mt-4 max-w-xs text-sm leading-relaxed text-muted">{x.body}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 border-t border-line pt-8">
          <p className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">A few from the bank</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {sample.map((id) => (
              <li key={id} className="rounded-md border border-line bg-panel px-2 py-1 font-mono text-[12px] text-muted">{id}</li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  )
}
