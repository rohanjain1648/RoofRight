import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, inr } from '../api'
import type { PublicCase, Tally } from '../api'

/** What a resident sees after tapping the WhatsApp link: the proposal in four numbers, and one decision. */
export default function VotePage({ id }: { id: string }) {
  const { t } = useTranslation()
  const [p, setP] = useState<PublicCase | null>(null)
  const [flat, setFlat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ agree: boolean; tally: Tally } | null>(null)

  useEffect(() => {
    api.publicCase(id).then(setP).catch(e => setError(e instanceof Error ? e.message : t('errors.generic')))
  }, [id, t])

  async function cast(agree: boolean) {
    if (!flat.trim()) { setError(t('vote.needFlat')); return }
    setBusy(true); setError(null)
    try {
      const r = await api.vote(id, flat, agree)
      setDone({ agree, tally: r.tally })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic'))
    } finally { setBusy(false) }
  }

  if (error && !p) return <div className="vote"><div className="alert err" role="alert">{error}</div></div>
  if (!p) return <div className="vote"><p className="lead">{t('vote.loading')}</p></div>

  return (
    <div className="vote stage">
      <p className="vote-where">{p.society_name}, {p.city}</p>
      <h1>{t('vote.title', { kwp: p.system_kwp })}</h1>

      <dl className="vote-facts">
        <div><dt>{t('vote.pay')}</dt><dd>{inr(p.net_cost_per_flat_inr)}</dd></div>
        <div><dt>{t('vote.save')}</dt><dd>{inr(p.monthly_saving_per_flat_inr)}</dd></div>
        <div><dt>{t('results.payback')}</dt><dd>{p.payback_years ?? '–'} {t('results.years')}</dd></div>
        <div><dt>{t('results.co2')}</dt><dd>{p.co2_avoided_tonnes_per_year} {t('results.tonnes')}</dd></div>
      </dl>

      {done ? (
        <div className="ok-banner" role="status">
          {done.agree ? t('vote.thanksYes') : t('vote.thanksNo')}{' '}
          {t('drive.count', { yes: done.tally.yes, houses: done.tally.houses, voted: done.tally.voted })}
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="flat">{t('vote.flat')}</label>
            <input id="flat" className="input" value={flat} maxLength={12} autoComplete="off"
              placeholder="B-204" onChange={e => setFlat(e.target.value)} />
          </div>
          <div className="actions vote-actions">
            <button className="btn sun" disabled={busy} onClick={() => cast(true)}>{t('vote.yes')}</button>
            <button className="btn ghost" disabled={busy} onClick={() => cast(false)}>{t('vote.no')}</button>
          </div>
          {error && <div className="alert err" role="alert">{error}</div>}
          <p className="fine">{t('vote.note')}</p>
        </>
      )}
    </div>
  )
}
