/**
 * Sun position and clear-sky panel output, for the 3D studio.
 * Standard textbook approximations (Cooper declination, Meinel clear-sky DNI). Illustrative, not a yield forecast:
 * the annual figures on the results screen come from the backend engine, not from here.
 */

const RAD = Math.PI / 180

export const CITY_LAT: Record<string, number> = {
  Delhi: 28.61, Mumbai: 19.08, Bengaluru: 12.97, Chennai: 13.08, Hyderabad: 17.39,
  Kolkata: 22.57, Jaipur: 26.91, Ahmedabad: 23.02, Pune: 18.52, Chandigarh: 30.73,
}

export interface SunPos {
  elevation: number // degrees above horizon
  azimuthFromSouth: number // degrees, positive towards west
  dir: [number, number, number] // unit vector towards the sun; scene axes: +x east, +y up, +z south
}

/** Day-of-year for the 15th of a month (0 = January). */
export const midMonthDay = (month: number) => [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349][month]

export function sunPosition(latDeg: number, dayOfYear: number, solarHour: number): SunPos {
  const decl = 23.44 * Math.sin(((360 / 365) * (284 + dayOfYear)) * RAD) * RAD
  const lat = latDeg * RAD
  const h = 15 * (solarHour - 12) * RAD
  const sinEl = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(h)
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)))
  const az = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat))
  const ce = Math.cos(el)
  return {
    elevation: el / RAD,
    azimuthFromSouth: az / RAD,
    dir: [-Math.sin(az) * ce, Math.sin(el), Math.cos(az) * ce],
  }
}

/** Clear-sky output of a south-facing array tilted at `tiltDeg`, in kW. Performance ratio 0.8. */
export function clearSkyKw(kwp: number, sun: SunPos, tiltDeg: number): number {
  if (sun.elevation <= 0.5) return 0
  const am = 1 / Math.sin(sun.elevation * RAD)
  const dni = 1.353 * Math.pow(0.7, Math.pow(am, 0.678)) // kW/m²
  const t = tiltDeg * RAD
  const normal = [0, Math.cos(t), Math.sin(t)]
  const cosI = Math.max(0, sun.dir[0] * normal[0] + sun.dir[1] * normal[1] + sun.dir[2] * normal[2])
  const diffuse = 0.1 * dni * (1 + Math.cos(t)) / 2
  return Math.max(0, kwp * (dni * cosI + diffuse) * 0.8)
}

/** Hour-by-hour clear-sky curve for one day, for the mini chart. */
export function dayCurve(kwp: number, latDeg: number, month: number, tiltDeg: number) {
  const d = midMonthDay(month)
  const out: { hour: number; kw: number }[] = []
  for (let hr = 5; hr <= 19; hr += 0.5) out.push({ hour: hr, kw: +clearSkyKw(kwp, sunPosition(latDeg, d, hr), tiltDeg).toFixed(2) })
  return out
}

/** Fixed tilt: roughly the latitude, clamped to what flat-roof mounting structures usually allow. */
export const tiltFor = (latDeg: number) => Math.min(30, Math.max(10, Math.round(latDeg)))

export const PANEL_W = 2.28 // m, along the row (east-west)
export const PANEL_D = 1.13 // m, up the slope
export const PANEL_KW = 0.55

export interface SceneProps {
  kwp: number
  roofAreaM2: number
  floors: number
  city: string
  month: number
  hour: number
  /** Gentle camera drift for the landing page. */
  showcase?: boolean
}

export interface Layout { width: number; depth: number; panels: [number, number][]; fitted: number; tank: [number, number] }

/** Lay out south-facing panel rows on a rectangular roof with a setback, pitch chosen to limit winter shading. */
export function layoutRoof(roofAreaM2: number, wanted: number, tiltDeg: number): Layout {
  const area = Math.max(roofAreaM2, 40)
  const width = Math.sqrt(area * 1.5) // east-west is the long side, which suits south-facing rows
  const depth = area / width
  const setback = 1.0
  const pitch = PANEL_D * Math.cos((tiltDeg * Math.PI) / 180) + 1.0
  const cols = Math.max(1, Math.floor((width - 2 * setback) / (PANEL_W + 0.05)))
  const rows = Math.max(1, Math.floor((depth - 2 * setback - 2.2) / pitch))
  const panels: [number, number][] = []
  const x0 = -((cols - 1) * (PANEL_W + 0.05)) / 2
  // fill from the south edge northwards (south is +z), so the tank sits in the north-east corner
  for (let r = 0; r < rows && panels.length < wanted; r++) {
    for (let c = 0; c < cols && panels.length < wanted; c++) {
      panels.push([x0 + c * (PANEL_W + 0.05), depth / 2 - setback - PANEL_D / 2 - r * pitch])
    }
  }
  return { width, depth, panels, fitted: panels.length, tank: [width / 2 - 1.8, -depth / 2 + 1.8] }
}

/** Current clear-sky output for the studio readout. */
export function liveOutput(kwp: number, city: string, month: number, hour: number) {
  const lat = CITY_LAT[city] ?? 28.61
  const sun = sunPosition(lat, midMonthDay(month), hour)
  return { kw: clearSkyKw(kwp, sun, tiltFor(lat)), sun }
}
