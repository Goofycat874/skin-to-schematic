import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export function VoxelPreview({ model }) {
  const hostRef = useRef(null)
  const rendererRef = useRef(null)
  const sceneRef = useRef(null)

  const groups = useMemo(() => {
    const grouped = new Map()
    for (const block of model.blocks) {
      const key = block.color.join(',')
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key).push(block)
    }
    return [...grouped.entries()].map(([key, blocks]) => ({
      color: key.split(',').map(Number),
      blocks,
    }))
  }, [model])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(host.clientWidth, host.clientHeight)
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      38,
      host.clientWidth / host.clientHeight,
      0.1,
      1000,
    )
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.autoRotate = false

    const ambient = new THREE.HemisphereLight(0xffffff, 0x253041, 2.7)
    const key = new THREE.DirectionalLight(0xffffff, 2.8)
    key.position.set(32, 48, 24)
    const fill = new THREE.DirectionalLight(0xfbbf24, 0.8)
    fill.position.set(-20, 12, -16)
    scene.add(ambient, key, fill)

    const grid = new THREE.GridHelper(72, 24, 0x4b5563, 0x2b3442)
    grid.position.y = -0.52
    scene.add(grid)

    rendererRef.current = { renderer, camera, controls }
    sceneRef.current = { scene, grid }

    let frameId = 0
    const render = () => {
      controls.update()
      renderer.render(scene, camera)
      frameId = requestAnimationFrame(render)
    }
    render()

    const resizeObserver = new ResizeObserver(() => {
      const width = Math.max(1, host.clientWidth)
      const height = Math.max(1, host.clientHeight)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    })
    resizeObserver.observe(host)

    return () => {
      cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      controls.dispose()
      renderer.dispose()
      host.removeChild(renderer.domElement)
      rendererRef.current = null
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    const sceneState = sceneRef.current
    const rendererState = rendererRef.current
    if (!sceneState || !rendererState) return

    const { scene, grid } = sceneState
    const transient = scene.children.filter((child) => child.userData.voxels)
    transient.forEach((child) => {
      scene.remove(child)
      child.geometry?.dispose()
      child.material?.dispose()
    })

    if (model.blocks.length === 0) return

    const geometry = new THREE.BoxGeometry(0.96, 0.96, 0.96)
    const matrix = new THREE.Matrix4()
    const centerX = (model.width - 1) / 2
    const centerY = (model.height - 1) / 2
    const centerZ = (model.length - 1) / 2

    for (const group of groups) {
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(
          group.color[0] / 255,
          group.color[1] / 255,
          group.color[2] / 255,
        ),
        roughness: 0.82,
        metalness: 0.02,
      })
      const mesh = new THREE.InstancedMesh(geometry, material, group.blocks.length)
      mesh.userData.voxels = true

      group.blocks.forEach((block, index) => {
        matrix.makeTranslation(
          block.x - centerX,
          block.y - centerY,
          block.z - centerZ,
        )
        mesh.setMatrixAt(index, matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      scene.add(mesh)
    }

    const maxDimension = Math.max(model.width, model.height, model.length)
    grid.scale.setScalar(Math.max(1, maxDimension / 34))
    grid.position.y = -model.height / 2 - 0.52
    rendererState.camera.position.set(
      model.width * 1.2 + 18,
      model.height * 0.68 + 12,
      -(model.length * 2.2 + 28),
    )
    rendererState.camera.lookAt(0, 0, 0)
    rendererState.controls.target.set(0, 0, 0)
    rendererState.controls.update()

    return () => {
      geometry.dispose()
    }
  }, [groups, model])

  return (
    <div className="preview-stage">
      <div ref={hostRef} className="preview-canvas" aria-label="Voxel preview" />
      {model.blocks.length === 0 ? (
        <div className="preview-empty">
          <span>Drop a skin PNG to build the voxel preview.</span>
        </div>
      ) : null}
    </div>
  )
}
