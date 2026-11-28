import { useCallback, useRef, useState } from 'react'
import { Check, Plus, ShieldAlert, Sparkles, Trash2, UserRound } from 'lucide-react'
import { Badge, Button, toLocalISODate, useCollection, useOpenHref, useProfile, useT, type Envelope } from '@core/api'
import { CATALOG } from './catalog'
import { useGuidance, useRoutines, useTrainingSettings, type UsedTemplate } from './data'
import { GuidanceNote } from './guidancenote'
import { Fold } from './fold'
import type { Routine } from './schema'
import { adaptTemplate, rankTemplates, TEMPLATES } from './templates'

/** Tiles a row holds at this width, the same rule the grid uses (240px + 12px gap). */
const columnsFor = (width: number) => Math.max(1, Math.floor((width + 12) / (240 + 12)))

/**
 * Planos prontos. A plan in use leaves the suggestions and is listed above
 * them, with when it was loaded and a way to take it out again; the next
 * plan moves into its place, so the grid stays full at any width.
 */
export function ReadyPlans() {
  const t = useT()
  const routines = useRoutines()
  const [settings, setSettings] = useTrainingSettings()
  const { create, remove } = useCollection<Routine>('routines')
  const [columns, setColumns] = useState(3)
  const observer = useRef<ResizeObserver | null>(null)
  // A callback ref: the grid mounts only once the fold is opened.
  const gridRef = useCallback((grid: HTMLDivElement | null) => {
    observer.current?.disconnect()
    observer.current = null
    if (!grid) return
    observer.current = new ResizeObserver(([entry]) => setColumns(columnsFor(entry.contentRect.width)))
    observer.current.observe(grid)
  }, [])
  const [showAll, setShowAll] = useState(false)
  const [justUsed, setJustUsed] = useState<string | null>(null)

  const existing = new Set(routines.map((r) => r.id))
  // A plan stays "in use" while any routine it created is still there.
  const used = ((settings.templates ?? []) as UsedTemplate[])
    .map((u) => ({
      ...u,
      routines: u.routines.filter((id) => existing.has(id)),
    }))
    .filter((u) => u.routines.length > 0 && TEMPLATES.some((tpl) => tpl.id === u.id))
  const usedIds = new Set(used.map((u) => u.id))
  const { profile } = useProfile()
  const openHref = useOpenHref()
  const guidance = useGuidance()
  const knowsYou = Boolean(profile.days || profile.level || profile.place || profile.goal)
  // Best fit first, from Meus dados; without it, the usual order.
  const ranked = rankTemplates(
    TEMPLATES.filter((tpl) => !usedIds.has(tpl.id)),
    profile,
    guidance,
  )
  const available = ranked.map((r) => r.template)
  const fitOf = new Map(ranked.map((r) => [r.template.id, r.fit]))
  // A plan "fits" when it matches where you train and most of the rest.
  const isFit = (id: string) => {
    const fit = fitOf.get(id)
    return Boolean(knowsYou && fit && fit.score >= 5 && fit.reasons.length >= 2 && !fit.warnings.some((w) => w.avoid > 0))
  }

  // One full row; two when the rows are short (phone, narrow window).
  const fits = columns * (columns <= 2 ? 2 : 1)
  const shown = showAll ? available : available.slice(0, fits)
  const hidden = available.length - shown.length

  const nextOrder = () => (routines.length ? Math.max(...routines.map((r) => r.data.order)) + 1 : 0)

  const applyTemplate = async (id: string) => {
    const template = TEMPLATES.find((tpl) => tpl.id === id)!
    const ids: string[] = []
    let order = nextOrder()
    // Loaded as it suits this person: exercises to avoid swapped, heavy sets eased for high pressure.
    const adapted = adaptTemplate(template, guidance, CATALOG, profile.place ?? template.place)
    for (const routine of adapted.routines) ids.push(await create({ ...routine, order: order++ }))
    const kept = used.filter((u) => u.id !== id)
    await setSettings({
      templates: [
        ...kept,
        {
          id,
          at: toLocalISODate(new Date()),
          routines: ids,
          swaps: adapted.swaps.length + adapted.lightened,
        },
      ],
      ...(settings.mode === 'rotation' ? { rotation: [...settings.rotation, ...ids] } : {}),
    })
    setJustUsed(id)
  }

  const removeTemplate = async (entry: UsedTemplate) => {
    const template = TEMPLATES.find((tpl) => tpl.id === entry.id)!
    if (
      !confirm(
        t('templates.removeConfirm', {
          name: template.name,
          count: entry.routines.length,
        }),
      )
    )
      return
    for (const id of entry.routines) await remove(id)
    await setSettings({
      templates: used.filter((u) => u.id !== entry.id),
      rotation: settings.rotation.filter((id) => !entry.routines.includes(id)),
    })
  }

  const routineName = (id: string) => routines.find((r: Envelope<Routine>) => r.id === id)?.data.name

  return (
    <Fold id="plans" title={t('templates.title')} summary={used.length ? t('templates.inUseCount', { count: used.length }) : undefined}>
      {used.length > 0 && (
        <div className="to-usedplans">
          {used.map((entry) => {
            const template = TEMPLATES.find((tpl) => tpl.id === entry.id)!
            return (
              <div key={entry.id} className={`to-usedplan${justUsed === entry.id ? ' is-new' : ''}`}>
                <span className="to-usedplan__check">
                  <Check size={14} />
                </span>
                <div className="to-usedplan__main">
                  <strong>{template.name}</strong>
                  <span className="to-muted">
                    {t('templates.usedOn', {
                      date: entry.at.split('-').reverse().join('/'),
                    })}{' '}
                    · {entry.routines.map(routineName).filter(Boolean).join(', ')}
                  </span>
                  {(entry.swaps ?? 0) > 0 && (
                    <span className="to-usedplan__swaps">
                      <ShieldAlert size={12} /> {t('templates.adapted', { count: entry.swaps })}
                    </span>
                  )}
                </div>
                <Button variant="ghost" onClick={() => void removeTemplate(entry)} title={t('templates.remove')}>
                  <Trash2 size={14} />
                  <span className="to-usedplan__label">{t('templates.remove')}</span>
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {available.length > 0 ? (
        <>
          <p className="to-muted">{t(used.length ? 'templates.bodyMore' : 'templates.body')}</p>
          <GuidanceNote guidance={guidance} goal={profile.goal} />
          {!knowsYou && (
            <button type="button" className="to-plans__hint" onClick={() => openHref('/health/me')}>
              <UserRound size={14} />
              {t('templates.fillProfile')}
            </button>
          )}
          <div ref={gridRef} className="to-plans">
            {shown.map((template) => (
              <article key={template.id} className={`to-tile${isFit(template.id) ? ' is-fit' : ''}`}>
                {isFit(template.id) && (
                  <span className="to-tile__fit">
                    <Badge tone="positive">
                      <Sparkles size={12} /> {t('templates.fit')}
                    </Badge>
                    <span className="to-muted">
                      {fitOf
                        .get(template.id)!
                        .reasons.map((r) => t(`templates.reason.${r}`))
                        .join(' · ')}
                    </span>
                  </span>
                )}
                <h3 className="to-tile__title">{template.name}</h3>
                <span className="to-muted">{template.description}</span>
                <span className="to-tile__facts">
                  {t('templates.days', { count: template.days })} · {t(`templates.place.${template.place}`)} · {template.levels.map((l) => t(`templates.level.${l}`)).join(' / ')}
                </span>
                {(() => {
                  const fit = fitOf.get(template.id)!
                  const avoid = fit.warnings.reduce((n, w) => n + w.avoid, 0)
                  const caution = fit.warnings.reduce((n, w) => n + w.caution, 0)
                  if (!avoid && !caution && !fit.heavy) return null
                  return (
                    <span className="to-tile__warn" title={fit.warnings.map((w) => t(`flag.${w.restriction}`)).join(', ')}>
                      <ShieldAlert size={12} />
                      {[avoid > 0 && t('templates.willSwap', { count: avoid }), caution > 0 && t('templates.withCare', { count: caution }), fit.heavy > 0 && t('templates.heavy')]
                        .filter(Boolean)
                        .join(' · ')}{' '}
                      <span className="to-muted">({fit.warnings.map((w) => t(`flag.${w.restriction}`)).join(', ') || t('flag.hypertension')})</span>
                    </span>
                  )
                })()}
                <span className="to-list__meta">
                  {template.routines.map((r) => (
                    <span key={r.name}>{r.name}</span>
                  ))}
                </span>
                <Button onClick={() => void applyTemplate(template.id)}>
                  <Plus size={14} />
                  {t('templates.use')}
                </Button>
              </article>
            ))}
          </div>
          {(hidden > 0 || showAll) && available.length > fits && (
            <Button variant="ghost" className="to-plans__more" onClick={() => setShowAll((v) => !v)}>
              {showAll ? t('templates.fewer') : t('templates.more', { count: hidden })}
            </Button>
          )}
        </>
      ) : (
        <p className="to-muted">{t('templates.allUsed')}</p>
      )}
    </Fold>
  )
}
