'use client'

import { useEffect, useRef } from 'react'
import { PhysicsProfile, lerp, easeOut, easeInOut } from '@/lib/physics'
import { Racquet, COMPARISON_COLORS } from '@/data/racquets'

interface RacquetEntry {
  racquet: Racquet
  physics: PhysicsProfile
}
interface Props { entries: RacquetEntry[] }

// ─── palette ──────────────────────────────────────────────────────────────────
const SKIN   = '#c8a882'
const SHIRT  = '#1a5c38'
const SHORTS = '#1e3a5f'
const SOCK   = '#d0dce8'
const SHOE   = '#f4f0eb'
const CAP    = '#1a2538'

// ─── forehand arc constants ───────────────────────────────────────────────────
// Arm angles in canvas coords  (0=right/net, 90=down, 180=left/back, 270=up)
//
//  BACKSWING 120° → racquet dropped low-and-behind   (down-left of shoulder)
//  CONTACT    60° → racquet meets ball in front       (down-right of shoulder)
//  FOLLOWTHRU 240° → racquet over left shoulder      (up-left of shoulder)
//  READY     350° → neutral in front                 (right, slightly up)
//
//  Arc goes counterclockwise: 120°→90°(low)→60°(contact)→0°→300°→240°(finish)
const DEG           = Math.PI / 180
const READY_A       = 350 * DEG
const BACKSWING_A   = 120 * DEG
const CONTACT_A     =  60 * DEG
const FOLLOWTHRU_A  = 240 * DEG
const FINISH_A      = 232 * DEG
const SWING_ARC     = 240 * DEG
const CONTACT_T     = (120 - 60) / 240   // = 0.25  (contact at 1/4 of swing)

function norm(a: number) { return ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) }
function swingAng(t: number) { return norm(BACKSWING_A - t * SWING_ARC) }

// ─── drawing primitives ───────────────────────────────────────────────────────

/** Filled rounded capsule between two points (thick rounded stroke). */
function seg(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  w: number, color: string,
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = w
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.restore()
}

/** Filled circle. */
function dot(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// ─── background & net ─────────────────────────────────────────────────────────

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, groundY: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#0f172a')
  grad.addColorStop(1, '#1e293b')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#1a4d2e'
  ctx.fillRect(0, groundY, w, h - groundY)
  ctx.strokeStyle = '#ffffff30'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(w, groundY); ctx.stroke()
}

function drawNet(ctx: CanvasRenderingContext2D, x: number, groundY: number, scale: number) {
  const netH = 0.91 * scale
  const postH = 1.07 * scale
  ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 3; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x, groundY - postH); ctx.stroke()
  ctx.strokeStyle = '#ffffff80'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(x - 8, groundY - postH); ctx.lineTo(x + 8, groundY - postH); ctx.stroke()
  ctx.strokeStyle = '#ffffff18'; ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const lx = x - 6 + i * 3
    ctx.beginPath(); ctx.moveTo(lx, groundY); ctx.lineTo(lx, groundY - netH); ctx.stroke()
  }
  ctx.strokeStyle = '#ffffff40'
  ctx.beginPath(); ctx.moveTo(x - 5, groundY - netH); ctx.lineTo(x + 5, groundY - netH); ctx.stroke()
}

// ─── quadratic bezier ─────────────────────────────────────────────────────────

function qBez(
  p0: [number,number], p1: [number,number], p2: [number,number], t: number
): [number,number] {
  const m = 1 - t
  return [m*m*p0[0]+2*m*t*p1[0]+t*t*p2[0], m*m*p0[1]+2*m*t*p1[1]+t*t*p2[1]]
}

// ─── player body ──────────────────────────────────────────────────────────────
//
//  phase 0.00–0.18  setup / backswing  (body turns sideways)
//  phase 0.18–0.62  forward swing      (body uncoils, drives through contact)
//  phase 0.62–0.76  hold finish
//  phase 0.76–1.00  recovery

