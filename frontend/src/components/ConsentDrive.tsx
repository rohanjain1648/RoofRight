import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, inr } from '../api'
import type { Case, Tally } from '../api'

export const voteUrl = (id: string) => `${window.location.origin}${window.location.pathname}#/vote/${id}`

/** Secretary's view: share one link, watch flats agree, see the Cedar consent gate flip. */
export default function ConsentDrive({ c }: { c: Case }) {
  const { t, i18n } = useTranslation()
  const [tally, setTally] = useState<Tally | null>(c.consent_tally ?? null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const url = voteUrl(c.id)

  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const p = await api.publicCase(c.id)
        if (alive) { setTally(p.tally); setError(null) }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : t('errors.generic'))
      }
    }
    tick()
    const id = window.setInterval(tick, 4000)
    return () => { alive = false; window.clearInterval(id) }
  }, [c.id, t])

  const message = t('drive.whatsapp', {
    society: c.society_name, kwp: c.result.system_kwp,
    pay: inr(c.finance.net_cost_per_flat_inr), save: inr(c.finance.monthly_saving_per_flat_inr), url,
  })
  const wa = `https://wa.me/?text=${encodeURIComponent(message)}`
  const pct = tally?.pct ?? 0
  const passed = pct >= 51

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
    catch { setError(t('drive.copyFail')) }
  }

  return (
    <div className="drive">
      <h2>{t('drive.title')}</h2>
      <p className="lead">{t('drive.lead')}</p>

      <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t('drive.meter')}>
        <div className="meter-fill" style={{ width: `${pct}%` }} data-pass={passed} />
        <div className="meter-line" style={{ left: '51%' }}><span>51%</span></div>
      </div>
      <p className="meter-text" aria-live="polite">
        {tally
          ? t('drive.count', { yes: tally.yes, houses: tally.houses, voted: tally.voted })
          : t('drive.none')}
        {' '}
        <strong className={passed ? 'pos' : ''}>
          {passed ? t('drive.passed') : tally ? t('drive.needed', { n: tally.needed_for_majority }) : ''}
        </strong>
      </p>

      <div className="share">
        <input className="input" readOnly value={url} aria-label={t('drive.link')} onFocus={e => e.currentTarget.select()} />
        <button type="button" className="btn ghost" onClick={copy}>{copied ? t('drive.copied') : t('drive.copy')}</button>
        <a className="btn wa" href={wa} target="_blank" rel="noreferrer" lang={i18n.language}>{t('drive.send')}</a>
      </div>
      {error && <div className="alert err" role="alert">{error}</div>}
      <p className="fine">{t('drive.note')}</p>
    </div>
  )
}
