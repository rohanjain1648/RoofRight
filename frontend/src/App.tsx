import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from './api'
import type { Case } from './api'
import { setLang } from './i18n'
import BillStep, { type BillValues } from './components/BillStep'
import RoofStep, { type LatLng } from './components/RoofStep'
import SocietyStep, { type SocietyValues } from './components/SocietyStep'
import Results from './components/Results'
import Pack from './components/Pack'
import Landing from './components/Landing'
import VotePage from './components/VotePage'

const STEPS = ['bill', 'roof', 'society', 'results', 'pack'] as const
const EMPTY_BILL: BillValues = { units: '', tariff: '', load: '' }
const EMPTY_SOC: SocietyValues = { name: '', houses: '40', consent: '60', roofRight: 'society_common', structural: false, role: 'secretary' }

type Route = { name: 'home' } | { name: 'app' } | { name: 'vote'; id: string }

function parseRoute(hash: string): Route {
  const vote = hash.match(/^#\/vote\/([A-Za-z0-9]+)$/)
  if (vote) return { name: 'vote', id: vote[1] }
  if (hash.startsWith('#/app')) return { name: 'app' }
  return { name: 'home' }
}

function useRoute() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash))
  useEffect(() => {
    const on = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0e1f33" />
      <circle cx="16" cy="11.5" r="5" fill="#f5a400" />
      <path d="M5 26l4-7h14l4 7z" fill="#5b8de0" />
    </svg>
  )
}

function TopBar({ route }: { route: Route }) {
  const { t, i18n } = useTranslation()
  const isHi = i18n.language === 'hi'
  return (
    <header className="topbar">
      <div className="topbar-in">
        <button className="brand" onClick={() => { window.location.hash = '#/' }} aria-label={t('nav.home')}><Logo />{t('brand')}</button>
        {route.name === 'home' && (
          <nav className="nav" aria-label="Sections">
            <a href="#how">{t('nav.how')}</a>
            <a href="#aws-h">{t('nav.aws')}</a>
          </nav>
        )}
        <div className="topbar-end">
          <button className="lang-btn" onClick={() => setLang(isHi ? 'en' : 'hi')} lang={isHi ? 'en' : 'hi'}>{t('lang')}</button>
          {route.name === 'home' && <a className="btn sun hide-sm" href="#/app">{t('nav.start')}</a>}
        </div>
      </div>
    </header>
  )
}

function Wizard() {
  const { t } = useTranslation()
  const [step, setStep] = useState(0)
  const [bill, setBill] = useState<BillValues>(EMPTY_BILL)
  const [low, setLow] = useState<Record<string, boolean>>({})
  const [method, setMethod] = useState<string | null>(null)
  const [city, setCity] = useState('Delhi')
  const [points, setPoints] = useState<LatLng[]>([])
  const [area, setArea] = useState('')
  const [shading, setShading] = useState('10')
  const [soc, setSoc] = useState<SocietyValues>(EMPTY_SOC)
  const [kase, setKase] = useState<Case | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const num = (s: string) => (s.trim() === '' ? NaN : Number(s))
  const valid = [
    num(bill.units) > 0 && num(bill.tariff) > 0,
    num(area) > 0 && num(shading) >= 0 && num(shading) < 100,
    soc.name.trim().length > 0 && num(soc.houses) >= 1 && num(soc.consent) >= 0 && num(soc.consent) <= 100,
    true,
    true,
  ]

  async function build() {
    setBusy(true); setError(null)
    try {
      const c = await api.createCase({
        society_name: soc.name.trim(), city, num_houses: Math.round(num(soc.houses)), roof_area_m2: num(area),
        shading_pct: num(shading), sanctioned_load_kw: num(bill.load) > 0 ? num(bill.load) : null,
        monthly_units_kwh: num(bill.units), tariff_inr_per_kwh: num(bill.tariff), is_society: true,
        roof_right: soc.roofRight, consent_pct: Math.round(num(soc.consent)), structural_ok: soc.structural, role: soc.role,
      })
      setKase(c); go(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic'))
    } finally { setBusy(false) }
  }

  function restart() {
    setStep(0); setBill(EMPTY_BILL); setLow({}); setMethod(null); setPoints([]); setArea(''); setSoc(EMPTY_SOC); setKase(null); setError(null)
  }

  function go(n: number) { setError(null); setStep(n); window.scrollTo({ top: 0 }) }

  return (
    <div className={`shell${step >= 3 ? ' wide' : ''}`}>
      <ol className="stepper" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} data-state={i < step ? 'done' : i === step ? 'now' : 'todo'} aria-current={i === step ? 'step' : undefined}>
            <b>{i + 1}</b>{t(`steps.${s}`)}
          </li>
        ))}
      </ol>

      <main>
        {step === 0 && <BillStep value={bill} onChange={setBill} low={low} setLow={setLow} method={method} setMethod={setMethod} />}
        {step === 1 && <RoofStep city={city} setCity={setCity} points={points} setPoints={setPoints} area={area} setArea={setArea} shading={shading} setShading={setShading} />}
        {step === 2 && <SocietyStep value={soc} onChange={setSoc} />}
        {step === 3 && kase && <Results c={kase} />}
        {step === 4 && kase && <Pack c={kase} onRestart={restart} />}

        {error && <div className="alert err" role="alert">{error}</div>}

        {step < 4 && (
          <div className="actions">
            {step > 0 ? <button className="btn ghost" onClick={() => go(step - 1)}>{t('back')}</button> : <span />}
            {step === 2
              ? <button className="btn sun" disabled={!valid[2] || busy} onClick={build}>{busy ? '…' : t('society.build')}</button>
              : <button className="btn sun" disabled={!valid[step]} onClick={() => go(step + 1)}>{t('next')}</button>}
          </div>
        )}
      </main>
    </div>
  )
}

export default function App() {
  const route = useRoute()
  useEffect(() => { window.scrollTo({ top: 0 }) }, [route.name])
  return (
    <>
      <TopBar route={route} />
      {route.name === 'home' && <Landing onStart={() => { window.location.hash = '#/app' }} />}
      {route.name === 'app' && <Wizard />}
      {route.name === 'vote' && <VotePage id={route.id} />}
    </>
  )
}
