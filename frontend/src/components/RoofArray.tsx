import { useMemo } from 'react'

const PANEL_KWP = 0.55 // a typical modern module

interface Props {
  kwp: number
  roofAreaM2: number
  label: string
}

/** The memorable element: the user's roof, filled with the panels their system needs. */
export default function RoofArray({ kwp, roofAreaM2, label }: Props) {
  const { panels, cols, rows, capacity } = useMemo(() => {
    const panels = Math.max(0, Math.round(kwp / PANEL_KWP))
    const cols = Math.min(12, Math.max(4, Math.ceil(Math.sqrt(Math.max(panels, 1) * 1.6))))
    const rows = Math.max(1, Math.ceil(panels / cols))
    // roof slots: the terrace can hold more than we use, show the spare as empty outlines
    const capacity = Math.max(panels, Math.min(cols * (rows + 1), Math.round((roofAreaM2 * 0.6) / 2.6)))
    return { panels, cols, rows, capacity }
  }, [kwp, roofAreaM2])

  const cw = 34, ch = 22, gap = 5, pad = 18
  const gridRows = Math.max(rows, Math.ceil(capacity / cols))
  const W = pad * 2 + cols * cw + (cols - 1) * gap
  const H = 92 + gridRows * (ch + gap) + pad

  const cells = []
  for (let i = 0; i < gridRows * cols; i++) {
    const r = Math.floor(i / cols)
    const c = i % cols
    const x = pad + c * (cw + gap)
    const y = 84 + r * (ch + gap)
    const used = i < panels
    const spare = !used && i < capacity
    if (!used && !spare) continue
    cells.push(
      <g key={i}>
        <rect x={x} y={y} width={cw} height={ch} rx={3}
          fill={used ? 'var(--panel)' : 'none'} stroke={used ? 'var(--panel-deep)' : 'var(--line)'} strokeWidth={1.2}
          strokeDasharray={used ? undefined : '3 3'} />
        {used && <path d={`M${x + cw / 3} ${y}V${y + ch}M${x + (2 * cw) / 3} ${y}V${y + ch}M${x} ${y + ch / 2}H${x + cw}`} stroke="rgba(255,255,255,.28)" strokeWidth={0.8} />}
      </g>,
    )
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <path d={`M${W - 90} 70 A 58 58 0 0 1 ${W - 32} 12`} fill="none" stroke="var(--marigold)" strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" />
      <circle cx={W - 34} cy={26} r={15} fill="var(--marigold)" />
      {[0, 60, 120, 180, 240, 300].map(a => (
        <line key={a} x1={W - 34 + Math.cos((a * Math.PI) / 180) * 20} y1={26 + Math.sin((a * Math.PI) / 180) * 20}
          x2={W - 34 + Math.cos((a * Math.PI) / 180) * 26} y2={26 + Math.sin((a * Math.PI) / 180) * 26} stroke="var(--marigold)" strokeWidth={2.2} strokeLinecap="round" />
      ))}
      <rect x={6} y={74} width={W - 12} height={H - 80} rx={8} fill="color-mix(in srgb, var(--line) 35%, transparent)" stroke="var(--line)" />
      {cells}
      <text x={pad} y={40} fontFamily="var(--display)" fontWeight={800} fontSize={30} fill="var(--ink)">{panels}</text>
      <text x={pad + String(panels).length * 19 + 6} y={40} fontFamily="var(--body)" fontSize={14} fill="var(--ink-soft)">× 550 W · {kwp} kWp</text>
    </svg>
  )
}
