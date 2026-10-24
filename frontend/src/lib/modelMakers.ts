// Who made a model, from its id. Accepts catalogue ids ("zai-org/GLM-5.3-Flash"), candidate keys
// ("nebius:zai-org/GLM-5.3-Flash", "openrouter:openai/gpt-4.1-mini"), OpenRouter display names
// ("Xiaomi: MiMo-V2.6-Pro") and bare names ("gpt-4.1-mini", "GLM-5.3-Flash").
// Icons are vendored from Lobe Icons into public/model-icons/ (see LICENSE.md there).

export type Maker = { key: string; name: string; icon: string | null }
export type Provider = { key: string; name: string; icon: string | null }

const ICON_DIR = '/model-icons/'

// Maker key -> display name, and whether public/model-icons/<key>.svg exists.
const MAKERS: Record<string, { name: string; icon: boolean }> = {
  qwen: { name: 'Qwen', icon: true },
  deepseek: { name: 'DeepSeek', icon: true },
  moonshot: { name: 'Moonshot AI', icon: true },
  zai: { name: 'Z.ai', icon: true },
  minimax: { name: 'MiniMax', icon: true },
  xiaomi: { name: 'Xiaomi MiMo', icon: true },
  openai: { name: 'OpenAI', icon: true },
  gemma: { name: 'Google Gemma', icon: true },
  gemini: { name: 'Google Gemini', icon: true },
  google: { name: 'Google', icon: true },
  meta: { name: 'Meta', icon: true },
  nvidia: { name: 'NVIDIA', icon: true },
  mistral: { name: 'Mistral AI', icon: true },
  cohere: { name: 'Cohere', icon: true },
  tencent: { name: 'Tencent Hunyuan', icon: true },
  inclusionai: { name: 'inclusionAI', icon: true },
  stepfun: { name: 'StepFun', icon: true },
  liquid: { name: 'Liquid AI', icon: true },
  poolside: { name: 'Poolside', icon: true },
  nousresearch: { name: 'Nous Research', icon: true },
  arcee: { name: 'Arcee AI', icon: true },
  ibm: { name: 'IBM', icon: true },
  meituan: { name: 'Meituan LongCat', icon: true },
  microsoft: { name: 'Microsoft', icon: true },
  reka: { name: 'Reka', icon: true },
  // Known makers without a Lobe icon: they get the letter tile.
  thinkingmachines: { name: 'Thinking Machines', icon: false },
  reflection: { name: 'Reflection AI', icon: false },
  openbmb: { name: 'OpenBMB', icon: false },
  recursive: { name: 'Recursive', icon: false },
  xingchen: { name: 'XingChen', icon: false },
  moondream: { name: 'Moondream', icon: false },
  prismml: { name: 'PrismML', icon: false },
  nexagi: { name: 'Nex AGI', icon: false },
  anthropic: { name: 'Anthropic', icon: false },
  xai: { name: 'xAI', icon: false },
}

// Org prefix (lowercased, the part before the first "/") -> maker key. "google" is resolved by name.
const ORGS: Record<string, string> = {
  qwen: 'qwen',
  'deepseek-ai': 'deepseek',
  deepseek: 'deepseek',
  moonshotai: 'moonshot',
  moonshot: 'moonshot',
  'zai-org': 'zai',
  'z-ai': 'zai',
  zai: 'zai',
  thudm: 'zai',
  zhipuai: 'zai',
  minimaxai: 'minimax',
  minimax: 'minimax',
  xiaomi: 'xiaomi',
  xiaomimimo: 'xiaomi',
  openai: 'openai',
  'meta-llama': 'meta',
  'meta-models': 'meta',
  meta: 'meta',
  facebook: 'meta',
  nvidia: 'nvidia',
  mistralai: 'mistral',
  mistral: 'mistral',
  cohere: 'cohere',
  coherelabs: 'cohere',
  cohereforai: 'cohere',
  tencent: 'tencent',
  inclusionai: 'inclusionai',
  stepfun: 'stepfun',
  'stepfun-ai': 'stepfun',
  liquid: 'liquid',
  liquidai: 'liquid',
  poolside: 'poolside',
  nousresearch: 'nousresearch',
  'arcee-ai': 'arcee',
  arcee: 'arcee',
  'ibm-granite': 'ibm',
  ibm: 'ibm',
  meituan: 'meituan',
  'meituan-longcat': 'meituan',
  microsoft: 'microsoft',
  rekaai: 'reka',
  reka: 'reka',
  thinkingmachines: 'thinkingmachines',
  reflection: 'reflection',
  openbmb: 'openbmb',
  recursive: 'recursive',
  recursivesi: 'recursive',
  'xingchen-agi': 'xingchen',
  moondream: 'moondream',
  'prism-ml': 'prismml',
  'nex-agi': 'nexagi',
  anthropic: 'anthropic',
  'x-ai': 'xai',
}

