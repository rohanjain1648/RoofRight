import { useTranslation } from 'react-i18next'
import type { Finance, Lifecycle } from '../api'
import { inr } from '../api'

/** Per-flat economics, funding routes, and what happens to the hardware in 25 years. */
export default function Money({ f, lc }: { f: Finance; lc: Lifecycle }) {
  const { t } = useTranslation()
  return (
    <>
      <div className="section">
        <h2>{t('money.title')}</h2>
        <p className="per-flat">
          {t('money.perFlat', { pay: inr(f.net_cost_per_flat_inr), save: inr(f.monthly_saving_per_flat_inr) })}
        </p>
        <div className="table-wrap">
          <table className="compare">
            <thead>
              <tr>
                <th scope="col">{t('money.route')}</th>
                <th scope="col">{t('money.monthly')}</th>
                <th scope="col">{t('money.perFlatCol')}</th>
                <th scope="col">{t('money.interest')}</th>
                <th scope="col">{t('money.net')}</th>
              </tr>
            </thead>
            <tbody>
              {f.options.map(o => (
                <tr key={o.id}>
                  <th scope="row">
                    {t(`money.opt.${o.id}`)}
                    {o.months > 0 && <span className="hint"> · {o.rate_pct}%, {o.months / 12} {t('results.years')}</span>}
                  </th>
                  <td>{o.months ? inr(o.emi_inr) : inr(o.upfront_inr) + ' ' + t('money.once')}</td>
                  <td>{o.months ? inr(o.emi_per_flat_inr) : inr(f.net_cost_per_flat_inr)}</td>
                  <td>{inr(o.interest_inr)}</td>
                  <td className={o.months ? (o.cash_positive_from_month_one ? 'pos' : 'neg') : ''}>
                    {o.months ? (o.monthly_net_inr >= 0 ? '+' : '−') + inr(Math.abs(o.monthly_net_inr)) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fine">{t('money.netNote', { save: inr(f.monthly_saving_inr) })} {!f.assumptions.rates_verified && t('money.ratesUnverified')}</p>
      </div>

      <div className="section">
        <h2>{t('life.title')}</h2>
        <p className="lead">{t('life.lead', { years: lc.life_years })}</p>
        <dl className="life">
          <div><dt>{t('life.panels')}</dt><dd>{lc.panels}</dd></div>
          <div><dt>{t('life.mass')}</dt><dd>{lc.panel_mass_kg.toLocaleString('en-IN')} kg</dd></div>
          <div><dt>{t('life.recoverable')}</dt><dd>{lc.recoverable_mass_kg.toLocaleString('en-IN')} kg</dd></div>
          <div><dt>{t('life.co2')}</dt><dd>{lc.co2_avoided_lifetime_tonnes} {t('results.tonnes')}</dd></div>
        </dl>
        <h3 className="sub">{t('life.asks')}</h3>
        <ul className="ticks">{lc.vendor_asks.map(a => <li key={a}>{a}</li>)}</ul>
        <p className="fine">{lc.regulation_note}</p>
      </div>
    </>
  )
}
