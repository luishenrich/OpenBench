import { useState } from 'react'
import { makerOf, providerOf } from '@/lib/modelMakers'

type TileProps = { icon: string | null; label: string; size: number; className: string }

// A small rounded tile that holds the logo, or the maker's first letter when there is no logo.
function IconTile({ icon, label, size, className }: TileProps) {
  const [broken, setBroken] = useState<string | null>(null)
  const tile = Math.round(size * 1.25)
  const showImg = icon !== null && broken !== icon
  const letter = (label.match(/[a-z0-9]/i)?.[0] ?? '?').toUpperCase()
  return (
    <span
      aria-hidden
      title={label}
      style={{ width: tile, height: tile }}
      className={`inline-flex shrink-0 items-center justify-center rounded-[5px] border border-line bg-raised ${className}`}
    >
      {showImg ? (
        <img
          src={icon}
          alt=""
          aria-hidden
          width={size}
          height={size}
          style={{ width: size, height: size }}
          className="block"
          draggable={false}
          onError={() => setBroken(icon)}
        />
      ) : (
        <span className="font-semibold leading-none text-muted" style={{ fontSize: Math.max(8, Math.round(size * 0.68)) }}>
          {letter}
        </span>
      )}
    </span>
  )
}

/** Maker logo for a model id, candidate key ("nebius:zai-org/GLM-5.3") or bare name ("gpt-4.1-mini"). */
export function ModelIcon({ model, size = 16, className = '' }: { model: string; size?: number; className?: string }) {
  const m = makerOf(model)
  return <IconTile icon={m.icon} label={m.name} size={size} className={className} />
}

/** Logo for a serving endpoint ("nebius", "openrouter", or a candidate key like "nebius:..."). */
export function ProviderIcon({ provider, size = 16, className = '' }: { provider: string; size?: number; className?: string }) {
  const p = providerOf(provider)
  return <IconTile icon={p.icon} label={p.name} size={size} className={className} />
}
