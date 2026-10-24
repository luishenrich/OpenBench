import { ModelIcon } from '@/components/ModelIcon'
import { makerOf } from '@/lib/modelMakers'
import { Container, SectionHead } from './shared'

const numbers = [
  { n: '135', title: 'models verified', body: 'Text and vision. Capabilities are actually probed, not taken from provider claims.' },
  { n: '29', title: 'on the shortlist', body: 'The current candidates, chosen with the Artificial Analysis Intelligence Index.' },
  { n: '159', title: 'metrics in the bank', body: 'Structured output, accuracy, vision, LLM judges, reliability, latency and cost.' },
]

// The makers behind catalog/models.json that have a logo, most models first: one real model id each.
// 31 makers in all (via makerOf); the other 8 have no logo and are only counted.
const makerModels = [
  'Qwen/Qwen3.8-27B', 'deepseek-ai/DeepSeek-V4.1-Flash-1017', 'zai-org/GLM-5.3', 'moonshotai/Kimi-K3', 'nvidia/Nemotron-3.5-Super-VL',
  'MiniMaxAI/MiniMax-M3', 'mistralai/mistral-small-2603', 'tencent/hy3', 'meta/muse-glimmer-30b', 'xiaomi/mimo-v2.6-pro',
  'openai/gpt-oss-120b', 'google/gemma-4-31b-it', 'cohere/command-a', 'inclusionai/ling-3.1-flash', 'stepfun/step-5-preview',
  'liquid/lfm-2.5-2.6b:free', 'poolside/laguna-s-2.1', 'NousResearch/Hermes-4-405B', 'arcee-ai/trinity-large-thinking',
  'ibm-granite/granite-4.2-8b', 'meituan/longcat-2.0', 'microsoft/phi-4', 'rekaai/reka-edge',
]
const MAKER_TOTAL = 31

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

        <div className="mt-6 flex flex-col gap-4 border-t border-line pt-8 lg:flex-row lg:items-center lg:gap-8">
          <p className="shrink-0 font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Models we benchmark, by maker</p>
          <ul className="flex flex-wrap items-center gap-2">
            {makerModels.map((id) => (
              <li key={id} className="flex"><ModelIcon model={id} size={16} /><span className="sr-only">{makerOf(id).name}</span></li>
            ))}
            <li className="ml-1 font-mono text-[11px] text-muted">+{MAKER_TOTAL - makerModels.length} more makers</li>
          </ul>
        </div>

        <div className="mt-8 border-t border-line pt-8">
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
