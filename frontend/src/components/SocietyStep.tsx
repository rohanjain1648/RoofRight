import { useTranslation } from 'react-i18next'
import type { CaseInput } from '../api'

export interface SocietyValues {
  name: string
  houses: string
  consent: string
  roofRight: CaseInput['roof_right']
  structural: boolean
  role: CaseInput['role']
}

interface Props { value: SocietyValues; onChange: (v: SocietyValues) => void }

const RR: CaseInput['roof_right'][] = ['society_common', 'owner_exclusive', 'disputed', 'unknown']
const ROLES: CaseInput['role'][] = ['secretary', 'owner', 'resident']

export default function SocietyStep({ value, onChange }: Props) {
  const { t } = useTranslation()
  const up = <K extends keyof SocietyValues>(k: K, v: SocietyValues[K]) => onChange({ ...value, [k]: v })

  return (
    <div className="stage">
      <h1>{t('society.title')}</h1>

      <div className="section">
        <div className="row two">
          <div className="field">
            <label htmlFor="sname">{t('society.name')}</label>
            <input id="sname" className="input" value={value.name} onChange={e => up('name', e.target.value)} autoComplete="organization" />
          </div>
          <div className="field">
            <label htmlFor="houses">{t('society.houses')}</label>
            <input id="houses" className="input" type="number" inputMode="numeric" min="1" value={value.houses} onChange={e => up('houses', e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="consent">{t('society.consent')}</label>
          <input id="consent" className="input" type="number" inputMode="numeric" min="0" max="100" value={value.consent} onChange={e => up('consent', e.target.value)} />
        </div>
      </div>

      <fieldset className="section" style={{ border: 0, borderTop: '1px solid var(--line)', margin: 0, paddingInline: 0 }}>
        <legend className="legend" style={{ padding: 0, marginBottom: 10 }}>{t('society.roofRight')}</legend>
        <div className="radios">
          {RR.map(r => (
            <label className="radio" key={r}>
              <input type="radio" name="rr" checked={value.roofRight === r} onChange={() => up('roofRight', r)} />
              {t(`society.rr.${r}`)}
            </label>
          ))}
        </div>
        <label className="check" style={{ marginTop: 14 }}>
          <input type="checkbox" checked={value.structural} onChange={e => up('structural', e.target.checked)} />
          <span>{t('society.structural')}</span>
        </label>
      </fieldset>

      <div className="section">
        <div className="field">
          <label htmlFor="role">{t('society.role')}</label>
          <select id="role" className="input" value={value.role} onChange={e => up('role', e.target.value as CaseInput['role'])}>
            {ROLES.map(r => <option key={r} value={r}>{t(`society.roles.${r}`)}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
