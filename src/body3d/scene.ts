import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SYSTEMS, type Atlas, type SystemId, type ViewId } from './anatomy'
import { decodeModelResponse } from './modelLoader'

export const BODY_SCENE_ERROR_LOAD = 'Could not load the anatomy.'
export const BODY_SCENE_ERROR_ASSEMBLY = 'Could not assemble anatomy geometry.'
export const BODY_SCENE_ERROR_CONTEXT_LOST = 'The 3D session was paused by your device. Reload to continue.'

export interface PickPoint {
  x: number
  y: number
  z: number
}

export interface EventMarker {
  x: number
  y: number
  z: number
  color: string
}

export interface BodySceneCallbacks {
  onProgress: (percent: number) => void
  onError: (message: string) => void
  onPick: (partId: string, point: PickPoint) => void
}

export interface BodySceneHandle {
  setVisibleSystems: (ids: SystemId[]) => void
  setSelectedParts: (ids: string[]) => void
  setMarkers: (markers: EventMarker[]) => void
  setView: (view: ViewId) => void
  resetView: () => void
  focusParts: (ids: string[]) => void
  getViewState: () => BodyViewState
  setViewState: (state: BodyViewState) => void
  dispose: () => void
}

export interface BodyViewState {
  position: [number, number, number]
  target: [number, number, number]
  view: ViewId
}

const BODY_CENTER = new THREE.Vector3(0, 0.87, 0)
const CAMERA_DIRECTIONS: Record<ViewId, THREE.Vector3> = {
  'three-quarter': new THREE.Vector3(0.35, 0.06, 1).normalize(),
  front: new THREE.Vector3(0, 0.02, 1),
  back: new THREE.Vector3(0, 0.02, -1),
  side: new THREE.Vector3(1, 0.02, 0),
}

class PointerTap {
  private active = new Map<number, { x: number; y: number; threshold: number }>()
  private blocked = false

  down(id: number, x: number, y: number, threshold: number) {
    if (this.active.size === 0) this.blocked = false
    this.active.set(id, { x, y, threshold })
    if (this.active.size > 1) this.blocked = true
  }

  move(id: number, x: number, y: number) {
    const start = this.active.get(id)
    if (start && Math.hypot(x - start.x, y - start.y) > start.threshold) this.blocked = true
  }

  up(id: number, x: number, y: number): boolean {
    this.move(id, x, y)
    const tap = this.active.has(id) && this.active.size === 1 && !this.blocked
    this.active.delete(id)
    return tap
  }

  cancel(id: number) {
    this.active.delete(id)
    this.blocked = true
  }
}

function contactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 124)
    gradient.addColorStop(0, 'rgba(15, 23, 32, 0.32)')
    gradient.addColorStop(1, 'rgba(15, 23, 32, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 256, 256)
  }
  return new THREE.CanvasTexture(canvas)
}

