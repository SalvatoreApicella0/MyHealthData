import { useEffect, useMemo, useRef, useState } from 'react'
import { BadgeInfo, Eye, EyeOff, RotateCcw } from 'lucide-react'
import type { BodyPoint, BodyRegionId, HealthEvent } from '../core/types'
import type { Atlas, SystemId, ViewId } from './anatomy'
import { DEFAULT_VISIBLE, LAYER_PRESETS, SYSTEMS } from './anatomy'
import {
  loadAtlas,
  MODEL_DECOMPRESS_ERROR,
  MODEL_INCOMPLETE_ERROR,
  MODEL_LOAD_ERROR,
} from './modelLoader'
import {
  createBodyScene,
  BODY_SCENE_ERROR_ASSEMBLY,
  BODY_SCENE_ERROR_CONTEXT_LOST,
  BODY_SCENE_ERROR_LOAD,
  type BodySceneHandle,
} from './scene'
import type { BodyViewState } from './scene'
import { partIdsByRegion, regionForTap } from './regionMapping'
import { markersForEvents, WEB_BODY_MODEL_VERSION } from './eventMarkers'
import { useI18n } from '../i18n'
import { BodyCredits } from './credits'

const WEBGL_ERROR_KEY = 'body3d.errorWebgl'
const FALLBACK_PART_COUNT = 2234
const BODY_VIEW_MEMORY_KEY = 'mhd.body.view-state'

type Translate = (key: string, replacements?: Record<string, string | number>) => string

export function bodyAtlasErrorMessage(message: string, t: Translate): string {
  switch (message) {
    case MODEL_LOAD_ERROR:
    case MODEL_DECOMPRESS_ERROR:
    case BODY_SCENE_ERROR_LOAD:
      return t('body3d.errorLoad')
    case MODEL_INCOMPLETE_ERROR:
      return t('body3d.errorIncomplete')
    case BODY_SCENE_ERROR_ASSEMBLY:
      return t('body3d.errorAssembly')
    case BODY_SCENE_ERROR_CONTEXT_LOST:
      return t('body3d.errorContext')
    case WEBGL_ERROR_KEY:
      return t('body3d.errorWebgl')
    default:
      return t('body3d.errorLoad')
  }
}

export interface BodySelection {
  regionId: BodyRegionId
  point: BodyPoint
  partName: string
}

interface BodyAtlasViewerProps {
  events: HealthEvent[]
  selectedRegionId?: BodyRegionId
  onPick: (selection: BodySelection) => void
}

