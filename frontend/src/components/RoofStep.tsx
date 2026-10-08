import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MapContainer, TileLayer, Polygon, CircleMarker, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { CITIES } from '../api'

export type LatLng = [number, number]

const CENTERS: Record<string, LatLng> = {
  Delhi: [28.6139, 77.209], Mumbai: [19.076, 72.8777], Bengaluru: [12.9716, 77.5946], Chennai: [13.0827, 80.2707],
  Hyderabad: [17.385, 78.4867], Kolkata: [22.5726, 88.3639], Jaipur: [26.9124, 75.7873], Ahmedabad: [23.0225, 72.5714],
  Pune: [18.5204, 73.8567], Chandigarh: [30.7333, 76.7794],
}

/** Polygon area in m² via a local equirectangular projection + shoelace formula. */
export function polygonAreaM2(pts: LatLng[]): number {
  if (pts.length < 3) return 0
  const lat0 = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180)
  const ky = 110540
  const xy = pts.map(([la, lo]) => [lo * kx, la * ky] as const)
  let a = 0
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i]
    const [x2, y2] = xy[(i + 1) % xy.length]
    a += x1 * y2 - x2 * y1
  }
  return Math.abs(a) / 2
}

function Clicks({ onAdd }: { onAdd: (p: LatLng) => void }) {
  useMapEvents({ click: e => onAdd([e.latlng.lat, e.latlng.lng]) })
  return null
}

function Recenter({ center }: { center: LatLng }) {
  const map = useMap()
  map.setView(center, map.getZoom())
  return null
}

interface Props {
  city: string
  setCity: (c: string) => void
  points: LatLng[]
  setPoints: (p: LatLng[]) => void
  area: string
  setArea: (a: string) => void
  shading: string
  setShading: (s: string) => void
}

export default function RoofStep({ city, setCity, points, setPoints, area, setArea, shading, setShading }: Props) {
  const { t } = useTranslation()
  const center = CENTERS[city] ?? CENTERS.Delhi
  const measured = useMemo(() => Math.round(polygonAreaM2(points)), [points])

  function add(p: LatLng) {
    const next = [...points, p]
    setPoints(next)
    const m = Math.round(polygonAreaM2(next))
    if (m > 0) setArea(String(m))
  }
  function undo() {
    const next = points.slice(0, -1)
    setPoints(next)
    if (next.length >= 3) setArea(String(Math.round(polygonAreaM2(next))))
  }

  return (
    <div className="stage">
      <h1>{t('roof.title')}</h1>
      <p className="lead">{t('roof.lead')}</p>

      <div className="field">
        <label htmlFor="city">{t('roof.city')}</label>
        <select id="city" className="input" value={city} onChange={e => setCity(e.target.value)}>
          {CITIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="map" aria-label={t('roof.draw')}>
        <MapContainer center={center} zoom={18} style={{ height: '100%' }} scrollWheelZoom={false}>
          <Recenter center={center} />
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
          <Clicks onAdd={add} />
          {points.length >= 3 && <Polygon positions={points} pathOptions={{ color: '#f2a900', weight: 3, fillOpacity: 0.25 }} />}
          {points.map((p, i) => <CircleMarker key={i} center={p} radius={5} pathOptions={{ color: '#13233a', fillColor: '#f2a900', fillOpacity: 1 }} />)}
        </MapContainer>
      </div>
      <div className="map-tools">
        <span className="hint">{points.length < 3 ? t('roof.draw') : `${t('roof.measured')}: ${measured} m²`}</span>
        <button type="button" className="btn ghost" onClick={undo} disabled={!points.length}>{t('roof.undo')}</button>
        <button type="button" className="btn ghost" onClick={() => setPoints([])} disabled={!points.length}>{t('roof.clear')}</button>
      </div>

      <div className="row two">
        <div className="field">
          <label htmlFor="area">{t('roof.area')}</label>
          <input id="area" className="input" type="number" inputMode="decimal" min="0" value={area} onChange={e => setArea(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="shade">{t('roof.shading')}</label>
          <input id="shade" className="input" type="number" inputMode="decimal" min="0" max="80" value={shading} onChange={e => setShading(e.target.value)} />
        </div>
      </div>
    </div>
  )
}
