'use client'

import { useEffect, useRef } from 'react'
import { PhysicsProfile } from '@/lib/physics'
import { Racquet, COMPARISON_COLORS } from '@/data/racquets'

interface RacquetEntry {
  racquet: Racquet
  physics: PhysicsProfile
}

interface Props {
  entries: RacquetEntry[]
}

// ─── Radar / Spider chart ─────────────────────────────────────────────────────

const AXES = [
  { key: 'spinPotential',  label: 'Spin'          },
  { key: 'powerLevel',     label: 'Power'         },
  { key: 'control',        label: 'Control'       },
  { key: 'maneuverability',label: 'Maneuverability'},
  { key: 'stability',      label: 'Stability'     },
]
const N = AXES.length

function polarPoint(cx: number, cy: number, r: number, i: number, total: number): [number, number] {
  const angle = (2 * Math.PI * i) / total - Math.PI / 2
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
}

function RadarChart({ entries }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const cx = w / 2
    const cy = h / 2
    const maxR = Math.min(cx, cy) - 48

    ctx.clearRect(0, 0, w, h)

    // Background rings
    for (let ring = 1; ring <= 5; ring++) {
      const r = (ring / 5) * maxR
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let i = 0; i < N; i++) {
        const [px, py] = polarPoint(cx, cy, r, i, N)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()

      // Ring label
      if (ring % 2 === 0) {
        ctx.fillStyle = '#334155'
        ctx.font = '9px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`${ring * 20}%`, cx, cy - r + 10)
      }
    }

    // Axis lines & labels
    AXES.forEach((axis, i) => {
      const [px, py] = polarPoint(cx, cy, maxR, i, N)
      ctx.strokeStyle = '#334155'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(px, py)
      ctx.stroke()

      // Labels
      const [lx, ly] = polarPoint(cx, cy, maxR + 24, i, N)
      ctx.fillStyle = '#94a3b8'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(axis.label, lx, ly)
    })

    // Data polygons
    entries.forEach((entry, ei) => {
      const color = COMPARISON_COLORS[ei] ?? '#ffffff'
      const vals = AXES.map(a => (entry.physics as unknown as Record<string, number>)[a.key] as number)

      ctx.beginPath()
      vals.forEach((v, i) => {
        const [px, py] = polarPoint(cx, cy, v * maxR, i, N)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.closePath()

      // Fill
      ctx.fillStyle = color + '22'
      ctx.fill()

      // Stroke
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.stroke()

      // Data points
      vals.forEach((v, i) => {
        const [px, py] = polarPoint(cx, cy, v * maxR, i, N)
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(px, py, 4, 0, Math.PI * 2)
        ctx.fill()
      })
    })

    ctx.textBaseline = 'alphabetic'
  }, [entries])

  return (
    <canvas
      ref={canvasRef}
      width={340}
      height={300}
      className="w-full max-w-sm mx-auto"
    />
  )
}

// ─── Spec bar comparison ──────────────────────────────────────────────────────

