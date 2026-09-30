'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// One captured viewport. geometryOnly is true for clay captures: the image
// conveys shape only, so downstream generation applies materials itself.
export interface Capture3D {
  data: string
  mimeType: string
  preview: string
  geometryOnly: boolean
}

interface ModelViewerProps {
  maxCaptures: number
  onUse: (captures: Capture3D[]) => void
  onClose: () => void
}

interface Engine {
  renderer: THREE.WebGLRenderer
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  pivot: THREE.Group
  render: () => void
  fit: () => void
}

type RenderMode = 'clay' | 'original'

const MAX_FILE_BYTES = 80 * 1024 * 1024
const SUPPORTED = ['glb', 'gltf', 'obj', 'stl']

function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry?.dispose()
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    mats.forEach((m) => {
      if (!m) return
      Object.values(m).forEach((v) => {
        if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose()
      })
      m.dispose()
    })
  })
}

export default function ModelViewer({ maxCaptures, onUse, onClose }: ModelViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const originalsRef = useRef<Map<THREE.Mesh, THREE.Material | THREE.Material[]>>(new Map())
  const clayRef = useRef<THREE.MeshStandardMaterial | null>(null)

  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [hasOriginal, setHasOriginal] = useState(false)
  const [renderMode, setRenderMode] = useState<RenderMode>('clay')
  const [zUp, setZUp] = useState(false)
  const [captures, setCaptures] = useState<Capture3D[]>([])
  const [dragging, setDragging] = useState(false)

  // ---- Engine lifecycle ----
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.domElement.style.display = 'block'
    mount.appendChild(renderer.domElement)

    // The capture is a reference image, so its job is to show shape clearly:
    // a mid-grey object against a slightly darker light backdrop keeps the
    // silhouette and edges readable instead of washing out to white.
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xe6e6e6)

    // Neutral studio reflections so metals and glossy materials don't render black.
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = envTarget.texture
    scene.environmentIntensity = 0.7 // the room map alone overexposes light materials

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000)
    // Key light rides on the camera so shading stays consistent while orbiting.
    const key = new THREE.DirectionalLight(0xffffff, 0.9)
    key.position.set(2, 3, 4)
    camera.add(key)
    scene.add(camera)

    const pivot = new THREE.Group()
    scene.add(pivot)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = false

    const render = () => renderer.render(scene, camera)
    controls.addEventListener('change', render)

    const fit = () => {
      const box = new THREE.Box3().setFromObject(pivot)
      if (box.isEmpty()) return
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z) || 1
      const fov = THREE.MathUtils.degToRad(camera.fov)
      // Narrow canvases need more distance to keep the model in frame.
      const aspectPad = Math.max(1, 1 / camera.aspect)
      const dist = ((maxDim / 2) / Math.tan(fov / 2)) * 1.8 * aspectPad
      camera.near = dist / 100
      camera.far = dist * 100
      camera.updateProjectionMatrix()
      camera.position.copy(center).addScaledVector(new THREE.Vector3(1, 0.7, 1).normalize(), dist)
      controls.target.copy(center)
      controls.update()
      render()
    }

    const resize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      render()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(mount)
    resize()

    engineRef.current = { renderer, camera, controls, pivot, render, fit }
    const originals = originalsRef.current

    return () => {
      ro.disconnect()
      controls.removeEventListener('change', render)
      controls.dispose()
      disposeObject(pivot)
      originals.clear()
      clayRef.current?.dispose()
      clayRef.current = null
      envTarget.dispose()
      pmrem.dispose()
      renderer.dispose()
      // Browsers cap live WebGL contexts (~16); release ours explicitly.
      renderer.forceContextLoss()
      renderer.domElement.remove()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // ---- Materials / orientation ----
  const applyMode = useCallback((mode: RenderMode) => {
    const engine = engineRef.current
    if (!engine) return
    if (!clayRef.current) {
      clayRef.current = new THREE.MeshStandardMaterial({
        color: 0x9b9b9b,
        roughness: 0.55,
        metalness: 0.05,
        side: THREE.DoubleSide, // hides holes from badly oriented faces
      })
    }
    const clay = clayRef.current
    engine.pivot.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.material = mode === 'original' ? originalsRef.current.get(mesh) ?? clay : clay
    })
    engine.render()
  }, [])

  const changeMode = (mode: RenderMode) => {
    setRenderMode(mode)
    applyMode(mode)
  }

  const changeZUp = (z: boolean) => {
    const engine = engineRef.current
    setZUp(z)
    if (!engine) return
    engine.pivot.rotation.x = z ? -Math.PI / 2 : 0
    engine.pivot.updateMatrixWorld(true)
    engine.fit()
  }

  // ---- Loading ----
  const loadFile = useCallback(
    async (file: File) => {
      const engine = engineRef.current
      if (!engine) return

      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!SUPPORTED.includes(ext)) {
        setStatus('error')
        setError('Unsupported format. Export your model as GLB, OBJ or STL (STEP, IGES and native CAD files cannot be read in the browser).')
        return
      }
      if (file.size > MAX_FILE_BYTES) {
        setStatus('error')
        setError('File too large (max 80 MB). Try decimating the mesh or exporting a lighter GLB.')
        return
      }

      setStatus('loading')
      setError('')
      setFileName(file.name)

      try {
        let object: THREE.Object3D
        let original = false

        if (ext === 'glb' || ext === 'gltf') {
          const buf = await file.arrayBuffer()
          const gltf = await new Promise<GLTF>((resolve, reject) =>
            new GLTFLoader().parse(buf, '', resolve, reject)
          )
          object = gltf.scene
          original = true
        } else if (ext === 'obj') {
          object = new OBJLoader().parse(await file.text())
        } else {
          const geometry = new STLLoader().parse(await file.arrayBuffer())
          // Smooth gentle curves but keep hard CAD edges crisp.
          object = new THREE.Mesh(toCreasedNormals(geometry, Math.PI / 6))
        }

        // Swap out any previous model.
        engine.pivot.children.slice().forEach((c) => {
          engine.pivot.remove(c)
          disposeObject(c)
        })
        originalsRef.current.clear()
        object.traverse((o) => {
          const mesh = o as THREE.Mesh
          if (mesh.isMesh) originalsRef.current.set(mesh, mesh.material)
        })
        engine.pivot.add(object)

        const mode: RenderMode = original ? 'original' : 'clay'
        const z = ext === 'stl' // CAD exports are usually Z-up
        setHasOriginal(original)
        setRenderMode(mode)
        setZUp(z)
        engine.pivot.rotation.x = z ? -Math.PI / 2 : 0
        applyMode(mode)
        engine.pivot.updateMatrixWorld(true)
        engine.fit()
        setStatus('ready')
      } catch (err) {
        console.error('3D load failed:', err)
        setStatus('error')
        setError(
          ext === 'gltf'
            ? 'Could not read this glTF. It may reference external files — export a single self-contained GLB instead.'
            : 'Could not read this file. If it is a GLB with Draco/Meshopt compression, re-export it uncompressed.'
        )
      }
    },
    [applyMode]
  )

  // ---- Capturing ----
  const capture = () => {
    const engine = engineRef.current
    if (!engine || status !== 'ready') return
    engine.render()
    // JPEG keeps each capture a few hundred KB — well under the 4.5 MB
    // request limit the image API routes run under on Vercel.
    const url = engine.renderer.domElement.toDataURL('image/jpeg', 0.92)
    const [, data] = url.split(',')
    const cap: Capture3D = { data, mimeType: 'image/jpeg', preview: url, geometryOnly: renderMode === 'clay' }
    setCaptures((prev) => (maxCaptures === 1 ? [cap] : [...prev, cap].slice(-maxCaptures)))
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) loadFile(f)
  }

  const single = maxCaptures === 1
  const hasModel = status === 'ready' || status === 'loading'

  return (
    // Opaque, unlike the lightbox: the controls sit over the form and the
    // page text must not show through them.
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div>
          <p className="text-sm font-semibold">3D model → reference</p>
          <p className="text-xs text-gray-400">
            {fileName ? fileName : 'Load a GLB, OBJ or STL file. It stays in your browser and is never uploaded.'}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-gray-300 hover:text-white p-1" title="Close (Esc)">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Viewport — the mount node always exists so the engine can attach to it. */}
      <div className="relative flex-1 min-h-0 mx-4 rounded-lg overflow-hidden bg-gray-200">
        <div ref={mountRef} className="absolute inset-0" />

        {!hasModel && (
          <label
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`absolute inset-0 flex flex-col items-center justify-center gap-2 cursor-pointer text-center px-6 transition-colors ${
              dragging ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
            </svg>
            <span className="text-sm font-medium">Drop a 3D file here, or click to choose</span>
            <span className="text-xs">GLB · OBJ · STL</span>
            {error && <span className="text-xs text-red-600 max-w-md mt-2">{error}</span>}
            <input
              type="file"
              accept=".glb,.gltf,.obj,.stl"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) loadFile(f)
                e.target.value = ''
              }}
            />
          </label>
        )}

        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        )}

        {status === 'ready' && (
          <p className="absolute bottom-2 left-3 text-[11px] text-gray-500 pointer-events-none">
            Drag to rotate · scroll to zoom · right-drag to pan
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 py-3 space-y-3">
        {status === 'ready' && (
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
            <div className="flex rounded-lg overflow-hidden border border-gray-600">
              <button
                type="button"
                onClick={() => changeMode('clay')}
                className={`px-3 py-1.5 ${renderMode === 'clay' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
              >
                Clay (shape only)
              </button>
              <button
                type="button"
                onClick={() => changeMode('original')}
                disabled={!hasOriginal}
                title={hasOriginal ? undefined : 'This format has no materials to keep'}
                className={`px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${renderMode === 'original' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
              >
                Original colors
              </button>
            </div>
            <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer">
              <input type="checkbox" checked={zUp} onChange={(e) => changeZUp(e.target.checked)} className="accent-blue-500" />
              Z-up (CAD) — tick if the model lies on its back
            </label>
            <button
              type="button"
              onClick={() => engineRef.current?.fit()}
              className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-600"
            >
              Reset view
            </button>
            <label className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-600 cursor-pointer">
              Change file
              <input
                type="file"
                accept=".glb,.gltf,.obj,.stl"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) loadFile(f)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        )}

        {status === 'ready' && (
          <p className="text-[11px] text-gray-400 text-center max-w-2xl mx-auto">
            {renderMode === 'clay'
              ? 'Clay: the AI takes the shape only and applies the materials from your brief. Use this for untextured or CAD models.'
              : 'Original colors: the model’s own colors and textures are kept in the reference.'}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          {captures.map((c, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.preview} alt={`View ${i + 1}`} className="h-16 w-auto rounded border border-gray-600" />
              <button
                type="button"
                onClick={() => setCaptures((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={capture}
            disabled={status !== 'ready'}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {single ? '📷 Capture this view' : `📷 Capture view${captures.length ? ` (${captures.length}/${maxCaptures})` : ''}`}
          </button>

          <button
            type="button"
            onClick={() => onUse(captures)}
            disabled={captures.length === 0}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 px-5 rounded-lg transition-colors"
          >
            {single ? 'Use this view →' : `Use ${captures.length || ''} view${captures.length === 1 ? '' : 's'} →`}
          </button>
        </div>
      </div>
    </div>
  )
}