function drawPlayerBody(
  ctx: CanvasRenderingContext2D,
  phase: number,
  px: number,
  groundY: number,
) {
  // sub-progress values
  const setupT = phase < 0.18 ? phase / 0.18 : 0
  const swingT = phase >= 0.18 && phase < 0.62 ? (phase - 0.18) / 0.44 : phase >= 0.62 ? 1 : 0
  const activeST = phase < 0.18 ? 0 : swingT

  // body rotation: 0=facing net, 1=fully sideways
  const bodyRot = phase < 0.18
    ? easeInOut(setupT) * 0.7
    : phase < 0.50
    ? lerp(0.7, 0, easeOut(swingT / 0.7))
    : 0

  const rSX = px - 10 + lerp(0, -10, bodyRot)  // right shoulder X
  const lSX = px - 32 + lerp(0,  12, bodyRot)  // left shoulder X
  const sY  = groundY - 148                     // shoulder Y

  // knee bend: deeper during backswing, drives up through contact
  const crouch = phase < 0.18 ? easeInOut(setupT) * 10
               : phase < 0.48 ? lerp(10, -5, easeOut(swingT / 0.6))
               : 0
  const kb = Math.max(0, crouch)

  const hipX = lerp(px - 1, px + 5, Math.max(0, Math.min((activeST - 0.2) / 0.5, 1)))
  const hipY = groundY - 86 + kb

  const ws = Math.max(0, Math.min((activeST - 0.2) / 0.5, 1))

  // key leg points
  const bHipX = px + 6,  bHipY = hipY
  const fHipX = px - 4,  fHipY = hipY
  const bKnX  = lerp(px+12, px+14, ws),  bKnY = groundY - 52 - kb
  const fKnX  = lerp(px -9, px-11, ws),  fKnY = groundY - 50 - kb * 0.6
  const bAnX  = px + 17, bAnY = groundY - 6
  const fAnX  = px - 13, fAnY = groundY - 6

  // left arm animation (balance arm)
  let leX: number, leY: number, lhX: number, lhY: number
  if (activeST <= CONTACT_T) {
    const t = easeOut(activeST / CONTACT_T)
    leX = lerp(lSX + 2,   lSX + 22, t); leY = lerp(sY + 22, sY + 8,  t)
    lhX = lerp(lSX - 6,   lSX + 50, t); lhY = lerp(sY + 48, sY + 12, t)
  } else {
    const t = easeOut((activeST - CONTACT_T) / (1 - CONTACT_T))
    leX = lerp(lSX + 22, lSX - 8,  t); leY = lerp(sY + 8,  sY + 30, t)
    lhX = lerp(lSX + 50, lSX - 20, t); lhY = lerp(sY + 12, sY + 58, t)
  }

  const headX = rSX + 7
  const headY = groundY - 170

  // ── ground shadow ────────────────────────────────────────────────────────
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.beginPath()
  ctx.ellipse(px + 3, groundY, 32, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // ── back leg (drawn first — further from camera) ─────────────────────────
  // thigh (shorts)
  seg(ctx, bHipX, bHipY, bKnX, bKnY, 13, SHORTS)
  // shin (sock / skin)
  seg(ctx, bKnX, bKnY, bAnX, bAnY, 9, SOCK)
  // back shoe
  ctx.save()
  ctx.fillStyle = SHOE
  ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.ellipse(bAnX + 9, groundY - 2, 15, 5, -0.12, 0, Math.PI * 2)
  ctx.fill(); ctx.stroke()
  ctx.restore()

  // ── front leg ────────────────────────────────────────────────────────────
  seg(ctx, fHipX, fHipY, fKnX, fKnY, 13, SHORTS)
  seg(ctx, fKnX, fKnY, fAnX, fAnY, 9, SOCK)
  ctx.save()
  ctx.fillStyle = SHOE; ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.ellipse(fAnX + 5, groundY - 2, 15, 5, 0.1, 0, Math.PI * 2)
  ctx.fill(); ctx.stroke()
  ctx.restore()

  // ── shorts band (covers the join between thighs) ─────────────────────────
  ctx.save()
  ctx.fillStyle = SHORTS
  ctx.beginPath()
  ctx.ellipse(hipX + 1, hipY + 9, 17, 11, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // ── torso (filled shirt polygon) ─────────────────────────────────────────
  ctx.save()
  ctx.fillStyle = SHIRT
  ctx.beginPath()
  ctx.moveTo(hipX - 10, hipY + 2)
  ctx.lineTo(lSX - 2, sY + 4)
  ctx.lineTo(rSX + 6, sY + 2)
  ctx.lineTo(hipX + 13, hipY + 2)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // shirt collar V highlight
  ctx.save()
  ctx.strokeStyle = '#2d7a4a'; ctx.lineWidth = 2; ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo((lSX + rSX) / 2 - 2, sY + 2)
  ctx.lineTo((lSX + rSX) / 2 + 3, sY + 12)
  ctx.stroke()
  ctx.restore()

  // ── left arm (balance / non-dominant) ────────────────────────────────────
  seg(ctx, lSX, sY, leX, leY, 10, SKIN)   // upper arm
  seg(ctx, leX, leY, lhX, lhY, 8, SKIN)   // forearm
  dot(ctx, lhX, lhY, 5, SKIN)              // hand

  // ── neck ─────────────────────────────────────────────────────────────────
  const neckBaseX = (lSX + rSX) / 2 + 5
  seg(ctx, neckBaseX, sY + 2, headX, headY + 14, 8, SKIN)

  // ── head ─────────────────────────────────────────────────────────────────
  dot(ctx, headX, headY, 15, SKIN)
  ctx.save()
  ctx.fillStyle = CAP
  ctx.beginPath()
  ctx.arc(headX, headY, 15, -Math.PI, 0)
  ctx.fill()
  // brim
  ctx.strokeStyle = CAP; ctx.lineWidth = 5; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(headX - 17, headY); ctx.lineTo(headX + 20, headY); ctx.stroke()
  ctx.restore()

  // ear / face side detail
  dot(ctx, headX - 10, headY + 3, 4, '#b8926a')
}

// ─── swing arm, racquet, ball ─────────────────────────────────────────────────

function drawSwingArm(
  ctx: CanvasRenderingContext2D,
  phase: number,
  physics: PhysicsProfile,
  color: string,
  px: number,
  groundY: number,
  scale: number,
  labelOffset = 0,
) {
  const setupT  = phase < 0.18 ? phase / 0.18 : 0
  const swingT  = phase >= 0.18 && phase < 0.62 ? (phase - 0.18) / 0.44 : phase >= 0.62 ? 1 : 0
  const recovT  = phase >= 0.76 ? (phase - 0.76) / 0.24 : 0
  const activeST = phase < 0.18 ? 0 : swingT

  const bodyRot = phase < 0.18
    ? easeInOut(setupT) * 0.7
    : phase < 0.50
    ? lerp(0.7, 0, easeOut(swingT / 0.7))
    : 0

  const rSX = px - 10 + lerp(0, -10, bodyRot)
  const sY  = groundY - 148
  const ARM = 115

  // arm angle
  let armA: number
  if (phase < 0.18) {
    armA = norm(READY_A - easeInOut(setupT) * 230 * DEG)
  } else if (phase < 0.62) {
    armA = swingAng(easeOut(swingT))
  } else if (phase < 0.76) {
    armA = FINISH_A
  } else {
    armA = norm(FINISH_A + easeInOut(recovT) * 118 * DEG)
  }

  const rqX = rSX + Math.cos(armA) * ARM
  const rqY = sY  + Math.sin(armA) * ARM

  // elbow
  const eRatio = 0.48
  const ex0 = rSX + Math.cos(armA) * ARM * eRatio
  const ey0 = sY  + Math.sin(armA) * ARM * eRatio
  const pA  = armA + Math.PI / 2
  let eDev: number
  if (activeST < CONTACT_T) {
    eDev = lerp(22, -8, easeOut(activeST / CONTACT_T))
  } else {
    eDev = lerp(-8, 30, easeOut((activeST - CONTACT_T) / (1 - CONTACT_T)))
  }
  const eX = ex0 + Math.cos(pA) * eDev
  const eY = ey0 + Math.sin(pA) * eDev
  const foreA = Math.atan2(rqY - eY, rqX - eX)

  // fixed contact point (shoulder at neutral, no body rotation)
  const cX = (px - 10) + Math.cos(CONTACT_A) * ARM
  const cY = sY         + Math.sin(CONTACT_A) * ARM

  // ── swing arc guide ──────────────────────────────────────────────────────
  ctx.save()
  ctx.setLineDash([4, 7])
  ctx.strokeStyle = color + '25'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(rSX, sY, ARM, BACKSWING_A, FOLLOWTHRU_A, true)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  // contact marker
  ctx.save()
  ctx.strokeStyle = color + '40'; ctx.lineWidth = 1; ctx.setLineDash([3, 5])
  ctx.beginPath(); ctx.moveTo(cX, groundY); ctx.lineTo(cX, cY - 10); ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
  ctx.fillStyle = color + '80'; ctx.font = '10px monospace'; ctx.textAlign = 'center'
  ctx.fillText(`${Math.round(physics.contactHeightCm)} cm`, cX, groundY + 14)

  // ── hitting arm (capsule segments) ───────────────────────────────────────
  seg(ctx, rSX, sY, eX, eY, 11, SKIN)   // upper arm
  seg(ctx, eX, eY, rqX, rqY, 9, SKIN)   // forearm
  dot(ctx, rqX, rqY, 6, SKIN)            // hand / grip

  // ── racquet ──────────────────────────────────────────────────────────────
  const HW = 14, HH = 20   // head half-width, half-height

  ctx.save()
  ctx.translate(rqX, rqY)
  ctx.rotate(foreA - Math.PI / 2)

  // Handle / grip (extends from bottom of oval in local coords)
  const gripStart = HH + 3
  const gripEnd   = HH + 28

  // Throat: two angled lines converging from handle to oval base
  ctx.save()
  ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 2; ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.moveTo(-3, gripStart - 1)
  ctx.lineTo(-HW * 0.55, HH - 1)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo( 3, gripStart - 1)
  ctx.lineTo( HW * 0.55, HH - 1)
  ctx.stroke()
  ctx.restore()

  // Grip tape (wrapped look: two slightly different tones)
  ctx.save()
  ctx.strokeStyle = '#3d2b1f'; ctx.lineWidth = 8; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(0, gripStart); ctx.lineTo(0, gripEnd); ctx.stroke()
  ctx.strokeStyle = '#5c3d28'; ctx.lineWidth = 6
  ctx.beginPath(); ctx.moveTo(0, gripStart + 2); ctx.lineTo(0, gripEnd - 2); ctx.stroke()
  // butt cap
  dot(ctx, 0, gripEnd + 3, 5, '#2d2d2d')
  ctx.restore()

  // Glow near contact
  const angDiff = Math.abs(norm(armA - CONTACT_A))
  const glow = Math.max(0, 1 - Math.min(angDiff, 2 * Math.PI - angDiff) / (35 * DEG))
  if (glow > 0) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, HH * 2.2)
    g.addColorStop(0, color + Math.round(glow * 80).toString(16).padStart(2, '0'))
    g.addColorStop(1, color + '00')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.ellipse(0, 0, HW * 2.2, HH * 2.2, 0, 0, Math.PI * 2); ctx.fill()
  }

  // Frame
  ctx.strokeStyle = color; ctx.lineWidth = 3
  ctx.shadowColor = color; ctx.shadowBlur = glow > 0.3 ? 10 : 4
  ctx.beginPath(); ctx.ellipse(0, 0, HW, HH, 0, 0, Math.PI * 2); ctx.stroke()
  ctx.shadowBlur = 0

  // Strings (denser grid)
  ctx.strokeStyle = color + '55'; ctx.lineWidth = 0.8
  for (let i = -2; i <= 2; i++) {
    const sx = i * (HW - 1) / 2.2
    ctx.beginPath(); ctx.moveTo(sx, -HH + 4); ctx.lineTo(sx, HH - 4); ctx.stroke()
  }
  for (let i = -3; i <= 3; i++) {
    const sy = i * (HH - 4) / 3.2
    ctx.beginPath(); ctx.moveTo(-HW + 4, sy); ctx.lineTo(HW - 4, sy); ctx.stroke()
  }

  ctx.restore()

  // ── ball ─────────────────────────────────────────────────────────────────
  const ballStart = 0.18 + 0.44 * CONTACT_T   // ≈ 0.29
  if (phase >= ballStart) {
    const bp = Math.min((phase - ballStart) / (1 - ballStart), 1)
    const p0: [number,number] = [cX, cY]
    const netX = px + (11.89 / 2) * scale
    const p1: [number,number] = [netX, groundY - (0.91 + physics.netClearanceM) * scale]
    const p2: [number,number] = [px + physics.landingFromNetM * scale, groundY - 3]
    const [bx, by] = qBez(p0, p1, p2, easeOut(bp))
    const br = lerp(7, 5, bp)

    const bg = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, br)
    bg.addColorStop(0, '#fef08a'); bg.addColorStop(1, '#ca8a04')
    ctx.fillStyle = bg; ctx.shadowColor = '#fde047'; ctx.shadowBlur = 8
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0

    for (let i = 1; i <= 4; i++) {
      const [tx, ty] = qBez(p0, p1, p2, Math.max(0, easeOut(bp) - i * 0.06))
      ctx.fillStyle = `rgba(253,224,71,${0.15 - i * 0.03})`
      ctx.beginPath(); ctx.arc(tx, ty, br - i, 0, Math.PI * 2); ctx.fill()
    }

    if (bp > 0.88) {
      const rp = (bp - 0.88) / 0.12
      ctx.strokeStyle = `rgba(253,224,71,${1 - rp})`; ctx.lineWidth = 2
      ctx.beginPath(); ctx.ellipse(p2[0], p2[1], 15 * rp, 5 * rp, 0, 0, Math.PI * 2); ctx.stroke()
    }
  }

  // ── annotation ───────────────────────────────────────────────────────────
  if (phase >= 0.22 && phase <= 0.58) {
    ctx.fillStyle = color + 'cc'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'
    ctx.fillText(`${Math.round(physics.swingAngleDeg)}° low-to-high`, px + 28, sY + 26 + labelOffset)
  }
}

