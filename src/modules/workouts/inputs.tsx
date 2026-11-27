import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'

export const fmt = (n: number | null) => (n === null ? '—' : String(n).replace('.', ','))

interface NumberInputProps {
  value: number | null
  onCommit: (value: number | null) => void
  label: string
  decimals?: boolean
}

/**
 * A number field that saves when it loses focus or on Enter. Keyed by the
 * stored value: when the value changes elsewhere (a stepper, a sync), the
 * field starts over from it.
 */
export function NumberInput(props: NumberInputProps) {
  const shown = props.value === null ? '' : String(props.value).replace('.', ',')
  return <NumberField key={shown} shown={shown} {...props} />
}

function NumberField({ value, onCommit, label, decimals = true, shown }: NumberInputProps & { shown: string }) {
  const [text, setText] = useState(shown)
  // Reads what is in the box when leaving it, not the last rendered text.
  const commit = (raw: string) => {
    const clean = raw.trim().replace(',', '.')
    const parsed = clean === '' ? null : Number(clean)
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) return setText(shown)
    const next = parsed === null ? null : decimals ? Math.round(parsed * 100) / 100 : Math.round(parsed)
    if (next !== value) onCommit(next)
  }
  return (
    <input
      className="to-stepper__value"
      inputMode={decimals ? 'decimal' : 'numeric'}
      value={text}
      aria-label={label}
      placeholder="—"
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => commit(e.currentTarget.value)}
      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
    />
  )
}

/** − value +, the way sets are adjusted between sets without typing. The value can still be typed. */
export function Stepper({
  value,
  step,
  label,
  decimals = true,
  onCommit,
}: {
  value: number | null
  step: number
  label: string
  decimals?: boolean
  onCommit: (value: number | null) => void
}) {
  const round = (n: number) => Math.round(n * 100) / 100
  return (
    <div className="to-stepper">
      <button type="button" className="to-stepper__btn" aria-label={`${label}: menos ${fmt(step)}`} onClick={() => onCommit(Math.max(0, round((value ?? 0) - step)))}>
        <Minus size={14} />
      </button>
      <NumberInput value={value} label={label} decimals={decimals} onCommit={onCommit} />
      <button type="button" className="to-stepper__btn" aria-label={`${label}: mais ${fmt(step)}`} onClick={() => onCommit(round((value ?? 0) + step))}>
        <Plus size={14} />
      </button>
    </div>
  )
}
