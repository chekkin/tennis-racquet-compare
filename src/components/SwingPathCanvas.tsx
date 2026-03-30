'use client'

import { useEffect, useRef } from 'react'
import { PhysicsProfile, lerp, easeOut, easeInOut } from '@/lib/physics'
import { Racquet, COMPARISON_COLORS } from '@/data/racquets'

interface RacquetEntry {
  racquet: Racquet
  physics: PhysicsProfile
}

interface Props {
  entries: RacquetEntry[]
}

// ─── constants ────────────────────────────────────────────────────────────────

const DEG = Math.PI / 180

// Forehand arm arc (counterclockwise in canvas coords, i.e. decreasing angle).
// Canvas angles: 0=right(→net), 90=down, 180=left(←back), 270=up.
//
//   Backswing  120° → arm points down-left  (racquet dropped behind/below)
//   Contact     60° → arm points down-right (racquet meets ball in front of body)
//   FollowThru 240° → arm points up-left    (racquet over left shoulder)
//   Ready      350° → arm points right/slightly-up (neutral ready position)
//
// Going counterclockwise: 120° → 90°(down) → 60°(contact) → 0°(right) → 300°(up-right) → 240°(follow-thru)
// This traces the classic low-to-high forehand arc.

const READY_ANGLE      = 350 * DEG
const BACKSWING_ANGLE  = 120 * DEG
const CONTACT_ANGLE    =  60 * DEG   // contact at 1/4 of swing arc
const FOLLOWTHRU_ANGLE = 240 * DEG
const FINISH_ANGLE     = 235 * DEG   // racquet wraps a touch further
const SWING_ARC        = 240 * DEG   // total arc backswing → follow-through

// Contact happens 1/4 of the way through the swing arc (from 120° to 60° = 60° out of 240°)
const CONTACT_T = (120 - 60) / 240   // = 0.25

function normalise(a: number) {
  return ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
}

/** Arm angle at swing progress t (0=backswing, 1=follow-through) */
function swingAngle(t: number) {
  return normalise(BACKSWING_ANGLE - t * SWING_ARC)
}

// ─── quadratic Bezier helper ──────────────────────────────────────────────────

function quadBez(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  t: number,
): [number, number] {
  const mt = 1 - t
  return [
    mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0],
    mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1],
  ]
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
  ctx.beginPath()
  ctx.moveTo(0, groundY)
  ctx.lineTo(w, groundY)
  ctx.stroke()
}

function drawNet(ctx: CanvasRenderingContext2D, x: number, groundY: number, scale: number) {
  const netH = 0.91 * scale
  const postH = 1.07 * scale
  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x, groundY)
  ctx.lineTo(x, groundY - postH)
  ctx.stroke()
  ctx.strokeStyle = '#ffffff80'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x - 8, groundY - postH)
  ctx.lineTo(x + 8, groundY - postH)
  ctx.stroke()
  ctx.strokeStyle = '#ffffff18'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const lx = x - 6 + i * 3
    ctx.beginPath()
    ctx.moveTo(lx, groundY)
    ctx.lineTo(lx, groundY - netH)
    ctx.stroke()
  }
  ctx.strokeStyle = '#ffffff40'
  ctx.beginPath()
  ctx.moveTo(x - 5, groundY - netH)
  ctx.lineTo(x + 5, groundY - netH)
  ctx.stroke()
}

// ─── animated player body ─────────────────────────────────────────────────────
//
// phase 0.00–0.18  → setup/backswing  (body turns sideways, arm loads)
// phase 0.18–0.62  → forward swing    (body uncoils, arm drives through)
// phase 0.62–0.76  → hold finish
// phase 0.76–1.00  → recovery