// ─── main component ───────────────────────────────────────────────────────────

export default function SwingPathCanvas({ entries }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)
  const startRef  = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const CYCLE_MS = 3400
    const w = canvas.width, h = canvas.height
    const groundY = h - 60
    const playerX = w * 0.13
    const scale   = (w * 0.82) / 14

    function draw(ts: number) {
      if (!startRef.current) startRef.current = ts
      const phase = ((ts - startRef.current) % CYCLE_MS) / CYCLE_MS

      ctx!.clearRect(0, 0, w, h)
      drawBackground(ctx!, w, h, groundY)

      // Player body — use first racquet's phase for body animation
      drawPlayerBody(ctx!, phase, playerX, groundY)
      drawNet(ctx!, playerX + (11.89 / 2) * scale, groundY, scale)

      // Opponent baseline tick
      ctx!.strokeStyle = '#ffffff20'; ctx!.lineWidth = 1
      const oppX = playerX + 11.89 * scale
      ctx!.beginPath(); ctx!.moveTo(oppX, groundY - 6); ctx!.lineTo(oppX, groundY + 6); ctx!.stroke()

      // Each racquet's arm + ball (staggered phase)
      entries.forEach((entry, i) => {
        drawSwingArm(
          ctx!, (phase + i * 0.12) % 1,
          entry.physics,
          COMPARISON_COLORS[i] ?? '#ffffff',
          playerX, groundY, scale, i * 16,
        )
      })

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
        height={340}
        className="w-full rounded-xl"
        style={{ background: '#0f172a' }}
      />
      <div className="mt-4 grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(entries.length, 3)}, 1fr)` }}>
        {entries.map((e, i) => {
          const color = COMPARISON_COLORS[i]
          const p = e.physics
          return (
            <div key={e.racquet.id} className="bg-gray-800/60 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-sm font-semibold text-white">{e.racquet.brand} {e.racquet.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Stat label="Swing style"    value={swingLabel(p.swingAngleDeg)}           color={color} />
                <Stat label="Low-to-high"    value={`${Math.round(p.swingAngleDeg)}°`}     color={color} />
                <Stat label="Contact height" value={`${Math.round(p.contactHeightCm)} cm`} color={color} />
                <Stat label="Est. spin"      value={`${p.spinRPM.toLocaleString()} RPM`}   color={color} />
              </div>
              <div className="mt-3">
                <p className="text-xs text-gray-400 mb-1">Spin potential</p>
                <div className="h-1.5 bg-gray-700 rounded-full">
                  <div className="h-1.5 rounded-full transition-all"
                    style={{ width: `${p.spinPotential * 100}%`, backgroundColor: color }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function swingLabel(deg: number): string {
  if (deg >= 35) return 'Extreme topspin'
  if (deg >= 25) return 'Heavy topspin'
  if (deg >= 18) return 'Moderate spin'
  if (deg >= 12) return 'Flat + spin'
  return 'Flat drive'
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className="font-medium" style={{ color }}>{value}</p>
    </div>
  )
}
