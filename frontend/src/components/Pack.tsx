import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { API, api } from '../api'
import type { Case } from '../api'

interface Msg { who: 'me' | 'bot'; text: string; meta?: string }

export default function Pack({ c, onRestart }: { c: Case; onRestart: () => void }) {
  const { t } = useTranslation()
  const [files, setFiles] = useState<Record<string, string> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [q, setQ] = useState('')
  const [asking, setAsking] = useState(false)

  async function generate() {
    setBusy(true); setError(null)
    try { setFiles((await api.documents(c.id)).files) }
    catch (e) { setError(e instanceof Error ? e.message : t('errors.generic')) }
    finally { setBusy(false) }
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault()
    const text = q.trim() || t('pack.placeholder')
    setQ(''); setAsking(true)
    setMsgs(m => [...m, { who: 'me', text }])
    try {
      const r = await api.chat(c.id, text)
      setMsgs(m => [...m, { who: 'bot', text: r.answer, meta: `${t('pack.answeredBy')} ${r.engine}${r.tool_calls.length ? ` · ${r.tool_calls.join(', ')}` : ''}` }])
    } catch (err) {
      setMsgs(m => [...m, { who: 'bot', text: err instanceof Error ? err.message : t('errors.generic') }])
    } finally { setAsking(false) }
  }

  const names: Record<string, string> = { 'consent-resolution': t('pack.consent'), 'vendor-rfq': t('pack.rfq') }

  return (
    <div className="stage">
      <h1>{t('pack.title')}</h1>
      <p className="lead">{t('pack.lead')}</p>

      {!files && <button className="btn sun" onClick={generate} disabled={busy}>{busy ? t('pack.generating') : t('pack.generate')}</button>}
      {error && <div className="alert err" role="alert">{error}</div>}
      {files && Object.entries(files).map(([k, path]) => (
        <div className="doc" key={k}>
          <strong>{names[k] ?? k}</strong>
          <a className="btn ghost" href={API + path} target="_blank" rel="noreferrer" style={{ display: 'inline-grid', placeItems: 'center', textDecoration: 'none' }}>{t('pack.download')}</a>
        </div>
      ))}

      <div className="section" style={{ marginTop: 26 }}>
        <h2>{t('pack.ask')}</h2>
        <div className="chat-log" aria-live="polite">
          {msgs.map((m, i) => (
            <div key={i} className={`bubble ${m.who}`}>{m.text}{m.meta && <small>{m.meta}</small>}</div>
          ))}
          {asking && <div className="bubble bot">{t('pack.thinking')}</div>}
        </div>
        <form className="chat-form" onSubmit={ask}>
          <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder={t('pack.placeholder')} aria-label={t('pack.ask')} />
          <button className="btn" disabled={asking}>{t('pack.send')}</button>
        </form>
      </div>

      <div className="actions"><button className="btn ghost" onClick={onRestart}>{t('pack.restart')}</button></div>
    </div>
  )
}
