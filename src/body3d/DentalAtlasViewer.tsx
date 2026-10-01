import { Component, useEffect, useRef, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { decodeModelResponse, loadAtlas } from './modelLoader'
import type { Atlas } from './anatomy'

interface DentalAtlasViewerProps {
  state: Map<string, string>
  selectedTooth: string | null
  onSelect: (tooth: string) => void
  language?: 'it' | 'en'
}

const dentalCameraMemory: { position: THREE.Vector3; target: THREE.Vector3 } = {
  position: new THREE.Vector3(0, 0, 2.7),
  target: new THREE.Vector3(0, 0, 0),
}

export const DENTAL_3D_EXPECTED_FDI = [
  '11', '12', '13', '14', '15', '16', '17', '18',
  '21', '22', '23', '24', '25', '26', '27', '28',
  '31', '32', '33', '34', '35', '36', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48',
] as const

export const DENTAL_PROCEDURAL_FDI = ['18', '28', '38', '48'] as const

export type DentalMeshSource = 'atlas' | 'procedural'

export interface DentalMeshPlanEntry {
  tooth: string
  source: DentalMeshSource
  atlasPartName?: string
}

/**
 * Build the visual contract independently from the renderer. The upstream
 * body atlas ships 28 adult teeth; the four third molars are deliberately
 * represented by a small local fallback until a dedicated dental asset is
 * available. Keeping this plan explicit prevents the UI from claiming that
 * a procedural mesh is a clinical asset.
 */
export function dentalMeshPlan(parts: readonly Pick<Atlas['parts'][number], 'name'>[]): DentalMeshPlanEntry[] {
  const atlasParts = new Map<string, string>()
  for (const part of parts) {
    const tooth = fdiForPart(part.name)
    if (tooth && !atlasParts.has(tooth)) atlasParts.set(tooth, part.name)
  }
  return DENTAL_3D_EXPECTED_FDI.map((tooth) => {
    const atlasPartName = atlasParts.get(tooth)
    return atlasPartName
      ? { tooth, source: 'atlas' as const, atlasPartName }
      : { tooth, source: 'procedural' as const }
  })
}

/** A deliberately low-poly, non-clinical tooth used only for missing atlas IDs. */
export function createProceduralToothGeometry(): THREE.BufferGeometry {
  const profile = [
    new THREE.Vector2(0.0, -0.5),
    new THREE.Vector2(0.26, -0.5),
    new THREE.Vector2(0.43, -0.34),
    new THREE.Vector2(0.5, 0.08),
    new THREE.Vector2(0.43, 0.34),
    new THREE.Vector2(0.27, 0.48),
    new THREE.Vector2(0.0, 0.52),
  ]
  const geometry = new THREE.LatheGeometry(profile, 8)
  geometry.computeVertexNormals()
  return geometry
}

export function fdiForPart(name: string): string | undefined {
  const match = name.match(/^\s*(left|right) (upper|lower) (.+) tooth\s*$/i)
  if (!match) return undefined
  const [, side, jaw, descriptor] = match
  if (!side || !jaw || !descriptor) return undefined
  const quadrant = jaw.toLowerCase() === 'upper'
    ? (side.toLowerCase() === 'right' ? '1' : '2')
    : (side.toLowerCase() === 'right' ? '4' : '3')
  const description = descriptor.toLowerCase()
  const position = description.includes('central secondary incisor') ? '1'
    : description.includes('lateral secondary incisor') ? '2'
      : description.includes('secondary canine') ? '3'
        : description.includes('first secondary premolar') ? '4'
          : description.includes('second secondary premolar') ? '5'
            : description.includes('first secondary molar') ? '6'
              : description.includes('second secondary molar') ? '7'
                : description.includes('third secondary molar') ? '8' : undefined
  if (!position) return undefined
  return `${quadrant}${position}`
}


function relevantPart(part: Atlas['parts'][number]): boolean {
  return /tooth|gingiva/i.test(part.name)
}

const THIRD_MOLAR_REFERENCES: Record<string, string> = {
  '18': '17',
  '28': '27',
  '38': '37',
  '48': '47',
}

function fallbackToothPlacement(tooth: string, reference: THREE.Mesh | undefined): { center: THREE.Vector3; size: THREE.Vector3 } {
  const referenceBounds = reference?.geometry.boundingBox
  const referenceCenter = referenceBounds?.getCenter(new THREE.Vector3())
  const referenceSize = referenceBounds?.getSize(new THREE.Vector3())
  const upper = tooth[0] === '1' || tooth[0] === '2'
  const left = tooth[0] === '2' || tooth[0] === '3'
  const side = left ? 1 : -1
  const size = new THREE.Vector3(
    Math.max(referenceSize?.x ?? 0, 0.0075),
    Math.max(referenceSize?.y ?? 0, 0.022),
    Math.max(referenceSize?.z ?? 0, 0.014),
  )
  const center = referenceCenter
    ? referenceCenter.clone().add(new THREE.Vector3(side * Math.max(size.x * 0.9, 0.008), 0, -Math.max(size.z * 0.9, 0.01)))
    : new THREE.Vector3(side * 0.036, upper ? 1.545 : 1.523, 0.024)
  return { center, size }
}

function DentalAtlasViewerImpl({ state, selectedTooth, onSelect, language = 'it' }: DentalAtlasViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasHostRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef(state)
  const selectedRef = useRef(selectedTooth)
  const hoveredRef = useRef<string | null>(null)
  const selectRef = useRef(onSelect)
  stateRef.current = state
  selectedRef.current = selectedTooth
  selectRef.current = onSelect
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [assetToothCount, setAssetToothCount] = useState<number | null>(null)
  const [proceduralToothIds, setProceduralToothIds] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const controlsRef = useRef<OrbitControls | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const invalidateRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    invalidateRef.current?.()
  }, [selectedTooth, state])

  useEffect(() => {
    const canvas = canvasHostRef.current?.querySelector('canvas')
    if (canvas) canvas.setAttribute('aria-label', language === 'it' ? 'Anteprima 3D delle arcate dentali' : '3D preview of the dental arches')
  }, [language])

  const setView = (view: 'reset' | 'front' | 'occlusal' | 'side') => {
    const controls = controlsRef.current
    const camera = cameraRef.current
    if (!controls || !camera) return
    const distance = 2.7
    if (view === 'reset') {
      camera.position.copy(dentalCameraMemory.position)
      controls.target.copy(dentalCameraMemory.target)
    } else if (view === 'occlusal') camera.position.set(0, distance, 0.001)
    else if (view === 'side') camera.position.set(distance, 0, 0.001)
    else camera.position.set(0, 0, distance)
    if (view !== 'reset') controls.target.set(0, 0, 0)
    controls.update()
    invalidateRef.current?.()
  }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    const abort = new AbortController()
    let renderer: THREE.WebGLRenderer | undefined
    let disposeScene: (() => void) | undefined
    let sceneDisposed = false
    let frame = 0
    let keyboardCleanup: (() => void) | undefined
    const materials: THREE.MeshStandardMaterial[] = []
    const meshes = new Map<string, THREE.Mesh>()

    const disposePartialScene = () => {
      if (sceneDisposed) return
      sceneDisposed = true
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      keyboardCleanup?.()
      controlsRef.current?.dispose()
      controlsRef.current = null
      renderer?.dispose()
      materials.forEach((material) => material.dispose())
      meshes.forEach((mesh) => mesh.geometry.dispose())
      canvasHostRef.current?.replaceChildren()
    }

    const start = async () => {
      try {
        const atlas = await loadAtlas(fetch, abort.signal)
        const parts = atlas.parts.filter(relevantPart)
        const meshPlan = dentalMeshPlan(parts)
        const chunkIds = [...new Set(parts.map((part) => part.chunk))]
        const scene = new THREE.Scene()
        scene.background = new THREE.Color('#f7f3ef')
        const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100)
        cameraRef.current = camera
        const light = new THREE.HemisphereLight('#fffaf4', '#bc8d87', 2.4)
        scene.add(light)
        const key = new THREE.DirectionalLight('#ffffff', 2.8)
        key.position.set(1, 2, 3)
        scene.add(key)

        try {
          renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        } catch {
          throw new Error('webgl')
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.setClearColor('#f7f3ef', 1)
        const canvasHost = canvasHostRef.current
        if (!canvasHost) throw new Error('canvas_host')
        canvasHost.replaceChildren(renderer.domElement)
        renderer.domElement.setAttribute('aria-label', language === 'it' ? 'Anteprima 3D delle arcate dentali' : '3D preview of the dental arches')
        renderer.domElement.tabIndex = 0

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enablePan = false
        controls.enableDamping = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        controls.dampingFactor = 0.12
        controls.minDistance = 1.5
        controls.maxDistance = 5
        controls.minPolarAngle = 0.3
        controls.maxPolarAngle = Math.PI - 0.3
        controls.rotateSpeed = 0.65
        controls.zoomSpeed = 0.8
        controls.target.set(0, 0, 0)
        controlsRef.current = controls

        const keyboard = (event: KeyboardEvent) => {
          const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target))
          if (event.key === 'ArrowLeft') spherical.theta += 0.12
          else if (event.key === 'ArrowRight') spherical.theta -= 0.12
          else if (event.key === 'ArrowUp') spherical.phi = Math.max(0.3, spherical.phi - 0.12)
          else if (event.key === 'ArrowDown') spherical.phi = Math.min(Math.PI - 0.3, spherical.phi + 0.12)
          else return
          camera.position.setFromSpherical(spherical).add(controls.target)
          camera.lookAt(controls.target)
          event.preventDefault()
          controls.update()
        }
        renderer.domElement.addEventListener('keydown', keyboard)
        keyboardCleanup = () => renderer?.domElement.removeEventListener('keydown', keyboard)

        const bounds = new THREE.Box3()
        let loaded = 0
        for (const chunkId of chunkIds) {
          if (disposed || abort.signal.aborted) return
          const chunk = atlas.chunks[chunkId]
          if (!chunk) continue
          const compressed = Boolean(chunk.gzip) && typeof DecompressionStream !== 'undefined'
          const response = await fetch(compressed && chunk.gzip ? chunk.gzip : chunk.url, { signal: abort.signal })
          const buffer = await decodeModelResponse(response, chunk.bytes, compressed)
          if (disposed || abort.signal.aborted) return
          for (const part of parts.filter((item) => item.chunk === chunkId)) {
            if (disposed || abort.signal.aborted) return
            const geometry = new THREE.BufferGeometry()
            geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buffer, part.positions, part.vertexCount * 3), 3))
            geometry.setAttribute('normal', new THREE.BufferAttribute(new Int16Array(buffer, part.normals, part.vertexCount * 3), 3, true))
            geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer, part.indices, part.indexCount), 1))
            geometry.computeBoundingBox()
            if (geometry.boundingBox) bounds.union(geometry.boundingBox)
            const tooth = fdiForPart(part.name)
            const material = new THREE.MeshStandardMaterial({
              color: tooth ? '#f6eee0' : '#d88491',
              roughness: tooth ? 0.42 : 0.72,
              metalness: 0,
            })
            materials.push(material)
            const mesh = new THREE.Mesh(geometry, material)
            if (tooth) {
              mesh.userData.tooth = tooth
              mesh.userData.source = 'atlas'
              meshes.set(tooth, mesh)
            }
            scene.add(mesh)
          }
          loaded += 1
          if (!disposed) setProgress(Math.round((loaded / chunkIds.length) * 100))
        }
        if (disposed || abort.signal.aborted) return
        const proceduralIds: string[] = []
        for (const entry of meshPlan) {
          if (entry.source !== 'procedural' || meshes.has(entry.tooth)) continue
          const geometry = createProceduralToothGeometry()
          const referenceTooth = THIRD_MOLAR_REFERENCES[entry.tooth]
          const placement = fallbackToothPlacement(entry.tooth, referenceTooth ? meshes.get(referenceTooth) : undefined)
          geometry.scale(placement.size.x, placement.size.y, placement.size.z)
          geometry.computeBoundingBox()
          const material = new THREE.MeshStandardMaterial({
            color: '#efe2cf',
            roughness: 0.48,
            metalness: 0,
          })
          materials.push(material)
          const mesh = new THREE.Mesh(geometry, material)
          mesh.position.copy(placement.center)
          mesh.userData.tooth = entry.tooth
          mesh.userData.source = 'procedural'
          meshes.set(entry.tooth, mesh)
          scene.add(mesh)
          if (geometry.boundingBox) bounds.union(geometry.boundingBox.clone().translate(placement.center))
          proceduralIds.push(entry.tooth)
        }
        setAssetToothCount(meshPlan.filter((entry) => entry.source === 'atlas').length)
        setProceduralToothIds(proceduralIds)
        const center = bounds.getCenter(new THREE.Vector3())
        const size = bounds.getSize(new THREE.Vector3())
        const scale = 1.7 / Math.max(size.x, size.y, size.z, 0.01)
        scene.scale.setScalar(scale)
        scene.position.copy(center).multiplyScalar(-scale)
        camera.position.set(0, 0, 2.7)
        camera.lookAt(0, 0, 0)
        controls.update()
        const raycaster = new THREE.Raycaster()
        const pointer = new THREE.Vector2()
        let pointerDown: { x: number; y: number } | undefined
        const pointerStart = (event: PointerEvent) => {
          if (event.button !== 0) return
          pointerDown = { x: event.clientX, y: event.clientY }
        }
        const toothAt = (event: PointerEvent) => {
          const rect = renderer?.domElement.getBoundingClientRect()
          if (!rect || !renderer) return null
          pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
          raycaster.setFromCamera(pointer, camera)
          const hit = raycaster.intersectObjects([...meshes.values()])[0]
          const tooth = typeof hit?.object.userData.tooth === 'string' ? hit.object.userData.tooth : null
          return tooth
        }
        const pointerMove = (event: PointerEvent) => {
          const next = toothAt(event)
          if (next === hoveredRef.current) return
          hoveredRef.current = next
          invalidate()
        }
        const pointerCancel = () => {
          pointerDown = undefined
          hoveredRef.current = null
          invalidate()
        }
        const pointerLeave = () => {
          hoveredRef.current = null
          invalidate()
        }
        const click = (event: PointerEvent) => {
          if (!pointerDown || Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 7) {
            pointerDown = undefined
            return
          }
          pointerDown = undefined
          const tooth = toothAt(event)
          if (tooth) selectRef.current(tooth)
          invalidate()
        }
        renderer.domElement.addEventListener('pointerdown', pointerStart)
        renderer.domElement.addEventListener('pointermove', pointerMove)
        renderer.domElement.addEventListener('pointercancel', pointerCancel)
        renderer.domElement.addEventListener('pointerleave', pointerLeave)
        renderer.domElement.addEventListener('pointerup', click)
        const resize = () => {
          if (!renderer) return
          const width = Math.max(1, host.clientWidth)
          const height = Math.max(180, host.clientHeight)
          renderer.setSize(width, height, false)
          camera.aspect = width / height
          camera.updateProjectionMatrix()
          invalidate()
        }
        resize()
        const resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(host)
        let visible = true
        let visibilityObserver: IntersectionObserver | undefined
        let renderRequested = false
        let renderLoop = false
        const renderFrame = () => {
          if (disposed || !renderer || !visible) return false
          const changed = controls.update()
          dentalCameraMemory.position.copy(camera.position)
          dentalCameraMemory.target.copy(controls.target)
          for (const [tooth, mesh] of meshes) {
            const tone = stateRef.current.get(tooth)
            const material = mesh.material as THREE.MeshStandardMaterial
            material.color.set(tone === 'extraction' ? '#4c5661' : tone === 'caries' ? '#2d7ff9' : tone === 'treated' ? '#d2ad62' : '#f6eee0')
            const highlighted = tooth === selectedRef.current || tooth === hoveredRef.current
            material.emissive.set(highlighted ? '#56d8ff' : '#000000')
            material.emissiveIntensity = highlighted ? (tooth === selectedRef.current ? 0.8 : 0.45) : 0
          }
          renderer.render(scene, camera)
          renderRequested = false
          return changed
        }
        const animate = () => {
          if (disposed || !renderer || !visible) {
            frame = 0
            renderLoop = false
            return
          }
          renderLoop = true
          const changed = renderFrame()
          if (controls.enableDamping && changed) {
            frame = requestAnimationFrame(animate)
          } else {
            frame = 0
            renderLoop = false
          }
        }
        function invalidate() {
          if (disposed || !visible || renderRequested) return
          renderRequested = true
          if (!renderLoop) {
            frame = requestAnimationFrame(animate)
            renderLoop = true
          }
        }
        invalidateRef.current = invalidate
        controls.addEventListener('change', invalidate)
        renderer.domElement.addEventListener('wheel', invalidate, { passive: true })
        if (typeof IntersectionObserver === 'undefined') {
          invalidate()
        } else {
          visibilityObserver = new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? false
            if (visible) invalidate()
            else {
              if (frame) cancelAnimationFrame(frame)
              frame = 0
              renderLoop = false
              renderRequested = false
            }
          }, { threshold: 0.01 })
          visibilityObserver.observe(host)
        }
        invalidate()
        if (!disposed) setReady(true)
        disposeScene = () => {
          if (sceneDisposed) return
          sceneDisposed = true
          if (frame) cancelAnimationFrame(frame)
          frame = 0
          resizeObserver.disconnect()
          visibilityObserver?.disconnect()
          keyboardCleanup?.()
          controls.dispose()
          controls.removeEventListener('change', invalidate)
          renderer?.domElement.removeEventListener('wheel', invalidate)
          renderer?.domElement.removeEventListener('pointerdown', pointerStart)
          renderer?.domElement.removeEventListener('pointermove', pointerMove)
          renderer?.domElement.removeEventListener('pointercancel', pointerCancel)
          renderer?.domElement.removeEventListener('pointerleave', pointerLeave)
          renderer?.domElement.removeEventListener('pointerup', click)
          if (invalidateRef.current === invalidate) invalidateRef.current = null
          scene.traverse((object) => { if (object instanceof THREE.Mesh) object.geometry.dispose() })
          materials.forEach((material) => material.dispose())
        }
        return disposeScene
      } catch (error) {
        if (!disposeScene) disposePartialScene()
        else disposeScene()
        if (!disposed && (error as Error).name !== 'AbortError') {
          setReady(false)
          setMessage(language === 'it' ? 'La vista 3D non è disponibile: la mappa 2D resta attiva.' : 'The 3D view is unavailable: the 2D map remains active.')
        }
      }
    }
    let cleanup: (() => void) | undefined
    void start().then((dispose) => { cleanup = dispose })
    return () => {
      disposed = true
      abort.abort()
      controlsRef.current = null
      cameraRef.current = null
      setReady(false)
      if (frame) cancelAnimationFrame(frame)
      cleanup?.()
      if (disposeScene) disposeScene()
      else disposePartialScene()
      renderer?.dispose()
      canvasHostRef.current?.replaceChildren()
    }
  }, [])

  return (
    <div className="spec-dental-3d-shell">
      <div className="spec-dental-3d" ref={hostRef}>
      <div className="spec-dental-3d__canvas" ref={canvasHostRef} />
      {!message && progress < 100 ? <span className="spec-dental-3d__status">Caricamento anatomia 3D… {progress}%</span> : null}
      {message ? <span className="spec-dental-3d__status">{message}</span> : null}
      {assetToothCount !== null && !message ? (
        <span className="spec-dental-3d__availability">
          {language === 'it' ? 'Anteprima 3D' : '3D preview'}: 32/32 {language === 'it' ? 'denti interattivi' : 'interactive teeth'} · {assetToothCount} {language === 'it' ? 'dall’atlas' : 'from atlas'} · {proceduralToothIds.length} {language === 'it' ? 'fallback procedurali' : 'procedural fallbacks'}
        </span>
      ) : null}
      </div>
      <div aria-label={language === 'it' ? 'Controlli vista 3D' : '3D view controls'} className="spec-dental-3d__controls" role="group">
        <button disabled={!ready} onClick={() => setView('reset')} type="button">Reset</button>
        <button disabled={!ready} onClick={() => setView('front')} type="button">{language === 'it' ? 'Frontale' : 'Front'}</button>
        <button disabled={!ready} onClick={() => setView('occlusal')} type="button">{language === 'it' ? 'Occlusale' : 'Occlusal'}</button>
        <button disabled={!ready} onClick={() => setView('side')} type="button">{language === 'it' ? 'Laterale' : 'Side'}</button>
      </div>
    </div>
  )
}

