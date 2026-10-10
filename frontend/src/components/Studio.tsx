import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, XAxis } from 'recharts'
import { CITY_LAT, PANEL_KW, dayCurve, layoutRoof, liveOutput, tiltFor } from '../solar'

const RoofScene = lazy(() => import('./RoofScene'))

interface Props {
  kwp: number
  roofAreaM2: number
  floors: number
  city: string
}

const reduceMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/** The 3D roof studio: your building, your panels, the real sun for your city. */
export default function Studio({ kwp, roofAreaM2, floors, city }: Props) {
  const { t } = useTranslation()
  const [month, setMonth] = useState(new Date().getMonth())
  const [hour, setHour] = useState(10)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => setHour(h => (h >= 18.5 ? 6 : +(h + 0.25).toFixed(2))), 120)
    return () => window.clearInterval(id)
  }, [playing])

  const lat = CITY_LAT[city] ?? 28.61
  const tilt = tiltFor(lat)
  const wanted = Math.max(1, Math.round(kwp / PANEL_KW))
  const fitted = useMemo(() => layoutRoof(roofAreaM2, wanted, tilt).fitted, [roofAreaM2, wanted, tilt])
  const { kw, sun } = liveOutput(kwp, city, month, hour)
  const curve = useMemo(() => dayCurve(kwp, lat, month, tilt), [kwp, lat, month, tilt])
  const dayKwh = curve.reduce((s, p) => s + p.kw * 0.5, 0)
  const hh = Math.floor(hour)
  const clock = `${String(hh).padStart(2, '0')}:${String(Math.round((hour - hh) * 60)).padStart(2, '0')}`
  const months = t('studio.months', { returnObjects: true }) as string[]

  return (
    <section className="studio" aria-labelledby="studio-h">
      <div className="studio-canvas">
        <Suspense fallback={<div className="scene-fallback">{t('studio.loading')}</div>}>
          <RoofScene kwp={kwp} roofAreaM2={roofAreaM2} floors={floors} city={city} month={month} hour={hour} />
        </Suspense>
        <div className="studio-readout" aria-live="polite">
          <span className="ro-k">{t('studio.now', { time: clock })}</span>
          <span className="ro-v">{kw.toFixed(1)} kW</span>
          <span className="ro-k">{sun.elevation > 0 ? t('studio.sunAt', { deg: Math.round(sun.elevation) }) : t('studio.night')}</span>
        </div>
      </div>

      <div className="studio-panel">
        <h2 id="studio-h">{t('studio.title')}</h2>
        <p className="hint">{t('studio.lead', { tilt })}</p>
        {fitted < wanted && <p className="hint warn">{t('studio.fit', { fitted, wanted })}</p>}

        <div className="field">
          <label htmlFor="hour">{t('studio.time')} <b>{clock}</b></label>
          <input id="hour" type="range" min={5} max={19} step={0.25} value={hour}
            onChange={e => { setPlaying(false); setHour(Number(e.target.value)) }} />
        </div>
        <div className="row two">
          <div className="field">
            <label htmlFor="month">{t('studio.month')}</label>
            <select id="month" className="input" value={month} onChange={e => setMonth(Number(e.target.value))}>
              {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <span className="field-label" aria-hidden="true">&nbsp;</span>
            <button type="button" className="btn ghost" onClick={() => setPlaying(p => !p)} disabled={reduceMotion() && !playing}>
              {playing ? t('studio.pause') : t('studio.play')}
            </button>
          </div>
        </div>

        <div className="mini-curve" role="img" aria-label={t('studio.curve', { kwh: dayKwh.toFixed(0) })}>
          <ResponsiveContainer width="100%" height={90}>
            <AreaChart data={curve} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <XAxis dataKey="hour" type="number" domain={[5, 19]} ticks={[6, 9, 12, 15, 18]} tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} axisLine={false} tickLine={false} />
              <Area type="monotone" dataKey="kw" stroke="var(--sun-deep)" fill="var(--sun)" fillOpacity={0.25} strokeWidth={2} isAnimationActive={false} />
              <ReferenceLine x={hour} stroke="var(--ink)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="hint">{t('studio.curve', { kwh: dayKwh.toFixed(0) })}</p>
        <p className="fine">{t('studio.disclaimer')}</p>
      </div>
    </section>
  )
}
