import type { Goal, ProfileFacts, Signal, SignalKey } from '@core/api'

/**
 * Notes for today's workout from the rest of Saúde: how the night and the
 * energy were (from the day's check-in) and whether the week's eating
 * backs the goal (from Refeições). Fixed thresholds, plainly stated.
 */
export type ReadinessNote =
  | { kind: 'light'; sleep: number | null; energy: number | null }
  | { kind: 'ready' }
  | { kind: 'underfed'; kcal: number; target: number; days: number }
  | { kind: 'lowProtein'; protein: number; target: number; days: number }
  | { kind: 'overfed'; kcal: number; target: number; days: number }

export function readinessNotes(signals: Partial<Record<SignalKey, Signal>>, facts: Pick<ProfileFacts, 'kcal' | 'protein'>, goal: Goal | null): ReadinessNote[] {
  const notes: ReadinessNote[] = []
  const sleep = signals.sleep?.value ?? null
  const energy = signals.energy?.value ?? null
  if ((sleep !== null && sleep < 6) || (energy !== null && energy <= 2)) notes.push({ kind: 'light', sleep, energy })
  else if (sleep !== null && sleep >= 7 && energy !== null && energy >= 4) notes.push({ kind: 'ready' })

  const intake = signals.intake
  if (intake && facts.kcal) {
    const days = intake.days ?? 0
    if ((goal === 'gain' || goal === 'strength') && intake.value < facts.kcal * 0.9) notes.push({ kind: 'underfed', kcal: intake.value, target: facts.kcal, days })
    if (goal === 'lose' && intake.value > facts.kcal * 1.1) notes.push({ kind: 'overfed', kcal: intake.value, target: facts.kcal, days })
  }
  if (intake?.value2 !== undefined && facts.protein && intake.value2 < facts.protein * 0.8 && goal !== null)
    notes.push({ kind: 'lowProtein', protein: intake.value2, target: facts.protein, days: intake.days ?? 0 })
  return notes
}
