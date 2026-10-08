export const API = (import.meta.env.VITE_API as string | undefined) ?? 'http://localhost:3000'

export interface BillResult {
  fields: { monthly_units_kwh: number | null; tariff_inr_per_kwh: number | null; sanctioned_load_kw: number | null }
  confidence: Record<string, number>
  method: 'vision' | 'ocr' | 'manual'
  notes: string[]
}

export interface Sizing {
  system_kwp: number
  limiting_factor: 'roof' | 'demand' | 'sanctioned_load'
  annual_generation_kwh: number
  offset_pct: number
  gross_cost_inr: number
  subsidy_inr: number
  net_cost_inr: number
  year1_savings_inr: number
  payback_years: number | null
  co2_avoided_tonnes_per_year: number
  assumptions: {
    yield_kwh_per_kwp_year: number
    usable_roof_fraction: number
    m2_per_kwp: number
    shading_pct: number
    cost_per_kwp_inr: number
    tariff_escalation: number
    degradation: number
    subsidy_verified: boolean
    subsidy_source: string
  }
}

export interface Gate { gate: string; label: string; passed: boolean; fix: string | null }
export interface Permission { action: string; label: string; allowed: boolean; why_not: string | null }
export interface Policy { gates: Gate[]; permissions: Permission[]; blockers: Gate[]; ready_to_apply: boolean }

export interface CaseInput {
  society_name: string
  city: string
  num_houses: number
  roof_area_m2: number
  shading_pct: number
  sanctioned_load_kw: number | null
  monthly_units_kwh: number
  tariff_inr_per_kwh: number
  is_society: boolean
  roof_right: 'society_common' | 'owner_exclusive' | 'disputed' | 'unknown'
  consent_pct: number
  structural_ok: boolean
  role: 'secretary' | 'resident' | 'owner'
}

export interface Case extends Partial<CaseInput> {
  id: string
  result: Sizing
  series: { year: number; cumulative_inr: number }[]
  policy: Policy
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(API + path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  } catch {
    throw new Error('Cannot reach the RoofRight API. Start the backend (python dev_server.py) and try again.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`)
  return data as T
}

export const api = {
  health: () => call<{ ok: boolean; store: string }>('/health'),
  extractBill: (image_base64: string) =>
    call<BillResult>('/bill/extract', { method: 'POST', body: JSON.stringify({ image_base64 }) }),
  size: (b: Partial<CaseInput>) => call<Sizing & { cumulative_series: Case['series'] }>('/size', { method: 'POST', body: JSON.stringify(b) }),
  createCase: (b: CaseInput) => call<Case>('/cases', { method: 'POST', body: JSON.stringify(b) }),
  documents: (id: string) => call<{ files: Record<string, string>; store: string }>(`/cases/${id}/documents`, { method: 'POST', body: '{}' }),
  chat: (case_id: string, message: string) =>
    call<{ answer: string; engine: string; tool_calls: string[] }>('/chat', { method: 'POST', body: JSON.stringify({ case_id, message }) }),
}

export const CITIES = ['Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Hyderabad', 'Kolkata', 'Jaipur', 'Ahmedabad', 'Pune', 'Chandigarh']
export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')
