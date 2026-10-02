import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { blockDisplayColor } from '../lib/viewColors'

// Directions are from the target toward the camera. The statue faces north
// (-z), so "front" puts the camera on the negative z side.
const VIEW_DIRECTIONS = {
  front: [0, 0.16, -1],
  side: [1, 0.14, 0],
  back: [0, 0.16, 1],
  top: [0, 1, -0.02],
  iso: [0.82, 0.5, -1],
}

const THEMES = {
  dark: {
    gridMajor: 0x3a4048,
    gridMinor: 0x24282e,
    shadow: 0.42,
    accent: 0xb4f03c,
    background: 0x111316,
  },
  light: {
    gridMajor: 0xaab1a6,
    gridMinor: 0xcfd5cb,
    shadow: 0.18,
    accent: 0x4f8600,
    background: 0xf1f3ef,
  },
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function VoxelPreview({
  model,
  layerStarts,
  layer,
  renderMode,
  showEdges,
  autoRotate,
  theme,
  viewRef,
}) {
  const hostRef = useRef(null)
  const stateRef = useRef(null)
  const [hover, setHover] = useState(null)

  // Scene setup, once.
  useEffect(() => {
    const host = hostRef.current
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(host.clientWidth || 1, host.clientHeight || 1)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 4000)
    camera.position.set(30, 40, -60)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.09
    controls.screenSpacePanning = true
    controls.autoRotateSpeed = 1.1
    controls.maxPolarAngle = Math.PI * 0.94

    const hemi = new THREE.HemisphereLight(0xffffff, 0x3a4250, 1.9)
    const key = new THREE.DirectionalLight(0xffffff, 2.1)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.bias = -0.0005
    key.shadow.normalBias = 0.03
    const rim = new THREE.DirectionalLight(0xe6eeff, 0.55)
    scene.add(hemi, key, key.target, rim)

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShadowMaterial({ opacity: 0.4 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    const hoverBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.04, 1.04, 1.04)),
      new THREE.LineBasicMaterial({ color: 0xb4f03c, depthTest: false, transparent: true }),
    )
    hoverBox.renderOrder = 10
    hoverBox.visible = false
    scene.add(hoverBox)

    const layerPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: 0xb4f03c,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    layerPlane.rotation.x = -Math.PI / 2
    layerPlane.visible = false
    scene.add(layerPlane)

    const textures = { plain: makeBlockTexture(false), edges: makeBlockTexture(true) }
    const material = new THREE.MeshStandardMaterial({
      map: textures.edges,
      roughness: 0.94,
      metalness: 0,
    })
    const geometry = new THREE.BoxGeometry(1, 1, 1)

    const state = {
      renderer,
      scene,
      camera,
      controls,
      key,
      rim,
      ground,
      hoverBox,
      layerPlane,
      textures,
      material,
      geometry,
      mesh: null,
      grid: null,
      occupancy: null,
      dims: null,
      tween: null,
      needsRender: true,
      dragging: false,
      layerLimit: Infinity,
      invalidate() {
        state.needsRender = true
      },
    }
    stateRef.current = state

    controls.addEventListener('change', state.invalidate)
    controls.addEventListener('start', () => {
      state.dragging = true
      state.tween = null
    })
    controls.addEventListener('end', () => {
      state.dragging = false
    })

    let frame = 0
    const loop = (time) => {
      frame = requestAnimationFrame(loop)
      if (state.tween) stepTween(state, time)
      const moved = controls.update()
      if (moved || state.needsRender) {
        renderer.render(scene, camera)
        state.needsRender = false
      }
    }
    frame = requestAnimationFrame(loop)

    const resize = () => {
      const width = Math.max(1, host.clientWidth)
      const height = Math.max(1, host.clientHeight)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      state.needsRender = true
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      state.mesh?.dispose()
      state.grid?.geometry.dispose()
      state.grid?.material.dispose()
      geometry.dispose()
      material.dispose()
      textures.plain.dispose()
      textures.edges.dispose()
      ground.geometry.dispose()
      ground.material.dispose()
      hoverBox.geometry.dispose()
      hoverBox.material.dispose()
      layerPlane.geometry.dispose()
      layerPlane.material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      stateRef.current = null
    }
  }, [])

  // Geometry: one instanced mesh for the whole statue, sorted by layer.
  useEffect(() => {
    const state = stateRef.current
    if (!state) return
    if (state.mesh) {
      state.scene.remove(state.mesh)
      state.mesh.dispose()
      state.mesh = null
    }
    state.hoverBox.visible = false
    setHover(null)

    const { blocks, width: W, height: H, length: L } = model
    if (!blocks.length) {
      state.occupancy = null
      state.invalidate()
      return
    }

    const mesh = new THREE.InstancedMesh(state.geometry, state.material, blocks.length)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    const matrix = new THREE.Matrix4()
    const occupancy = new Int32Array(W * H * L)
    blocks.forEach((block, index) => {
      matrix.makeTranslation(block.x - W / 2 + 0.5, block.y + 0.5, block.z - L / 2 + 0.5)
      mesh.setMatrixAt(index, matrix)
      occupancy[(block.y * L + block.z) * W + block.x] = index + 1
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.setColorAt(0, new THREE.Color())
    state.scene.add(mesh)
    state.mesh = mesh
    state.occupancy = { data: occupancy, W, H, L }

    const changed =
      !state.dims || state.dims.W !== W || state.dims.H !== H || state.dims.L !== L
    if (changed) {
      const first = !state.dims
      state.dims = { W, H, L }
      rebuildStage(state, theme)
      frameCamera(state, first ? VIEW_DIRECTIONS.iso : null, !first)
    }
    state.invalidate()
    // Theme is applied by its own effect; the stage rebuild only needs the
    // current value when dimensions change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model])

  // Colors: depend on render mode and the active layer (lower layers dim).
  useEffect(() => {
    const state = stateRef.current
    if (!state?.mesh) return
    const color = new THREE.Color()
    const dimBelow = layer == null ? -1 : layer
    model.blocks.forEach((block, index) => {
      const rgb = blockDisplayColor(block, renderMode)
      color.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace)
      if (block.y < dimBelow) color.multiplyScalar(0.42)
      state.mesh.setColorAt(index, color)
    })
    state.mesh.instanceColor.needsUpdate = true
    state.invalidate()
  }, [model, renderMode, layer])

  // Layer slicing: blocks are sorted by y, so a draw count hides upper layers.
  useEffect(() => {
    const state = stateRef.current
    if (!state?.mesh) return
    const { width: W, length: L } = model
    if (layer == null || !layerStarts) {
      state.mesh.count = model.blocks.length
      state.layerPlane.visible = false
      state.layerLimit = Infinity
    } else {
      state.mesh.count = layerStarts[layer + 1] ?? model.blocks.length
      state.layerPlane.visible = true
      state.layerPlane.position.set(0, layer + 1.02, 0)
      state.layerPlane.scale.set(W + 1, L + 1, 1)
      state.layerLimit = layer
    }
    state.hoverBox.visible = false
    state.invalidate()
  }, [model, layer, layerStarts])

  useEffect(() => {
    const state = stateRef.current
    if (!state) return
    state.material.map = showEdges ? state.textures.edges : state.textures.plain
    state.material.needsUpdate = true
    state.invalidate()
  }, [showEdges])

  useEffect(() => {
    const state = stateRef.current
    if (!state) return
    state.controls.autoRotate = autoRotate && !prefersReducedMotion()
    state.invalidate()
  }, [autoRotate])

  useEffect(() => {
    const state = stateRef.current
    if (!state) return
    const palette = THEMES[theme] ?? THEMES.dark
    state.ground.material.opacity = palette.shadow
    state.hoverBox.material.color.setHex(palette.accent)
    state.layerPlane.material.color.setHex(palette.accent)
    if (state.dims) rebuildStage(state, theme)
    state.invalidate()
  }, [theme])

  useImperativeHandle(
    viewRef,
    () => ({
      setView(name) {
        const state = stateRef.current
        if (state) frameCamera(state, VIEW_DIRECTIONS[name] ?? VIEW_DIRECTIONS.iso, true)
      },
      fit() {
        const state = stateRef.current
        if (state) frameCamera(state, null, true)
      },
      async screenshot() {
        const state = stateRef.current
        if (!state) return null
        const palette = THEMES[theme] ?? THEMES.dark
        state.scene.background = new THREE.Color(palette.background)
        state.hoverBox.visible = false
        state.renderer.render(state.scene, state.camera)
        const blob = await new Promise((resolve) =>
          state.renderer.domElement.toBlob(resolve, 'image/png'),
        )
        state.scene.background = null
        state.invalidate()
        return blob
      },
    }),
    [theme],
  )

  // Hover picking walks the voxel grid along the mouse ray (no triangle tests).
  useEffect(() => {
    const element = stateRef.current?.renderer.domElement
    if (!element) return undefined
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let pending = null
    let frame = 0

    const run = () => {
      frame = 0
      const state = stateRef.current
      if (!state || !pending) return
      const { clientX, clientY } = pending
      const rect = element.getBoundingClientRect()
      pointer.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointer, state.camera)
      const index = state.occupancy && !state.dragging
        ? pickVoxel(raycaster.ray, state.occupancy, state.layerLimit)
        : -1
      const block = index >= 0 ? model.blocks[index] : null
      if (block) {
        const { width: W, length: L } = model
        state.hoverBox.position.set(block.x - W / 2 + 0.5, block.y + 0.5, block.z - L / 2 + 0.5)
        state.hoverBox.visible = true
        setHover({
          block,
          x: clientX - rect.left,
          y: clientY - rect.top,
          flip: clientX - rect.left > rect.width - 300,
        })
      } else {
        state.hoverBox.visible = false
        setHover(null)
      }
      state.invalidate()
    }

    const onMove = (event) => {
      pending = event
      if (!frame) frame = requestAnimationFrame(run)
    }
    const onLeave = () => {
      pending = null
      const state = stateRef.current
      if (state) {
        state.hoverBox.visible = false
        state.invalidate()
      }
      setHover(null)
    }
    const onDoubleClick = () => {
      const state = stateRef.current
      if (state) frameCamera(state, null, true)
    }

    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerleave', onLeave)
    element.addEventListener('dblclick', onDoubleClick)
    return () => {
      cancelAnimationFrame(frame)
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerleave', onLeave)
      element.removeEventListener('dblclick', onDoubleClick)
    }
  }, [model])

  return (
    <div className="viewer-canvas" ref={hostRef}>
      {hover ? <HoverCard hover={hover} renderMode={renderMode} /> : null}
    </div>
  )
}

function HoverCard({ hover, renderMode }) {
  const { block } = hover
  const rgb = blockDisplayColor(block, renderMode === 'skin' ? 'skin' : 'blocks')
  const flipX = hover.flip
  return (
    <div
      className="hover-card"
      style={{
        transform: `translate(${hover.x + (flipX ? -16 : 16)}px, ${hover.y + 16}px) translateX(${flipX ? '-100%' : '0'})`,
      }}
      role="status"
    >
      <span
        className="swatch size-md"
        style={{ backgroundColor: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` }}
      />
      <span className="hover-card-copy">
        <strong>{block.label}</strong>
        <span className="mono">
          {block.x}, {block.y}, {block.z}
          {block.kind === 'skin' ? ` · ΔE ${block.matchError.toFixed(1)}` : ` · ${block.kind}`}
        </span>
      </span>
    </div>
  )
}

function makeBlockTexture(edges) {
  const size = 16
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  const image = context.createImageData(size, size)
  let seed = 1337
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let value = 0.9 + random() * 0.1
      if (edges && (x === 0 || y === 0 || x === size - 1 || y === size - 1)) value = 0.74
      const index = (y * size + x) * 4
      image.data[index] = image.data[index + 1] = image.data[index + 2] = Math.round(value * 255)
      image.data[index + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function rebuildStage(state, theme) {
  const { W, H, L } = state.dims
  const palette = THEMES[theme] ?? THEMES.dark
  if (state.grid) {
    state.scene.remove(state.grid)
    state.grid.geometry.dispose()
    state.grid.material.dispose()
  }
  const size = Math.ceil((Math.max(W, L) + 12) / 2) * 2
  const grid = new THREE.GridHelper(size, size, palette.gridMajor, palette.gridMinor)
  grid.position.set((W % 2) / 2, 0.002, (L % 2) / 2)
  grid.material.transparent = true
  grid.material.opacity = 0.75
  grid.material.depthWrite = false
  state.scene.add(grid)
  state.grid = grid

  const span = Math.max(W, H, L)
  state.ground.scale.set(size * 3, size * 3, 1)
  const shadowCamera = state.key.shadow.camera
  const extent = span * 0.95 + 4
  shadowCamera.left = -extent
  shadowCamera.right = extent
  shadowCamera.top = extent
  shadowCamera.bottom = -extent
  shadowCamera.near = 0.5
  shadowCamera.far = span * 6 + 40
  shadowCamera.updateProjectionMatrix()
  state.key.position.set(span * 0.9, span * 2 + 20, -span * 1.2)
  state.key.target.position.set(0, H / 2, 0)
  state.rim.position.set(-span, span, span * 1.4)
}

function frameCamera(state, direction, animate) {
  if (!state.dims) return
  const { W, H, L } = state.dims
  const { camera, controls } = state
  const target = new THREE.Vector3(0, H * 0.47, 0)
  const dir = direction
    ? new THREE.Vector3(...direction).normalize()
    : camera.position.clone().sub(controls.target).normalize()
  const radius = 0.5 * Math.hypot(W, H, L)
  const vertical = THREE.MathUtils.degToRad(camera.fov) / 2
  const horizontal = Math.atan(Math.tan(vertical) * camera.aspect)
  const distance = (radius / Math.sin(Math.min(vertical, horizontal))) * 1.2
  const position = target.clone().add(dir.multiplyScalar(distance))
  controls.minDistance = Math.max(2, radius * 0.4)
  controls.maxDistance = distance * 4

  if (!animate || prefersReducedMotion()) {
    camera.position.copy(position)
    controls.target.copy(target)
    state.tween = null
    controls.update()
    state.invalidate()
    return
  }
  state.tween = {
    start: null,
    duration: 520,
    fromPosition: camera.position.clone(),
    toPosition: position,
    fromTarget: controls.target.clone(),
    toTarget: target,
  }
  state.invalidate()
}

function stepTween(state, time) {
  const tween = state.tween
  if (tween.start == null) tween.start = time
  const t = Math.min(1, (time - tween.start) / tween.duration)
  const eased = 1 - (1 - t) ** 4
  state.camera.position.lerpVectors(tween.fromPosition, tween.toPosition, eased)
  state.controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased)
  state.needsRender = true
  if (t >= 1) state.tween = null
}

// Amanatides and Woo voxel traversal in grid space. Returns a block index.
function pickVoxel(ray, occupancy, layerLimit) {
  const { data, W, H, L } = occupancy
  const maxY = Math.min(H, layerLimit + 1)
  const origin = [ray.origin.x + W / 2, ray.origin.y, ray.origin.z + L / 2]
  const dir = [ray.direction.x, ray.direction.y, ray.direction.z]
  const size = [W, maxY, L]

  let tMin = 0
  let tMax = Infinity
  for (let axis = 0; axis < 3; axis += 1) {
    if (Math.abs(dir[axis]) < 1e-12) {
      if (origin[axis] < 0 || origin[axis] > size[axis]) return -1
      continue
    }
    const t1 = (0 - origin[axis]) / dir[axis]
    const t2 = (size[axis] - origin[axis]) / dir[axis]
    tMin = Math.max(tMin, Math.min(t1, t2))
    tMax = Math.min(tMax, Math.max(t1, t2))
    if (tMin > tMax) return -1
  }

  const start = origin.map((value, axis) => value + dir[axis] * (tMin + 1e-6))
  const cell = start.map((value, axis) => Math.min(size[axis] - 1, Math.max(0, Math.floor(value))))
  const step = dir.map((value) => (value > 0 ? 1 : -1))
  const tDelta = dir.map((value) => (value === 0 ? Infinity : Math.abs(1 / value)))
  const tNext = dir.map((value, axis) => {
    if (value === 0) return Infinity
    const boundary = value > 0 ? cell[axis] + 1 : cell[axis]
    return tMin + (boundary - start[axis]) / value
  })

  for (let guard = 0; guard < W + H + L + 3; guard += 1) {
    const index = data[(cell[1] * L + cell[2]) * W + cell[0]]
    if (index > 0) return index - 1
    const axis = tNext[0] < tNext[1] ? (tNext[0] < tNext[2] ? 0 : 2) : tNext[1] < tNext[2] ? 1 : 2
    cell[axis] += step[axis]
    if (cell[axis] < 0 || cell[axis] >= size[axis]) return -1
    tNext[axis] += tDelta[axis]
  }
  return -1
}
