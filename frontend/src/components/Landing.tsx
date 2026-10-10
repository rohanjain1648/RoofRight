import { Suspense, lazy, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { liveOutput } from '../solar'

const RoofScene = lazy(() => import('./RoofScene'))

const DEMO = { kwp: 24, roofAreaM2: 420, floors: 6, city: 'Delhi', month: 2 }

function HeroScene() {
  const { t } = useTranslation()
  const [hour, setHour] = useState(9.5)
  const [still] = useState(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
  })
  useEffect(() => {
    if (still) return
    const id = window.setInterval(() => setHour(h => (h >= 17.5 ? 7 : +(h + 0.05).toFixed(2))), 80)
    return () => window.clearInterval(id)
  }, [still])
  const { kw } = liveOutput(DEMO.kwp, DEMO.city, DEMO.month, hour)
  const hh = Math.floor(hour)
  return (
    <div className="hero-scene">
      <Suspense fallback={<div className="scene-fallback">{t('studio.loading')}</div>}>
        <RoofScene {...DEMO} hour={hour} showcase={!still} />
      </Suspense>
      <div className="studio-readout">
        <span className="ro-k">{t('landing.demoRoof')}</span>
        <span className="ro-v">{kw.toFixed(1)} kW</span>
        <span className="ro-k">{String(hh).padStart(2, '0')}:{String(Math.round((hour - hh) * 60)).padStart(2, '0')}</span>
      </div>
    </div>
  )
}

export default function Landing({ onStart }: { onStart: () => void }) {
  const { t } = useTranslation()
  const stuck = t('landing.stuck', { returnObjects: true }) as { fact: string; src: string; href: string }[]
  const steps = t('landing.steps', { returnObjects: true }) as { h: string; p: string }[]
  const pack = t('landing.pack', { returnObjects: true }) as { h: string; p: string }[]
  const aws = t('landing.aws', { returnObjects: true }) as { name: string; p: string }[]
  const trust = t('landing.trust', { returnObjects: true }) as { h: string; p: string }[]

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-copy">
          <h1 className="display">{t('landing.h1')}</h1>
          <p className="hero-lead">{t('landing.lead')}</p>
          <div className="hero-cta">
            <button className="btn sun big" onClick={onStart}>{t('landing.cta')}</button>
            <a className="text-link" href="#how">{t('landing.how')}</a>
          </div>
          <p className="fine">{t('landing.noAccount')}</p>
        </div>
        <HeroScene />
      </section>

      <section className="band" aria-labelledby="stuck-h">
        <h2 id="stuck-h">{t('landing.stuckH')}</h2>
        <ul className="stuck">
          {stuck.map(s => (
            <li key={s.fact}><p>{s.fact}</p><a href={s.href} target="_blank" rel="noreferrer">{s.src}</a></li>
          ))}
        </ul>
      </section>

      <section id="how" className="band" aria-labelledby="how-h">
        <h2 id="how-h">{t('landing.howH')}</h2>
        <ol className="steps-list">
          {steps.map((s, i) => (
            <li key={s.h}><span className="step-n">{i + 1}</span><div><h3>{s.h}</h3><p>{s.p}</p></div></li>
          ))}
        </ol>
      </section>

      <section className="band" aria-labelledby="pack-h">
        <h2 id="pack-h">{t('landing.packH')}</h2>
        <div className="pack-grid">
          {pack.map(p => <div key={p.h} className="pack-item"><h3>{p.h}</h3><p>{p.p}</p></div>)}
        </div>
      </section>

      <section className="band" aria-labelledby="trust-h">
        <h2 id="trust-h">{t('landing.trustH')}</h2>
        <div className="trust">
          {trust.map(p => <div key={p.h}><h3>{p.h}</h3><p>{p.p}</p></div>)}
        </div>
      </section>

      <section className="band aws-band" aria-labelledby="aws-h">
        <h2 id="aws-h">{t('landing.awsH')}</h2>
        <p className="lead">{t('landing.awsLead')}</p>
        <table className="aws-table">
          <tbody>
            {aws.map(a => <tr key={a.name}><th scope="row">{a.name}</th><td>{a.p}</td></tr>)}
          </tbody>
        </table>
      </section>

      <section className="closing">
        <h2>{t('landing.closeH')}</h2>
        <button className="btn sun big" onClick={onStart}>{t('landing.cta')}</button>
      </section>

      <footer className="foot">
        <p>{t('landing.footer')}</p>
      </footer>
    </div>
  )
}
