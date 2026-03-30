'use client'

import { useEffect, useRef } from 'react'
import { PhysicsProfile, lerp, easeOut, depthLabel } from '@/lib/physics'
import { Racquet, COMPARISON_COLORS } from '@/data/racquets'

interface RacquetEntry {
  racquet: Racquet
  physics: PhysicsProfile
}

interface Props {
  entries: RacquetEntry[]
}

// ─── Court constants (metres) ─────────────────────────────────────────────────
const COURT_LENGTH = 23.77  // baseline to baseline
const COURT_WIDTH  = 8.23   // singles sidelines
const NET_POS      = 11.885 // net distance from player baseline
const SERVICE_LINE = 6.40   // service line from net

// ─── Top-down court drawing ───────────────────────────────────────────────────

function drawTopDownCourt(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  pxPerM: number,
  courtW: number,
  courtH: number,
  entries: RacquetEntry[],
  ballPhases: number[] // 0→1 animation progress per racquet
) {
  // Court background
  ctx.fillStyle = '#1a4d2e'
  ctx.fillRect(originX, originY, courtW, courtH)

  // Court border
  ctx.strokeStyle = '#ffffff80'
  ctx.lineWidth = 2
  ctx.strokeRect(originX, originY, courtW, courtH)

  // Net (horizontal line at mid-court)
  const netY = originY + NET_POS * pxPerM
  ctx.strokeStyle = '#ffffffcc'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(originX, netY)
  ctx.lineTo(originX + courtW, netY)
  ctx.stroke()
  ctx.fillStyle = '#ffffffcc'
  ctx.font = 'bold 10px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('NET', originX + courtW / 2, netY - 4)

  // Centre service line (opponent's side)
  const oppServiceY = netY + SERVICE_LINE * pxPerM
  ctx.strokeStyle = '#ffffff50'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(originX, oppServiceY)
  ctx.lineTo(originX + courtW, oppServiceY)
  ctx.stroke()

  // Centre line
  ctx.beginPath()
  ctx.moveTo(originX + courtW / 2, netY)
  ctx.lineTo(originX + courtW / 2, originY + courtH)
  ctx.stroke()

  // Player's service line
  const ownServiceY = netY - SERVICE_LINE * pxPerM
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(originX, ownServiceY)
  ctx.lineTo(originX + courtW, ownServiceY)
  ctx.stroke()
  ctx.setLineDash([])

  // Depth zones in opponent's half (colour-coded)
  const zoneData = [
    // from net toward opponent baseline
    { from: 0, to: SERVICE_LINE,          color: 'rgba(239,68,68,0.08)',  label: 'Short' },
    { from: SERVICE_LINE, to: NET_POS - 2, color: 'rgba(251,191,36,0.08)', label: 'Mid' },
    { from: NET_POS - 2,  to: NET_POS,     color: 'rgba(16,185,129,0.12)', label: 'Deep' },
  ]
  zoneData.forEach(z => {
    const y1 = netY + z.from * pxPerM
    const y2 = netY + z.to * pxPerM
    ctx.fillStyle = z.color
    ctx.fillRect(originX, y1, courtW, y2 - y1)
  })

  // Baseline label
  ctx.fillStyle = '#94a3b8'
  ctx.font = '10px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('← Player baseline', originX + 4, originY + courtH - 4)
  ctx.fillText('← Opponent baseline', originX + 4, originY + 6)

  // ── Balls & trajectories ──────────────────────────────────────────────────
  entries.forEach((entry, i) => {
    const phase = ballPhases[i]
    const color = COMPARISON_COLORS[i] ?? '#ffffff'
    const p = entry.physics

    // Start: player baseline centre
    const startX = originX + courtW / 2
    const startY = originY + courtH  // at player baseline

    // Landing: in opponent's court, offset slightly per racquet so lines don't stack
    const landingY = originY + (COURT_LENGTH - p.landingFromNetM) * pxPerM + (i - 1) * 4
    const landingX = originX + courtW / 2 + (i - 1) * 12

    if (phase > 0) {
      const t = easeOut(phase)

      // Trajectory arc — draw as a path
      const steps = 40
      ctx.beginPath()
      ctx.strokeStyle = color + '80'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 4])
      for (let s = 0; s <= steps; s++) {
        const st = s / steps
        const bx = lerp(startX, landingX, st)
        const by = lerp(startY, landingY, st)
        if (s === 0) ctx.moveTo(bx, by)
        else ctx.lineTo(bx, by)
      }
      ctx.stroke()
      ctx.setLineDash([])

      // Current ball position
      const ballX = lerp(startX, landingX, t)
      const ballY = lerp(startY, landingY, t)
      const ballR  = 6

      const ballGrad = ctx.createRadialGradient(ballX - 2, ballY - 2, 1, ballX, ballY, ballR)
      ballGrad.addColorStop(0, '#fef08a')
      ballGrad.addColorStop(1, '#ca8a04')
      ctx.fillStyle = ballGrad
      ctx.shadowColor = '#fde047'
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0

      // Landing ripple
      if (phase > 0.85) {
        const rp = (phase - 0.85) / 0.15
        ctx.strokeStyle = color + Math.round((1 - rp) * 200).toString(16).padStart(2, '0')
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.ellipse(landingX, landingY, 18 * rp, 7 * rp, 0, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Landing marker (after ball arrives)
      if (phase >= 0.95) {
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.fillStyle = color + '40'
        ctx.beginPath()
        ctx.ellipse(landingX, landingY, 12, 5, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    }
  })
}

// ─── Side view trajectory ─────────────────────────────────────────────────────

function drawSideView(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  entries: RacquetEntry[],
  ballPhases: number[],
  scale: number  // px per metre horizontally
) {
  const groundY = y + h - 10
  const pxPerMV = (h - 30) / 5  // vertical: 5 metres fits the view

  // Background
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, w, h)

  // Ground
  ctx.strokeStyle = '#1a4d2e'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, groundY)
  ctx.lineTo(x + w, groundY)
  ctx.stroke()

  // Net
  const netX = x + (NET_POS / COURT_LENGTH) * w
  const netTopY = groundY - 0.91 * pxPerMV
  ctx.strokeStyle = '#ffffffcc'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(netX, groundY)
  ctx.lineTo(netX, netTopY)
  ctx.stroke()

  // Court labels
  ctx.fillStyle = '#475569'
  ctx.font = '9px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('You', x + 2, groundY - 4)
  ctx.textAlign = 'right'
  ctx.fillText('Opp.', x + w - 2, groundY - 4)
  ctx.textAlign = 'center'
  ctx.fillText('Net', netX, groundY + 10)

  entries.forEach((entry, i) => {
    const phase = ballPhases[i]
    if (phase <= 0) return

    const color = COMPARISON_COLORS[i] ?? '#ffffff'
    const p = entry.physics

    const startX = x + 20
    const startY = groundY - (p.contactHeightCm / 100) * pxPerMV
    const landX  = x + (p.landingFromNetM / COURT_LENGTH * 2 + 0.5) * w / 2 + w / 2
    const landY  = groundY - 0.05 * pxPerMV

    // Bezier control point: over the net, at apex height
    const apexY = groundY - (0.91 + p.netClearanceM) * pxPerMV
    const ctrlX  = netX
    const ctrlY  = apexY

    // Draw full arc (dotted)
    ctx.strokeStyle = color + '40'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 5])
    ctx.beginPath()
    const steps = 40
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const mt = 1 - t
      const bx = mt * mt * startX + 2 * mt * t * ctrlX + t * t * landX
      const by = mt * mt * startY + 2 * mt * t * ctrlY + t * t * landY
      if (s === 0) ctx.moveTo(bx, by)
      else ctx.lineTo(bx, by)
    }
    ctx.stroke()
    ctx.setLineDash([])

    // Current ball position
    const t  = easeOut(phase)
    const mt = 1 - t
    const bx = mt * mt * startX + 2 * mt * t * ctrlX + t * t * landX
    const by = mt * mt * startY + 2 * mt * t * ctrlY + t * t * landY

    ctx.fillStyle = '#fde047'
    ctx.shadowColor = '#fde047'
    ctx.shadowBlur = 6
    ctx.beginPath()
    ctx.arc(bx, by, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // Contact height marker
    const mX = startX - 10 - i * 12
    ctx.strokeStyle = color + '80'
    ctx.lineWidth = 1
    ctx.setLineDash([2, 3])
    ctx.beginPath()
    ctx.moveTo(mX, startY)
    ctx.lineTo(mX, groundY)
    ctx.stroke()
    ctx.setLineDash([])

    // Net clearance label (when ball is near net)
    if (phase > 0.35 && phase < 0.65) {
      ctx.fillStyle = color + 'cc'
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`+${p.netClearanceM.toFixed(1)}m`, netX, apexY - 4)
    }
  })
}

