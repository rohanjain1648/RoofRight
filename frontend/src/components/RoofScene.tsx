import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { CITY_LAT, PANEL_D, PANEL_KW, PANEL_W, layoutRoof, midMonthDay, sunPosition, tiltFor } from '../solar'
import type { Layout, SceneProps } from '../solar'

function windowTexture(floors: number) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#f3f1ec'
  g.fillRect(0, 0, 256, 256)
  g.fillStyle = '#9fb3c8'
  for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) g.fillRect(14 + x * 40, 22 + y * 60, 24, 30)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, floors / 4)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function Building({ layout, floors, tilt }: { layout: Layout; floors: number; tilt: number }) {
  const height = floors * 3
  const tex = useMemo(() => windowTexture(floors), [floors])
  const panelGeo = useMemo(() => new THREE.BoxGeometry(PANEL_W, 0.04, PANEL_D), [])
  const frameGeo = useMemo(() => new THREE.BoxGeometry(PANEL_W, 0.05, 0.05), [])
  const rad = (tilt * Math.PI) / 180

  return (
    <group>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[layout.width, height, layout.depth]} />
        <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
      {/* parapet */}
      {([[0, layout.depth / 2, layout.width, 0.2], [0, -layout.depth / 2, layout.width, 0.2], [layout.width / 2, 0, 0.2, layout.depth], [-layout.width / 2, 0, 0.2, layout.depth]] as const).map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, height + 0.45, z]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.9, d]} />
          <meshStandardMaterial color="#e7e3db" roughness={0.95} />
        </mesh>
      ))}
      {/* water tank: the classic Indian rooftop shade-caster */}
      <mesh position={[layout.tank[0], height + 1.1, layout.tank[1]]} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 0.9, 2.2, 24]} />
        <meshStandardMaterial color="#2d2d2d" roughness={0.6} />
      </mesh>
      {layout.panels.map(([x, z], i) => (
        <group key={i} position={[x, height + 0.55, z]} rotation={[rad, 0, 0]}>
          <mesh geometry={panelGeo} castShadow receiveShadow>
            <meshStandardMaterial color="#1b3f8f" metalness={0.35} roughness={0.25} />
          </mesh>
          <mesh geometry={frameGeo} position={[0, 0.01, PANEL_D / 2]}>
            <meshStandardMaterial color="#c9d2dc" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Sun({ dir, elevation }: { dir: [number, number, number]; elevation: number }) {
  const light = useRef<THREE.DirectionalLight>(null)
  const pos: [number, number, number] = [dir[0] * 70, Math.max(dir[1], 0.02) * 70, dir[2] * 70]
  useEffect(() => {
    if (light.current) {
      light.current.target.position.set(0, 0, 0)
      light.current.target.updateMatrixWorld()
    }
  }, [])
  const up = elevation > 0
  return (
    <>
      <directionalLight ref={light} position={pos} intensity={up ? 2.6 : 0} castShadow
        shadow-mapSize={[2048, 2048]} shadow-camera-left={-40} shadow-camera-right={40}
        shadow-camera-top={40} shadow-camera-bottom={-40} shadow-camera-far={200} shadow-bias={-0.0004} />
      <mesh position={pos}>
        <sphereGeometry args={[2.2, 24, 24]} />
        <meshBasicMaterial color={up ? '#f5a400' : '#9aa6b5'} />
      </mesh>
    </>
  )
}

function Drift({ on }: { on: boolean }) {
  useFrame(({ camera, clock }) => {
    if (!on) return
    const t = clock.getElapsedTime() * 0.06
    camera.position.x = Math.sin(t) * 46
    camera.position.z = Math.cos(t) * 46
    camera.lookAt(0, 8, 0)
  })
  return null
}

export default function RoofScene({ kwp, roofAreaM2, floors, city, month, hour, showcase = false }: SceneProps) {
  const lat = CITY_LAT[city] ?? 28.61
  const tilt = tiltFor(lat)
  const wanted = Math.max(1, Math.round(kwp / PANEL_KW))
  const layout = useMemo(() => layoutRoof(roofAreaM2, wanted, tilt), [roofAreaM2, wanted, tilt])
  const sun = useMemo(() => sunPosition(lat, midMonthDay(month), hour), [lat, month, hour])
  const sky = sun.elevation > 0 ? (sun.elevation < 12 ? '#fde7c4' : '#eef5fb') : '#d9dee6'
  const [webgl] = useState(() => {
    try { return !!document.createElement('canvas').getContext('webgl2') } catch { return false }
  })
  if (!webgl) return <div className="scene-fallback">3D view needs WebGL, which this browser has turned off.</div>

  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [34, 30, 40], fov: 38 }} style={{ background: sky }}
      aria-label={`3D model: ${layout.fitted} panels on a ${floors}-floor building in ${city}`}>
      <hemisphereLight args={['#ffffff', '#cfd8e3', sun.elevation > 0 ? 0.9 : 0.35]} />
      <Sun dir={sun.dir} elevation={sun.elevation} />
      <Building layout={layout} floors={floors} tilt={tilt} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#e9ece6" roughness={1} />
      </mesh>
      <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={80} blur={2.5} far={30} />
      {showcase ? <Drift on /> : <OrbitControls target={[0, floors * 3, 0]} maxPolarAngle={Math.PI / 2.1} minDistance={15} maxDistance={120} enablePan={false} />}
    </Canvas>
  )
}
