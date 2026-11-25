import { createElement, type ComponentType } from 'react'
import type { IconProps } from '@core/api/types'

/** A module icon, or its initial when the module ships none. */
export function ModuleIcon({
  icon,
  label,
  size,
  boxed,
}: {
  icon?: ComponentType<IconProps>
  label: string
  size: number
  boxed?: boolean
}) {
  const inner = icon ? (
    createElement(icon, { size, strokeWidth: 1.8 })
  ) : (
    <span
      className="to-initial"
      style={{ width: size, height: size, fontSize: size * 0.6 }}
      aria-hidden
    >
      {label.charAt(0)}
    </span>
  )
  return boxed ? <span className="to-iconbox">{inner}</span> : inner
}