// ─── main component ───────────────────────────────────────────────────────────

export default function CourtDepthCanvas({ entries }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)
  const startRef  = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const CYCLE_MS = 3600
    const W = canvas.width
    const H = canvas.height

    // Layout: top-down court on left, side view on right
    const courtAreaW = Math.floor(W * 0.55)
    const sideAreaX  = courtAreaW + 12
    const sideAreaW  = W - sideAreaX - 4

    // Top-down court sizing
    const pxPerM   = Math.min(courtAreaW / COURT_WIDTH, (H - 40) / COURT_LENGTH)
    const courtPxW = COURT_WIDTH * pxPerM
    const courtPxH = COURT_LENGTH * pxPerM
    const courtOX  = (courtAreaW - courtPxW) / 2
    const courtOY  = (H - courtPxH) / 2

    function draw(ts: number) {
      if (!startRef.current) startRef.current = ts
      const elapsed = ts - startRef.current
      const phase = (elapsed % CYCLE_MS) / CYCLE_MS

      ctx!.clearRect(0, 0, W, H)

      // Background
      const bg = ctx!.createLinearGradient(0, 0, W, 0)
      bg.addColorStop(0, '#0f172a')
      bg.addColorStop(1, '#0f172a')
      ctx!.fillStyle = bg
      ctx!.fillRect(0, 0, W, H)

      // Each racquet staggered slightly so balls don't all go at same time
      const ballPhases = entries.map((_, i) => {
        const offset = i * 0.15
        const p = ((phase + offset) % 1.0)
        // ball only visible in second half of cycle
        return p > 0.35 ? (p - 0.35) / 0.65 : 0
      })

      drawTopDownCourt(ctx!, courtOX, courtOY, pxPerM, courtPxW, courtPxH, entries, ballPhases)

      // Divider
      ctx!.strokeStyle = '#1e293b'
      ctx!.lineWidth = 1
      ctx!.beginPath()
      ctx!.moveTo(courtAreaW + 6, 10)
      ctx!.lineTo(courtAreaW + 6, H - 10)
      ctx!.stroke()

      // Side trajectory view
      drawSideView(ctx!, sideAreaX, 10, sideAreaW, H - 20, entries, ballPhases, pxPerM)

      // Column labels
      ctx!.fillStyle = '#64748b'
      ctx!.font = 'bold 11px sans-serif'
      ctx!.textAlign = 'center'
      ctx!.fillText('Court Depth (Top View)', courtAreaW / 2, 14)
      ctx!.fillText('Ball Trajectory (Side View)', sideAreaX + sideAreaW / 2, 14)

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [entries])

  return (
    <div className="w-full">
      <canvas
        ref={canvasRef}
        width={900}
        height={360}
        className="w-full rounded-xl"
        style={{ background: '#0f172a' }}
      />

      {/* Depth stats row */}
      <div className="mt-4 grid gap-4" style={{ gridTemplateColumns: `repeat(${entries.length}, 1fr)` }}>
        {entries.map((e, i) => {
          const color = COMPARISON_COLORS[i]
          const p = e.physics
          const dl = depthLabel(p.depthFromBaselineM)
          return (
            <div key={e.racquet.id} className="bg-gray-800/60 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-sm font-semibold text-white">{e.racquet.brand} {e.racquet.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <StatBox label="Depth rating" value={dl.text} valueColor={dl.color} />
                <StatBox label="Court depth" value={`${p.landingFromNetM.toFixed(1)} m from net`} valueColor={color} />
                <StatBox label="Net clearance" value={`+${p.netClearanceM.toFixed(2)} m`} valueColor={color} />
                <StatBox label="Est. spin" value={`${p.spinRPM.toLocaleString()} RPM`} valueColor={color} />
              </div>
              {/* Depth bar */}
              <p className="text-xs text-gray-400 mb-1">Depth (from net)</p>
              <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden">
                {/* Zone markers */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-yellow-600"
                  style={{ left: `${(SERVICE_LINE / NET_POS) * 100}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-emerald-700"
                  style={{ left: `${((NET_POS - 2) / NET_POS) * 100}%` }}
                />
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(p.landingFromNetM / NET_POS) * 100}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>Net</span>
                <span>Service</span>
                <span>Baseline</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatBox({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor: string
}) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className="font-semibold" style={{ color: valueColor }}>{value}</p>
    </div>
  )
}