interface DentalAtlasErrorBoundaryProps {
  children: ReactNode
  language: 'it' | 'en'
}

interface DentalAtlasErrorBoundaryState {
  failed: boolean
}

/**
 * WebGL/model failures must stay local to the optional preview. The clinical
 * odontogram is still useful on devices without WebGL or with an interrupted
 * model download, so never let the lazy preview blank the whole page.
 */
class DentalAtlasErrorBoundary extends Component<DentalAtlasErrorBoundaryProps, DentalAtlasErrorBoundaryState> {
  state: DentalAtlasErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): DentalAtlasErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Keep the failure silent: this is an optional visual enhancement and the
    // detailed 2D odontogram remains the source of truth for the user.
  }

  render() {
    if (this.state.failed) {
      return <div className="spec-dental-3d__status">{this.props.language === 'it' ? 'La vista 3D non è disponibile su questo dispositivo. La mappa clinica resta attiva.' : 'The 3D view is unavailable on this device. The clinical map remains active.'}</div>
    }
    return this.props.children
  }
}

export default function DentalAtlasViewer(props: DentalAtlasViewerProps) {
  return (
    <DentalAtlasErrorBoundary language={props.language ?? 'it'}>
      <DentalAtlasViewerImpl {...props} />
    </DentalAtlasErrorBoundary>
  )
}
