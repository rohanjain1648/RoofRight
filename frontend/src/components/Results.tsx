import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Case } from '../api'
import { inr } from '../api'
import RoofArray from './RoofArray'

export default function Results({ c }: { c: Case }) {
  const { t } = useTranslation()
  const r = c.result
  const a = r.assumptions

  return (
    <div className="stage">
      <h1>{t('results.title')}</h1>
      <p className="lead">{t(`results.limited.${r.limiting_factor}`)}</p>

      <div className="roof-hero">
        <RoofArray kwp={r.system_kwp} roofAreaM2={c.roof_area_m2 ?? 0} label={`${r.system_kwp} kWp`} />
        <div className="hero-line">
          <span className="big">{r.system_kwp} kWp</span>
          <span>{r.annual_generation_kwh.toLocaleString('en-IN')} kWh · {r.offset_pct}% {t('results.offset')}</span>
        </div>
      </div>

      {!a.subsidy_verified && <div className="alert warn" role="note">{t('results.unverified')}</div>}

      <div className="facts">
        <div className="fact"><div className="k">{t('results.cost')}</div><div className="v">{inr(r.gross_cost_inr)}</div></div>
        <div className="fact"><div className="k">{t('results.subsidy')}</div><div className="v">{inr(r.subsidy_inr)}</div></div>
        <div className="fact key"><div className="k">{t('results.net')}</div><div className="v">{inr(r.net_cost_inr)}</div></div>
        <div className="fact"><div className="k">{t('results.savings')}</div><div className="v">{inr(r.year1_savings_inr)}</div></div>
        <div className="fact key"><div className="k">{t('results.payback')}</div><div className="v">{r.payback_years ?? '–'} {t('results.years')}</div></div>
        <div className="fact"><div className="k">{t('results.co2')}</div><div className="v">{r.co2_avoided_tonnes_per_year} {t('results.tonnes')}</div></div>
      </div>

      <div className="section">
        <h2>{t('results.blockers')}</h2>
        {c.policy.ready_to_apply
          ? <div className="ok-banner" role="status">{t('results.clear')}</div>
          : null}
        <ul className="gates">
          {c.policy.gates.map(g => (
            <li className="gate" key={g.gate} data-pass={g.passed}>
              <span className="mark" aria-hidden="true">{g.passed ? '✓' : '!'}</span>
              <div>
                <div className="name">{g.label} <span className="sr-only" style={{ position: 'absolute', left: -9999 }}>{g.passed ? t('results.gatePass') : t('results.gateFail')}</span></div>
                {g.fix && <div className="fix">{g.fix}</div>}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="section">
        <h3>{t('results.payChart')}</h3>
        <div className="chart" role="img" aria-label={t('results.payChart')}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={c.series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pay" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--panel)" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="var(--panel)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${Math.round(v / 100000)}L`} tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip formatter={v => inr(Number(v ?? 0))} labelFormatter={y => `Year ${y}`} contentStyle={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 8 }} />
              <ReferenceLine y={0} stroke="var(--ink-soft)" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="cumulative_inr" stroke="var(--panel)" strokeWidth={2.5} fill="url(#pay)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="section">
        <h3>{t('results.perms')}</h3>
        <table className="plain"><tbody>
          {c.policy.permissions.map(p => (
            <tr key={p.action}>
              <td>{p.label}{p.why_not && <div className="hint">{p.why_not}</div>}</td>
              <td style={{ color: p.allowed ? 'var(--ok)' : 'var(--bad)' }}>{p.allowed ? t('results.allowed') : t('results.notAllowed')}</td>
            </tr>
          ))}
        </tbody></table>
      </div>

      <details className="section">
        <summary>{t('results.assumptions')}</summary>
        <table className="plain"><tbody>
          <tr><td>Sunshine yield</td><td>{a.yield_kwh_per_kwp_year} kWh per kWp per year</td></tr>
          <tr><td>Usable share of roof</td><td>{Math.round(a.usable_roof_fraction * 100)}%</td></tr>
          <tr><td>Roof needed per kWp</td><td>{a.m2_per_kwp} m²</td></tr>
          <tr><td>Shading</td><td>{a.shading_pct}%</td></tr>
          <tr><td>Installed cost</td><td>{inr(a.cost_per_kwp_inr)} per kWp</td></tr>
          <tr><td>Tariff rise per year</td><td>{Math.round(a.tariff_escalation * 100)}%</td></tr>
          <tr><td>Panel ageing per year</td><td>{(a.degradation * 100).toFixed(1)}%</td></tr>
          <tr><td>Subsidy source</td><td>{a.subsidy_source}</td></tr>
        </tbody></table>
      </details>
    </div>
  )
}