function drawPlayerBody(
  ctx: CanvasRenderingContext2D,
  phase: number,
  px: number,
  groundY: number,
) {
  // ── Phase sub-values ────────────────────────────────────────────────────
  const setupT = phase < 0.18 ? phase / 0.18 : 0
  const swingT = phase >= 0.18 && phase < 0.62 ? (phase - 0.18) / 0.44 : phase >= 0.62 ? 1 : 0
  const recovT = phase >= 0.76 ? (phase - 0.76) / 0.24 : 0
  const activeST = phase < 0.18 ? 0 : swingT  // 0→1 across active swing

  // ── Body rotation: 0=facing net, 1=fully sideways ──────────────────────
  // Body turns sideways during setup, unwinds through contact, faces net at finish
  const bodyRot = phase < 0.18
    ? easeInOut(setupT) * 0.7
    : phase < 0.50
    ? lerp(0.7, 0, easeOut(swingT / 0.7))
    : 0

  // ── Shoulder positions (animate with body rotation) ─────────────────────
  const rShoulderX = px - 10 + lerp(0, -10, bodyRot)
  const lShoulderX = px - 32 + lerp(0,  12, bodyRot)
  const shoulderY  = groundY - 148

  // ── Knee bend / crouch: deeper in backswing, drives up through contact ──
  const crouch = phase < 0.18 ? easeInOut(setupT) * 10
               : phase < 0.48 ? lerp(10, -6, easeOut(swingT / 0.6))
               : 0
  const kneeBend = Math.max(0, crouch)

  // ── Hip shifts forward during the swing ────────────────────────────────
  const hipX    = lerp(px - 1, px + 5, Math.max(0, Math.min((activeST - 0.2) / 0.5, 1)))
  const hipY    = groundY - 86 + kneeBend

  // ── Head position follows shoulder ─────────────────────────────────────
  const headX = rShoulderX + 8
  const headY = groundY - 170

  ctx.lineCap  = 'round'
  ctx.lineJoin = 'round'

  // ── Legs: semi-open forehand stance ─────────────────────────────────────
  ctx.strokeStyle = '#1e3a5f'
  ctx.lineWidth = 7
  const bfx  = px + 18    // back foot (right)
  const ffx  = px - 14    // front foot (left)
  const weightShift = Math.max(0, Math.min((activeST - 0.2) / 0.5, 1))
  const bkx = lerp(px + 12, px + 15, weightShift)
  const fkx = lerp(px - 9,  px - 11, weightShift)

  ctx.beginPath()
  ctx.moveTo(bfx, groundY)
  ctx.lineTo(bkx, groundY - 50 - kneeBend)
  ctx.lineTo(px + 6, hipY)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(ffx, groundY)
  ctx.lineTo(fkx, groundY - 50 - kneeBend * 0.6)
  ctx.lineTo(px - 4, hipY)
  ctx.stroke()

  // Shorts
  ctx.fillStyle = '#1e3a5f'
  ctx.beginPath()
  ctx.ellipse(px + 1, hipY + 10, 16, 11, 0, 0, Math.PI * 2)
  ctx.fill()

  // ── Torso ───────────────────────────────────────────────────────────────
  ctx.strokeStyle = '#1a5c38'
  ctx.lineWidth = 13
  ctx.beginPath()
  ctx.moveTo(hipX, hipY)
  ctx.lineTo(rShoulderX, shoulderY)
  ctx.stroke()

  // Shoulder cross-bar
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(lShoulderX, shoulderY + 2)
  ctx.lineTo(rShoulderX + 4, shoulderY)
  ctx.stroke()

  // ── Left arm (balance arm) ──────────────────────────────────────────────
  // During backswing: extends FORWARD toward ball (balance)
  // After contact: pulls back as body rotates through
  let leX: number, leY: number, lhX: number, lhY: number
  if (activeST <= CONTACT_T) {
    const t = easeOut(activeST / CONTACT_T)
    leX = lerp(lShoulderX + 2,  lShoulderX + 22, t)
    leY = lerp(shoulderY + 22,  shoulderY + 8,   t)
    lhX = lerp(lShoulderX - 6,  lShoulderX + 50, t)
    lhY = lerp(shoulderY + 48,  shoulderY + 12,  t)
  } else {
    const t = easeOut((activeST - CONTACT_T) / (1 - CONTACT_T))
    leX = lerp(lShoulderX + 22, lShoulderX - 8,  t)
    leY = lerp(shoulderY + 8,   shoulderY + 30,  t)
    lhX = lerp(lShoulderX + 50, lShoulderX - 20, t)
    lhY = lerp(shoulderY + 12,  shoulderY + 58,  t)
  }

  ctx.strokeStyle = '#5a7fa8'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(lShoulderX, shoulderY)
  ctx.lineTo(leX, leY)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(leX, leY)
  ctx.lineTo(lhX, lhY)
  ctx.stroke()

  // ── Head ────────────────────────────────────────────────────────────────
  ctx.fillStyle = '#4a5568'
  ctx.beginPath()
  ctx.arc(headX, headY, 14, 0, Math.PI * 2)
  ctx.fill()
  // Cap
  ctx.fillStyle = '#2d3748'
  ctx.beginPath()
  ctx.arc(headX, headY, 14, -Math.PI, 0)
  ctx.fill()
  ctx.strokeStyle = '#2d3748'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(headX - 16, headY)
  ctx.lineTo(headX + 16, headY)
  ctx.stroke()
}