// Name heuristics, tried in order on the lowercased model name when the org is missing or unknown.
const NAME_RULES: [RegExp, string][] = [
  [/gemma/, 'gemma'],
  [/gemini/, 'gemini'],
  [/deepseek/, 'deepseek'],
  [/qwen|qwq/, 'qwen'],
  [/kimi|moonshot/, 'moonshot'],
  [/minimax/, 'minimax'],
  [/mimo|xiaomi/, 'xiaomi'],
  [/glm|zhipu|z\.ai/, 'zai'],
  [/(^|[^a-z])gpt|chatgpt|^o\d(-|$)|openai/, 'openai'],
  [/llama|muse-|^muse|(^|[^a-z])meta([^a-z]|$)/, 'meta'],
  [/nemotron|nvidia/, 'nvidia'],
  [/mistral|ministral|devstral|magistral|codestral|pixtral/, 'mistral'],
  [/cohere|command-|c4ai|north-|aya-/, 'cohere'],
  [/hunyuan|tencent|^hy[-\d]/, 'tencent'],
  [/^(ling|ring)-|inclusionai/, 'inclusionai'],
  [/^step-?\d|stepfun/, 'stepfun'],
  [/lfm|liquid/, 'liquid'],
  [/laguna|poolside/, 'poolside'],
  [/hermes|nous/, 'nousresearch'],
  [/trinity|arcee/, 'arcee'],
  [/granite/, 'ibm'],
  [/longcat|meituan/, 'meituan'],
  [/^phi-?\d|microsoft/, 'microsoft'],
  [/reka/, 'reka'],
  [/inkling|thinking machines/, 'thinkingmachines'],
  [/reflection|^beam/, 'reflection'],
  [/minicpm/, 'openbmb'],
  [/moondream/, 'moondream'],
  [/recursive|^flint/, 'recursive'],
  [/xingchen|^xing\d/, 'xingchen'],
  [/nex agi|nex-agi|^nex-n/, 'nexagi'],
  [/prismml|prism-ml|bonsai/, 'prismml'],
  [/claude/, 'anthropic'],
  [/grok/, 'xai'],
]

// Serving endpoints that prefix candidate keys ("nebius:...").
const PROVIDERS: Record<string, { name: string; icon: boolean }> = {
  nebius: { name: 'Nebius', icon: true },
  openrouter: { name: 'OpenRouter', icon: true },
}

function maker(key: string): Maker {
  const m = MAKERS[key]
  return { key, name: m.name, icon: m.icon ? `${ICON_DIR}${key}.svg` : null }
}

// Drops a "provider:" prefix. Keeps OpenRouter tags like "cohere/north-mini-code:free" intact,
// because there the colon comes after the org slash.
function stripProvider(raw: string): string {
  const colon = raw.indexOf(':')
  if (colon < 0) return raw
  const head = raw.slice(0, colon).trim().toLowerCase()
  const rest = raw.slice(colon + 1).trim()
  if (!rest || head.includes('/')) return raw
  if (head in PROVIDERS || rest.includes('/')) return rest
  return raw
}

export function makerOf(modelIdOrCandidateKey: string): Maker {
  const raw = stripProvider((modelIdOrCandidateKey ?? '').trim())
  const slash = raw.indexOf('/')
  const org = slash > 0 ? raw.slice(0, slash).toLowerCase() : ''
  const name = (slash > 0 ? raw.slice(slash + 1) : raw).toLowerCase()

  if (org === 'google') {
    if (name.includes('gemma')) return maker('gemma')
    if (name.includes('gemini')) return maker('gemini')
    return maker('google')
  }
  if (org && ORGS[org]) return maker(ORGS[org])

  const whole = raw.toLowerCase()
  for (const [re, key] of NAME_RULES) if (re.test(name) || re.test(whole)) return maker(key)

  if (org) return { key: org, name: raw.slice(0, slash), icon: null }
  const label = raw.match(/^([^:/]+):\s/)?.[1].trim() // OpenRouter display names: "Maker: Model"
  if (label) return { key: label.toLowerCase().replace(/[^a-z0-9]+/g, ''), name: label, icon: null }
  return { key: 'unknown', name: raw || 'Unknown', icon: null }
}

export function providerOf(providerOrCandidateKey: string): Provider {
  const raw = (providerOrCandidateKey ?? '').trim()
  const key = (raw.includes(':') ? raw.slice(0, raw.indexOf(':')) : raw).toLowerCase()
  const p = PROVIDERS[key]
  if (!p) return { key: key || 'unknown', name: key || 'Unknown', icon: null }
  return { key, name: p.name, icon: p.icon ? `${ICON_DIR}${key}.svg` : null }
}