export function createBodyScene(
  host: HTMLElement,
  atlas: Atlas,
  callbacks: BodySceneCallbacks,
): BodySceneHandle | undefined {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true })
  } catch {
    return undefined
  }

  let disposed = false
  let frame = 0
  let dirty = true
  // Rendering is demand-driven. Keep the scene asleep while it is still;
  // interaction and data changes wake it up below.
  function scheduleFrame() {
    dirty = true
    if (!frame) frame = requestAnimationFrame(animate)
  }
  let ready = false
  const abort = new AbortController()

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, host.clientWidth < 768 ? 1.5 : 2))
  renderer.setClearColor('#f2f3f3')
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.12
  renderer.domElement.setAttribute(
    'aria-label',
    'Interactive human anatomy. Drag to orbit, pinch or scroll to zoom, and tap a structure to select it.',
  )
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(34, 1, 0.005, 100)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.085
  controls.minDistance = 0.07
  controls.maxDistance = 40
  controls.maxPolarAngle = Math.PI * 0.96
  controls.addEventListener('change', scheduleFrame)

  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, 0.04)
  scene.environment = environment.texture
  room.dispose()
  pmrem.dispose()

  scene.add(new THREE.HemisphereLight(0xffffff, 0xa7acb2, 1.05))
  const keyLight = new THREE.DirectionalLight(0xfffaf4, 2.3)
  keyLight.position.set(-2, 4, 3)
  scene.add(keyLight)
  const rimLight = new THREE.DirectionalLight(0xe9f0ff, 1.8)
  rimLight.position.set(2, 2, -3)
  scene.add(rimLight)

  const shadowTexture = contactShadowTexture()
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.1),
    new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.002
  scene.add(shadow)

  const width = THREE.MathUtils.ceilPowerOfTwo(atlas.parts.length)
  const stateData = new Float32Array(width * 4)
  const stateTexture = new THREE.DataTexture(stateData, width, 1, THREE.RGBAFormat, THREE.FloatType)
  stateTexture.needsUpdate = true
  const selectionData = new Uint8Array(width * 4)
  const selectionTexture = new THREE.DataTexture(selectionData, width, 1)
  selectionTexture.needsUpdate = true

  const materials: THREE.Material[] = []
  const geometries: THREE.BufferGeometry[] = []
  const pickers: (THREE.Mesh | undefined)[] = []
  const bounds = atlas.parts.map(
    (part) => new THREE.Box3(new THREE.Vector3().fromArray(part.bounds[0]), new THREE.Vector3().fromArray(part.bounds[1])),
  )
  const partIndexByID = new Map(atlas.parts.map((part, index) => [part.id, index]))
  const partsByChunk = new Map<number, Array<{ part: (typeof atlas.parts)[number]; index: number }>>()
  atlas.parts.forEach((part, index) => {
    const parts = partsByChunk.get(part.chunk) ?? []
    parts.push({ part, index })
    partsByChunk.set(part.chunk, parts)
  })

  const materialFor = (system: string) => {
    const color = SYSTEMS.find((candidate) => candidate.id === system)?.color ?? '#aebbb8'
    const integumentary = system === 'integumentary'
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.08,
      roughness: 0.53,
      side: THREE.DoubleSide,
      transparent: integumentary,
      opacity: integumentary ? 0.12 : 1,
      depthWrite: !integumentary,
    })
    material.onBeforeCompile = (shader) => {
      shader.uniforms.partState = { value: stateTexture }
      shader.uniforms.selectionState = { value: selectionTexture }
      shader.uniforms.stateWidth = { value: width }
      shader.vertexShader =
        'attribute float partIndex; uniform sampler2D partState; uniform sampler2D selectionState; uniform float stateWidth; varying float partVisible; varying float partSelected;\n' +
        shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5); vec4 state = texture2D(partState, stateUv); transformed += state.xyz; partVisible = state.w; partSelected = texture2D(selectionState, stateUv).r;',
      )
      shader.fragmentShader = 'varying float partVisible; varying float partSelected;\n' + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nif (partVisible < 0.5) discard;',
      )
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.18, 0.55, 0.5), partSelected * 0.78);',
      )
    }
    materials.push(material)
    return material
  }
  const materialBySystem = new Map(SYSTEMS.map((system) => [system.id, materialFor(system.id)]))

  const visibleSet = new Set<SystemId>()
  let selectedSet = new Set<string>()
  let hasVisibleSolid = false

  let markerGeometry = new THREE.BufferGeometry()
  let markerCapacity = 0
  const markerMaterial = new THREE.PointsMaterial({
    size: 14,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
  })
  markerMaterial.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      '#include <clipping_planes_fragment>\nif (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;',
    )
  }
  const markers = new THREE.Points(markerGeometry, markerMaterial)
  markers.frustumCulled = false
  markers.renderOrder = 10
  scene.add(markers)

  function updateStateTexture() {
    let nextHasVisibleSolid = false
    for (let index = 0; index < atlas.parts.length; index += 1) {
      const part = atlas.parts[index]
      const visible = part ? visibleSet.has(part.system) : false
      const displayed = visible || selectedSet.has(part?.id ?? '')
      const offset = index * 4
      // RGB is intentionally left at zero: the shader only uses alpha for
      // visibility, while the position offset remains the zero vector.
      stateData[offset + 3] = displayed ? 1 : 0
      if (displayed && part?.system !== 'integumentary') nextHasVisibleSolid = true
    }
    hasVisibleSolid = nextHasVisibleSolid
    stateTexture.needsUpdate = true
    scheduleFrame()
  }

  function updateSelectionTexture() {
    for (let index = 0; index < atlas.parts.length; index += 1) {
      const part = atlas.parts[index]
      selectionData[index * 4] = part && selectedSet.has(part.id) ? 255 : 0
    }
    selectionTexture.needsUpdate = true
    scheduleFrame()
  }

  let loaded = 0
  const loadChunk = async (index: number) => {
    const chunk = atlas.chunks[index]
    if (!chunk) return
    const compressed = Boolean(chunk.gzip) && typeof DecompressionStream !== 'undefined'
    const response = await fetch(compressed && chunk.gzip ? chunk.gzip : chunk.url, { signal: abort.signal })
    const buffer = await decodeModelResponse(response, chunk.bytes, compressed)
    if (disposed) return
    const groups = new Map<string, THREE.BufferGeometry[]>()
    for (const { part, index: partIndex } of partsByChunk.get(index) ?? []) {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buffer, part.positions, part.vertexCount * 3), 3))
      geometry.setAttribute('normal', new THREE.BufferAttribute(new Int16Array(buffer, part.normals, part.vertexCount * 3), 3, true))
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer, part.indices, part.indexCount), 1))
      geometry.boundingBox = bounds[partIndex]?.clone() ?? null
      geometry.computeBoundingSphere()
      geometry.setAttribute('partIndex', new THREE.BufferAttribute(new Float32Array(part.vertexCount).fill(partIndex), 1))
      const picker = new THREE.Mesh(geometry)
      picker.matrixAutoUpdate = false
      pickers[partIndex] = picker
      geometries.push(geometry)
      const list = groups.get(part.system) ?? []
      list.push(geometry)
      groups.set(part.system, list)
    }
    groups.forEach((list, system) => {
      const geometry = mergeGeometries(list, false)
      if (!geometry) throw new Error(BODY_SCENE_ERROR_ASSEMBLY)
      geometries.push(geometry)
      const mesh = new THREE.Mesh(geometry, materialBySystem.get(system as SystemId))
      mesh.frustumCulled = false
      scene.add(mesh)
    })
    loaded += 1
    callbacks.onProgress(Math.round((loaded / atlas.chunks.length) * 100))
    scheduleFrame()
  }

  ;(async () => {
    try {
      let cursor = 0
      await Promise.all(
        Array.from({ length: 3 }, async () => {
          while (cursor < atlas.chunks.length) {
            const index = cursor
            cursor += 1
            await loadChunk(index)
          }
        }),
      )
      if (!disposed) {
        ready = true
        scheduleFrame()
      }
    } catch (error) {
      if (!disposed) {
        callbacks.onError(error instanceof Error ? error.message : BODY_SCENE_ERROR_LOAD)
      }
    }
  })()

  function cameraDistance(aspect: number) {
    const halfHeight = 1.73 / 2
    const halfWidth = 0.67 / 2
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2)
    const distanceV = halfHeight / Math.tan(halfFov)
    const distanceH = halfWidth / (Math.tan(halfFov) * Math.max(0.35, aspect))
    return Math.max(distanceV, distanceH) * 1.16
  }

  function applyView(view: ViewId) {
    const direction = CAMERA_DIRECTIONS[view]
    controls.target.copy(BODY_CENTER)
    camera.position.copy(BODY_CENTER).addScaledVector(direction, cameraDistance(camera.aspect))
    controls.update()
    scheduleFrame()
  }

  function resize() {
    camera.aspect = host.clientWidth / Math.max(1, host.clientHeight)
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, host.clientWidth < 768 ? 1.5 : 2))
    renderer.setSize(host.clientWidth, host.clientHeight)
    if (!controls.target.equals(BODY_CENTER)) {
      scheduleFrame()
      return
    }
    applyView(currentView)
  }

  let currentView: ViewId = 'three-quarter'
  applyView(currentView)
  resize()
  const observer = new ResizeObserver(resize)
  observer.observe(host)

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const tap = new PointerTap()

  const onPointerDown = (event: PointerEvent) => {
    tap.down(event.pointerId, event.clientX, event.clientY, event.pointerType === 'touch' ? 12 : 5)
  }
  const onPointerMove = (event: PointerEvent) => {
    tap.move(event.pointerId, event.clientX, event.clientY)
  }
  const onPointerCancel = (event: PointerEvent) => {
    tap.cancel(event.pointerId)
  }
  const onPointerUp = (event: PointerEvent) => {
    if (!tap.up(event.pointerId, event.clientX, event.clientY) || !ready) return
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    raycaster.setFromCamera(pointer, camera)
    let nearest = Infinity
    let found = -1
    let hitPoint: THREE.Vector3 | undefined
    for (let index = 0; index < pickers.length; index += 1) {
      const mesh = pickers[index]
      if (!mesh || (stateData[index * 4 + 3] ?? 0) < 0.5) continue
      const part = atlas.parts[index]
      if (!part) continue
      if (hasVisibleSolid && part.system === 'integumentary') continue
      const hit = raycaster.intersectObject(mesh, false)[0]
      if (hit && hit.distance < nearest) {
        nearest = hit.distance
        found = index
        hitPoint = hit.point
      }
    }
    if (found >= 0 && hitPoint) {
      const part = atlas.parts[found]
      if (part) {
        callbacks.onPick(part.id, { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z })
      }
    }
  }
  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  renderer.domElement.addEventListener('pointermove', onPointerMove)
  renderer.domElement.addEventListener('pointerup', onPointerUp)
  renderer.domElement.addEventListener('pointercancel', onPointerCancel)
  renderer.domElement.addEventListener('pointerdown', scheduleFrame)
  renderer.domElement.addEventListener('pointermove', scheduleFrame)
  renderer.domElement.addEventListener('wheel', scheduleFrame)

  function animate() {
    if (disposed) return
    frame = 0
    const controlsChanged = controls.update()
    if (dirty || controlsChanged) {
      renderer.render(scene, camera)
      dirty = false
    }
    if (!disposed && (dirty || controlsChanged)) frame = requestAnimationFrame(animate)
  }
  scheduleFrame()

  const onContextLost = (event: Event) => {
    event.preventDefault()
    callbacks.onError(BODY_SCENE_ERROR_CONTEXT_LOST)
  }
  renderer.domElement.addEventListener('webglcontextlost', onContextLost)

  return {
    setVisibleSystems(ids) {
      visibleSet.clear()
      ids.forEach((id) => visibleSet.add(id))
      updateStateTexture()
    },
    setSelectedParts(ids) {
      selectedSet = new Set(ids)
      updateStateTexture()
      updateSelectionTexture()
    },
    setMarkers(list) {
      const needed = list.length * 3
      if (needed > markerCapacity || markerCapacity === 0) {
        const previous = markerGeometry
        markerCapacity = Math.max(96, needed)
        markerGeometry = new THREE.BufferGeometry()
        markerGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(markerCapacity), 3))
        markerGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(markerCapacity), 3))
        markers.geometry = markerGeometry
        previous.dispose()
      }
      const positionAttribute = markerGeometry.getAttribute('position') as THREE.BufferAttribute
      const colorAttribute = markerGeometry.getAttribute('color') as THREE.BufferAttribute
      const positions = positionAttribute.array as Float32Array
      const colors = colorAttribute.array as Float32Array
      const color = new THREE.Color()
      list.forEach((marker, index) => {
        const offset = index * 3
        positions[offset] = marker.x
        positions[offset + 1] = marker.y
        positions[offset + 2] = marker.z
        color.set(marker.color)
        colors[offset] = color.r
        colors[offset + 1] = color.g
        colors[offset + 2] = color.b
      })
      markerGeometry.setDrawRange(0, list.length)
      positionAttribute.needsUpdate = true
      colorAttribute.needsUpdate = true
      scheduleFrame()
    },
    setView(view) {
      currentView = view
      applyView(view)
    },
    resetView() {
      currentView = 'three-quarter'
      applyView(currentView)
      controls.autoRotate = false
    },
    focusParts(ids) {
      const box = new THREE.Box3()
      ids.forEach((id) => {
        const index = partIndexByID.get(id) ?? -1
        const partBounds = index >= 0 ? bounds[index] : undefined
        if (partBounds) box.union(partBounds)
      })
      if (box.isEmpty()) return
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const halfFov = THREE.MathUtils.degToRad(camera.fov / 2)
      const distance =
        Math.max(
          size.y / (2 * Math.tan(halfFov)),
          size.x / (2 * Math.tan(halfFov) * Math.max(0.35, camera.aspect)),
          size.z / (2 * Math.tan(halfFov)),
        ) * 1.6
      // Keep the direction the user is currently looking from. Reusing the
      // preset here made every point selection snap the body back to the
      // initial three-quarter/front/side angle, which is especially jarring
      // while exploring a rear or oblique view.
      const direction = camera.position.clone().sub(controls.target)
      if (direction.lengthSq() < 0.0001) direction.copy(CAMERA_DIRECTIONS[currentView])
      direction.normalize()
      controls.target.copy(center)
      camera.position.copy(center).addScaledVector(direction, Math.max(0.25, distance))
      controls.update()
      scheduleFrame()
    },
    getViewState() {
      return { position: [camera.position.x, camera.position.y, camera.position.z], target: [controls.target.x, controls.target.y, controls.target.z], view: currentView }
    },
    setViewState(state) {
      currentView = state.view
      camera.position.fromArray(state.position)
      controls.target.fromArray(state.target)
      controls.update()
      scheduleFrame()
    },
    dispose() {
      disposed = true
      abort.abort()
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      geometries.forEach((geometry) => geometry.dispose())
      materials.forEach((material) => material.dispose())
      environment.dispose()
      stateTexture.dispose()
      selectionTexture.dispose()
      markerGeometry.dispose()
      markerMaterial.dispose()
      shadowTexture.dispose()
      shadow.geometry.dispose()
      ;(shadow.material as THREE.Material).dispose()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel)
      renderer.domElement.removeEventListener('pointerdown', scheduleFrame)
      renderer.domElement.removeEventListener('pointermove', scheduleFrame)
      renderer.domElement.removeEventListener('wheel', scheduleFrame)
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