// ─── swing arm + racquet + ball ───────────────────────────────────────────────

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
  // ── Phase sub-values ────────────────────────────────────────────────────
  const setupT = phase < 0.18 ? phase / 0.18 : 0
  const swingT = phase >= 0.18 && phase < 0.62 ? (phase - 0.18) / 0.44 : phase >= 0.62 ? 1 : 0
  const recovT = phase >= 0.76 ? (phase - 0.76) / 0.24 : 0
  const activeST = phase < 0.18 ? 0 : swingT

  // Body rotation (must match drawPlayerBody)
  const bodyRot = phase < 0.18
    ? easeInOut(setupT) * 0.7
    : phase < 0.50
    ? lerp(0.7, 0, easeOut(swingT / 0.7))
    : 0

  const rShoulderX = px - 10 + lerp(0, -10, bodyRot)
  const shoulderY  = groundY - 148
  const armLen     = 115

  // ── Arm angle ────────────────────────────────────────────────────────────
  let armAng: number
  if (phase < 0.18) {
    // Ready → backswing  (counterclockwise 350°→120° = 230° arc)
    armAng = normalise(READY_ANGLE - easeInOut(setupT) * 230 * DEG)
  } else if (phase < 0.62) {
    // Backswing → follow-through (counterclockwise 120°→240° via 0°)
    armAng = swingAngle(easeOut(swingT))
  } else if (phase < 0.76) {
    // Hold finish
    armAng = FINISH_ANGLE
  } else {
    // Recovery: follow-through → ready  (clockwise 240°→350° = +110°)
    armAng = normalise(FINISH_ANGLE + easeInOut(recovT) * 115 * DEG)
  }

  const racquetX = rShoulderX + Math.cos(armAng) * armLen
  const racquetY = shoulderY  + Math.sin(armAng) * armLen

  // ── Elbow ─────────────────────────────────────────────────────────────
  const elbowRatio = 0.48
  const bx0  = rShoulderX + Math.cos(armAng) * armLen * elbowRatio
  const by0  = shoulderY  + Math.sin(armAng) * armLen * elbowRatio
  const perpAng = armAng + Math.PI / 2
  const epx = Math.cos(perpAng)
  const epy = Math.sin(perpAng)

  // Elbow bows out during backswing & follow-through; straightens through contact
  let elbowDev: number
  if (activeST < CONTACT_T) {
    elbowDev = lerp(22, -8, easeOut(activeST / CONTACT_T))
  } else {
    const p = (activeST - CONTACT_T) / (1 - CONTACT_T)
    elbowDev = lerp(-8, 30, easeOut(p))
  }

  const elbowX = bx0 + epx * elbowDev
  const elbowY = by0 + epy * elbowDev
  const foreAng = Math.atan2(racquetY - elbowY, racquetX - elbowX)

  // ── Fixed contact position (for marker and ball launch) ─────────────────
  // Use the shoulder's neutral position (no body rotation) for the contact marker
  // so it doesn't jitter — the ball consistently launches from this fixed point.
  const rShoulderX0 = px - 10
  const contactX = rShoulderX0 + Math.cos(CONTACT_ANGLE) * armLen
  const contactY = shoulderY   + Math.sin(CONTACT_ANGLE) * armLen

  // ── Dotted swing arc guide ───────────────────────────────────────────────
  ctx.save()
  ctx.setLineDash([4, 7])
  ctx.strokeStyle = color + '28'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  // Counterclockwise from backswing (120°) to follow-through (240°)
  ctx.arc(rShoulderX, shoulderY, armLen, BACKSWING_ANGLE, FOLLOWTHRU_ANGLE, true)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  // ── Contact zone vertical dashed marker ─────────────────────────────────
  ctx.save()
  ctx.strokeStyle = color + '45'
  ctx.lineWidth = 1
  ctx.setLineDash([3, 5])
  ctx.beginPath()
  ctx.moveTo(contactX, groundY)
  ctx.lineTo(contactX, contactY - 10)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  ctx.fillStyle = color + '80'
  ctx.font = '10px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(`${Math.round(physics.contactHeightCm)} cm`, contactX, groundY + 14)

  // ── Hitting arm (two segments) ───────────────────────────────────────────
  ctx.strokeStyle = '#5a7fa8'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(rShoulderX, shoulderY)
  ctx.lineTo(elbowX, elbowY)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(elbowX, elbowY)
  ctx.lineTo(racquetX, racquetY)
  ctx.stroke()

  // ── Racquet head ─────────────────────────────────────────────────────────
  const headW = 14, headH = 20
  ctx.save()
  ctx.translate(racquetX, racquetY)
  ctx.rotate(foreAng - Math.PI / 2)

  // Glow proximity to contact angle
  const angDiff = Math.abs(normalise(armAng - CONTACT_ANGLE))
  const glowAlpha = Math.max(0, 1 - Math.min(angDiff, 2 * Math.PI - angDiff) / (35 * DEG))

  if (glowAlpha > 0) {
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, headH * 2)
    glow.addColorStop(0, color + Math.round(glowAlpha * 80).toString(16).padStart(2, '0'))
    glow.addColorStop(1, color + '00')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.ellipse(0, 0, headW * 2.2, headH * 2.2, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.shadowColor = color
  ctx.shadowBlur = glowAlpha > 0.3 ? 10 : 4
  ctx.beginPath()
  ctx.ellipse(0, 0, headW, headH, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.shadowBlur = 0

  // String bed
  ctx.strokeStyle = color + '60'
  ctx.lineWidth = 1
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath(); ctx.moveTo(i * 5, -headH + 4); ctx.lineTo(i * 5, headH - 4); ctx.stroke()
  }
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath(); ctx.moveTo(-headW + 4, i * 7); ctx.lineTo(headW - 4, i * 7); ctx.stroke()
  }
  ctx.restore()

  // ── Ball ──────────────────────────────────────────────────────────────────
  // Ball launches at the contact moment (phase ≈ 0.18 + 0.44 * CONTACT_T)
  const ballStart = 0.18 + 0.44 * CONTACT_T   // ≈ 0.29
  if (phase >= ballStart) {
    const ballPhase = Math.min((phase - ballStart) / (1 - ballStart), 1)

    const p0: [number, number] = [contactX, contactY]
    const netX  = px + (11.89 / 2) * scale
    const apexY = groundY - (0.91 + physics.netClearanceM) * scale
    const p1: [number, number] = [netX, apexY]
    const landX = px + physics.landingFromNetM * scale
    const p2: [number, number] = [landX, groundY - 3]

    const [bx, by] = quadBez(p0, p1, p2, easeOut(ballPhase))
    const ballR = lerp(7, 5, ballPhase)

    const ballGrad = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, ballR)
    ballGrad.addColorStop(0, '#fef08a')
    ballGrad.addColorStop(1, '#ca8a04')
    ctx.fillStyle = ballGrad
    ctx.shadowColor = '#fde047'
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.arc(bx, by, ballR, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    for (let i = 1; i <= 4; i++) {
      const trailT = Math.max(0, easeOut(ballPhase) - i * 0.06)
      const [tx, ty] = quadBez(p0, p1, p2, trailT)
      ctx.fillStyle = `rgba(253,224,71,${0.15 - i * 0.03})`
      ctx.beginPath()
      ctx.arc(tx, ty, ballR - i, 0, Math.PI * 2)
      ctx.fill()
    }

    if (ballPhase > 0.88) {
      const rp = (ballPhase - 0.88) / 0.12
      ctx.strokeStyle = `rgba(253,224,71,${1 - rp})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(p2[0], p2[1], 15 * rp, 5 * rp, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // ── Low-to-high annotation ────────────────────────────────────────────────
  if (phase >= 0.22 && phase <= 0.58) {
    ctx.fillStyle = color + 'cc'
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(
      `${Math.round(physics.swingAngleDeg)}° low-to-high`,
      px + 28,
      shoulderY + 28 + labelOffset,
    )
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
    const w = canvas.width
    const h = canvas.height
    const groundY = h - 60

    const playerX = w * 0.13
    const scale   = (w * 0.82) / 14

    function draw(ts: number) {
      if (!startRef.current) startRef.current = ts
      const phase = ((ts - startRef.current) % CYCLE_MS) / CYCLE_MS

      ctx!.clearRect(0, 0, w, h)
      drawBackground(ctx!, w, h, groundY)

      // Player body animates with the first racquet's phase
      const bodyPhase = (phase + 0 * 0.12) % 1
      drawPlayerBody(ctx!, bodyPhase, playerX, groundY)

      drawNet(ctx!, playerX + (11.89 / 2) * scale, groundY, scale)

      // Opponent baseline tick
      ctx!.strokeStyle = '#ffffff20'
      ctx!.lineWidth = 1
      const oppX = playerX + 11.89 * scale
      ctx!.beginPath()
      ctx!.moveTo(oppX, groundY - 6)
      ctx!.lineTo(oppX, groundY + 6)
      ctx!.stroke()

      // Draw each racquet's swing arm / ball (staggered phase)
      entries.forEach((entry, i) => {
        const p = (phase + i * 0.12) % 1
        drawSwingArm(
          ctx!,
          p,
          entry.physics,
          COMPARISON_COLORS[i] ?? '#ffffff',
          playerX,
          groundY,
          scale,
          i * 16,
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
                <Stat label="Swing style"    value={swingLabel(p.swingAngleDeg)}         color={color} />
                <Stat label="Low-to-high"    value={`${Math.round(p.swingAngleDeg)}°`}   color={color} />
                <Stat label="Contact height" value={`${Math.round(p.contactHeightCm)} cm`} color={color} />
                <Stat label="Est. spin"      value={`${p.spinRPM.toLocaleString()} RPM`} color={color} />
              </div>
              <div className="mt-3">
                <p className="text-xs text-gray-400 mb-1">Spin potential</p>
                <div className="h-1.5 bg-gray-700 rounded-full">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{ width: `${p.spinPotential * 100}%`, backgroundColor: color }}
                  />
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