export default function BodyAtlasViewer({ events, selectedRegionId, onPick }: BodyAtlasViewerProps) {
  const { t } = useI18n()
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<BodySceneHandle>()
  const [atlas, setAtlas] = useState<Atlas>()
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [preset, setPreset] = useState<'pain' | 'organs' | 'all'>('pain')
  const [visibleSystems, setVisibleSystems] = useState<SystemId[]>(DEFAULT_VISIBLE)
  const [showSystems, setShowSystems] = useState(false)
  const [showCredits, setShowCredits] = useState(false)
  const pickHandler = useRef(onPick)
  pickHandler.current = onPick
  const visibleSystemsRef = useRef(visibleSystems)
  visibleSystemsRef.current = visibleSystems

  const readViewState = (): BodyViewState | undefined => {
    try {
      const parsed = JSON.parse(window.sessionStorage.getItem(BODY_VIEW_MEMORY_KEY) ?? 'null') as Partial<BodyViewState> | null
      if (!parsed || !Array.isArray(parsed.position) || !Array.isArray(parsed.target) || typeof parsed.view !== 'string') return undefined
      if (parsed.position.length !== 3 || parsed.target.length !== 3) return undefined
      if (!(['three-quarter', 'front', 'side', 'back'] as ViewId[]).includes(parsed.view as ViewId)) return undefined
      if ([...parsed.position, ...parsed.target].some((value) => typeof value !== 'number' || !Number.isFinite(value))) return undefined
      return parsed as BodyViewState
    } catch { return undefined }
  }

  const persistViewState = () => {
    const state = sceneRef.current?.getViewState()
    if (!state) return
    try { window.sessionStorage.setItem(BODY_VIEW_MEMORY_KEY, JSON.stringify(state)) } catch { /* storage disabled */ }
  }

  useEffect(() => {
    let cancelled = false
    loadAtlas()
      .then((loaded) => {
        if (!cancelled) setAtlas(loaded)
      })
      .catch(() => {
        if (!cancelled) setError(MODEL_LOAD_ERROR)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!atlas || !hostRef.current) return
    const host = hostRef.current
    const handle = createBodyScene(host, atlas, {
      onProgress: (percent) => setProgress(percent),
      onError: (message) => setError(message),
      onPick: (partId, point) => {
        const part = atlas.parts.find((candidate) => candidate.id === partId)
        if (!part) return
        const regionId = regionForTap(part, point)
        pickHandler.current({
          regionId,
          partName: part.name,
          point: { ...point, modelVersion: WEB_BODY_MODEL_VERSION, approximateRegionId: regionId },
        })
      },
    })
    if (!handle) {
      setError(WEBGL_ERROR_KEY)
      return
    }
    sceneRef.current = handle
    handle.setVisibleSystems(visibleSystemsRef.current)
    const remembered = readViewState()
    if (remembered) handle.setViewState(remembered)
    return () => {
      persistViewState()
      handle.dispose()
      sceneRef.current = undefined
    }
  }, [atlas])

  useEffect(() => {
    sceneRef.current?.setVisibleSystems(visibleSystems)
  }, [visibleSystems])

  const markers = useMemo(() => markersForEvents(events), [events])

  useEffect(() => {
    sceneRef.current?.setMarkers(markers)
  }, [atlas, markers])

  useEffect(() => {
    if (!atlas || !selectedRegionId) return
    sceneRef.current?.focusParts(partIdsByRegion(atlas, selectedRegionId))
  }, [atlas, selectedRegionId])

  if (error) {
    return (
      <div className="body3d-shell body3d-shell--error" role="alert">
        <p>{bodyAtlasErrorMessage(error, t)}</p>
        <button className="btn btn--primary" onClick={() => window.location.reload()} type="button">
          {t('body3d.reload')}
        </button>
      </div>
    )
  }

  return (
    <div className="body3d-shell">
      <div className="body3d-host" ref={hostRef} />
      {!atlas || progress < 100 ? (
        <div className="body3d-loading" role="status">
          <strong>{t('body3d.loading')}</strong>
          <span>
            {t('body3d.loadingDetail')
              .replace('{percent}', String(progress))
              .replace('{parts}', (atlas ? atlas.parts.length : FALLBACK_PART_COUNT).toLocaleString())}
          </span>
          <div className="body3d-progress">
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      <div className="body3d-toolbar">
        {(['three-quarter', 'front', 'side', 'back'] as ViewId[]).map((view) => (
          <button
            aria-label={t(`body3d.view.${view}`)}
            className="btn btn--small btn--ghost"
            key={view}
            onClick={() => sceneRef.current?.setView(view)}
            type="button"
          >
            {t(`body3d.view.${view}`)}
          </button>
        ))}
        <button
          aria-label={t('body3d.view.reset')}
          className="btn btn--icon btn--ghost"
          onClick={() => sceneRef.current?.resetView()}
          type="button"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      <div className="body3d-layers">
        <div className="body3d-presets" role="group" aria-label={t('body3d.layers')}>
          {LAYER_PRESETS.map((item) => (
            <button
              aria-pressed={preset === item.id}
              className="chip"
              key={item.id}
              onClick={() => {
                setPreset(item.id)
                setVisibleSystems(item.systems)
              }}
              type="button"
            >
              {t(`body3d.preset.${item.id}`)}
            </button>
          ))}
        </div>
        <button
          aria-expanded={showSystems}
          className="btn btn--small btn--ghost"
          onClick={() => setShowSystems((value) => !value)}
          type="button"
        >
          {showSystems ? <EyeOff size={14} /> : <Eye size={14} />} {t('body3d.systems')}
        </button>
        {showSystems ? (
          <ul className="body3d-system-list">
            {SYSTEMS.map((system) => (
              <li key={system.id}>
                <label>
                  <input
                    checked={visibleSystems.includes(system.id)}
                    onChange={(changeEvent) => {
                      setVisibleSystems((current) =>
                        changeEvent.target.checked
                          ? [...current, system.id]
                          : current.filter((id) => id !== system.id),
                      )
                    }}
                    type="checkbox"
                  />
                  <span className="body3d-system-dot" style={{ background: system.color }} />
                  {t(`system.${system.id}`)}
                </label>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <p className="body3d-hint">{t('body3d.tapHint')}</p>

      <button className="btn btn--small btn--ghost body3d-credits-button" onClick={() => setShowCredits(true)} type="button">
        <BadgeInfo size={14} /> {t('body3d.credits')}
      </button>
      {showCredits ? <BodyCredits onClose={() => setShowCredits(false)} /> : null}
    </div>
  )
}