function SpecBar({
  label,
  values,
  max,
  unit = '',
  colors,
}: {
  label: string
  values: number[]
  max: number
  unit?: string
  colors: string[]
}) {
  return (
    <div className="py-2">
      <p className="text-xs text-gray-400 mb-1.5">{label}</p>
      <div className="space-y-1.5">
        {values.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-700 rounded-full">
              <div
                className="h-2 rounded-full transition-all"
                style={{ width: `${(v / max) * 100}%`, backgroundColor: colors[i] }}
              />
            </div>
            <span className="text-xs font-mono w-16 text-right" style={{ color: colors[i] }}>
              {v}{unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function SpecsComparison({ entries }: Props) {
  if (entries.length === 0) return null

  const colors = entries.map((_, i) => COMPARISON_COLORS[i])

  const specRows: Array<{
    label: string
    getter: (r: Racquet) => number
    max: number
    unit: string
    higherLabel: string
  }> = [
    { label: 'Head size (sq in)',   getter: r => r.headSize,     max: 120, unit: ' in²', higherLabel: 'larger sweet spot' },
    { label: 'Weight (g, unstrung)', getter: r => r.weight,      max: 400, unit: 'g',    higherLabel: 'more plow-through' },
    { label: 'Balance (mm from butt)', getter: r => r.balance,   max: 340, unit: 'mm',   higherLabel: 'head heavier' },
    { label: 'Swing weight (kg·cm²)',  getter: r => r.swingWeight, max: 380, unit: '',  higherLabel: 'more momentum' },
    { label: 'Stiffness RA',         getter: r => r.stiffness,   max: 80,  unit: '',    higherLabel: 'more power / less feel' },
    { label: 'Min tension (lbs)',    getter: r => r.tension[0],   max: 70,  unit: ' lb', higherLabel: 'lower = more spin' },
  ]

  return (
    <div className="w-full space-y-8">
      {/* Radar chart + legend */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 bg-gray-800/60 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-3 text-center">Performance Profile</h3>
          <RadarChart entries={entries} />
          {/* Legend */}
          <div className="flex flex-wrap gap-3 justify-center mt-3">
            {entries.map((e, i) => (
              <div key={e.racquet.id} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i] }} />
                <span className="text-xs text-gray-300">{e.racquet.brand} {e.racquet.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Physics score bars */}
        <div className="flex-1 bg-gray-800/60 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Physics Scores</h3>
          {[
            { label: 'Spin potential',   key: 'spinPotential'   },
            { label: 'Power level',      key: 'powerLevel'      },
            { label: 'Control',          key: 'control'         },
            { label: 'Maneuverability',  key: 'maneuverability' },
            { label: 'Stability',        key: 'stability'       },
          ].map(row => (
            <SpecBar
              key={row.key}
              label={row.label}
              values={entries.map(e => Math.round((e.physics as unknown as Record<string, number>)[row.key] * 100))}
              max={100}
              unit="%"
              colors={colors}
            />
          ))}
        </div>
      </div>

      {/* Frame spec bars */}
      <div className="bg-gray-800/60 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-4">Frame Specifications</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          {specRows.map(row => (
            <SpecBar
              key={row.label}
              label={row.label}
              values={entries.map(e => row.getter(e.racquet))}
              max={row.max}
              unit={row.unit}
              colors={colors}
            />
          ))}
        </div>
      </div>

      {/* Full spec table */}
      <div className="bg-gray-800/60 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Specification</th>
              {entries.map((e, i) => (
                <th key={e.racquet.id} className="text-left px-4 py-3 font-medium" style={{ color: colors[i] }}>
                  <div className="flex flex-col items-start gap-2">
                    {e.racquet.imageUrl && (
                      <div
                        className="w-20 h-20 rounded-lg flex items-center justify-center overflow-hidden"
                        style={{ backgroundColor: colors[i] + '15' }}
                      >
                        <img
                          src={e.racquet.imageUrl}
                          alt={e.racquet.name}
                          className="w-full h-full object-contain p-1"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <span>{e.racquet.brand} {e.racquet.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {[
              { label: 'Year',             fmt: (r: Racquet) => String(r.year) },
              { label: 'Head size',        fmt: (r: Racquet) => `${r.headSize} in²` },
              { label: 'Weight (unstrung)',fmt: (r: Racquet) => `${r.weight} g` },
              { label: 'Balance',          fmt: (r: Racquet) => {
                const diff = r.balance - 320
                if (Math.abs(diff) < 3) return `${r.balance} mm (even)`
                const pts = Math.abs(Math.round(diff / 3.175))
                return `${r.balance} mm (${pts} pts ${diff < 0 ? 'HL' : 'HH'})`
              }},
              { label: 'Swing weight',     fmt: (r: Racquet) => `${r.swingWeight} kg·cm²` },
              { label: 'String pattern',   fmt: (r: Racquet) => r.stringPattern },
              { label: 'Tension range',    fmt: (r: Racquet) => `${r.tension[0]}–${r.tension[1]} lbs` },
              { label: 'Stiffness (RA)',   fmt: (r: Racquet) => String(r.stiffness) },
              { label: 'Known user',       fmt: (r: Racquet) => r.famousUser ?? '—' },
              { label: 'Era',              fmt: (r: Racquet) => r.era },
            ].map(row => (
              <tr key={row.label} className="hover:bg-gray-800/40 transition-colors">
                <td className="px-4 py-2.5 text-gray-400">{row.label}</td>
                {entries.map((e, i) => (
                  <td key={e.racquet.id} className="px-4 py-2.5 text-white">
                    {row.fmt(e.racquet)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Description cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${entries.length}, 1fr)` }}>
        {entries.map((e, i) => (
          <div key={e.racquet.id} className="bg-gray-800/60 rounded-xl p-4 border-l-4" style={{ borderColor: colors[i] }}>
            {e.racquet.imageUrl && (
              <div
                className="w-full h-32 rounded-lg mb-3 flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: colors[i] + '12' }}
              >
                <img
                  src={e.racquet.imageUrl}
                  alt={e.racquet.name}
                  className="h-full object-contain"
                  loading="lazy"
                />
              </div>
            )}
            <p className="text-sm font-semibold text-white mb-2">{e.racquet.brand} {e.racquet.name} ({e.racquet.year})</p>
            <p className="text-xs text-gray-400 leading-relaxed">{e.racquet.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
