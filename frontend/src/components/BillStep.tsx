import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'

export interface BillValues { units: string; tariff: string; load: string }
export const SAMPLE_BILL: BillValues = { units: '3000', tariff: '8', load: '30' }

interface Props {
  value: BillValues
  onChange: (v: BillValues) => void
  low: Record<string, boolean>
  setLow: (l: Record<string, boolean>) => void
  method: string | null
  setMethod: (m: string | null) => void
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(new Error('Could not read that file.'))
    r.readAsDataURL(file)
  })
}

export default function BillStep({ value, onChange, low, setLow, method, setMethod }: Props) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [preview, setPreview] = useState<string | null>(null)

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setBusy(true)
    setPreview(URL.createObjectURL(file))
    try {
      const res = await api.extractBill(await fileToBase64(file))
      const f = res.fields
      onChange({
        units: f.monthly_units_kwh != null ? String(f.monthly_units_kwh) : value.units,
        tariff: f.tariff_inr_per_kwh != null ? String(f.tariff_inr_per_kwh) : value.tariff,
        load: f.sanctioned_load_kw != null ? String(f.sanctioned_load_kw) : value.load,
      })
      setLow({
        units: (res.confidence.monthly_units_kwh ?? 0) < 0.8,
        tariff: (res.confidence.tariff_inr_per_kwh ?? 0) < 0.8,
        load: (res.confidence.sanctioned_load_kw ?? 0) < 0.8,
      })
      setMethod(res.method)
      setNotes(res.notes)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  const set = (k: keyof BillValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, [k]: e.target.value })
    setLow({ ...low, [k]: false })
  }

  return (
    <div className="stage">
      <h1>{t('bill.title')}</h1>
      <p className="lead">{t('bill.lead')}</p>

      <label className="upload">
        <input type="file" accept="image/*" onChange={e => onFile(e.target.files?.[0])} />
        <strong>{busy ? t('bill.reading') : t('bill.upload')}</strong>
        {preview && <div><img src={preview} alt="" /></div>}
        {method && !busy && <div className="method">{t(`bill.method.${method}`, { defaultValue: method })}</div>}
      </label>

      {error && <div className="alert err" role="alert">{error}</div>}
      {notes.length > 0 && <div className="alert warn">{notes.map(n => <div key={n}>{n}</div>)}</div>}

      <div className="section">
        <h3>{t('bill.manual')}</h3>
        <div className="row three" style={{ marginTop: 14 }}>
          {([['units', 'bill.units', '1'], ['tariff', 'bill.tariff', '0.01'], ['load', 'bill.load', '0.5']] as const).map(([k, label, step]) => (
            <div className="field" key={k}>
              <label htmlFor={`f-${k}`}>{t(label)}</label>
              <input id={`f-${k}`} className="input" inputMode="decimal" type="number" min="0" step={step}
                value={value[k]} onChange={set(k)} data-low={low[k] ? 'true' : 'false'} />
              {low[k] && <span className="hint warn">{t('bill.lowConf')}</span>}
            </div>
          ))}
        </div>
        <button type="button" className="btn ghost" onClick={() => { onChange(SAMPLE_BILL); setLow({}); setMethod(null); setNotes([]) }}>
          {t('bill.sample')}
        </button>
      </div>
    </div>
  )
}
