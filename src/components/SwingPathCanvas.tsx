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

// ─── drawing helpers ─────────────────────────────────────────────────────────

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, groundY: number) {
  // Sky / background
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#0f172a')
  grad.addColorStop(1, '#1e293b')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // Court surface (below ground)
  ctx.fillStyle = '#1a4d2e'
  ctx.fillRect(0, groundY, w, h - groundY)

  // Ground line
  ctx.strokeStyle = '#ffffff30'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, groundY)
  ctx.lineTo(w, groundY)
  ctx.stroke()
}

function drawNet(ctx: CanvasRenderingContext2D, x: number, groundY: number, scale: number) {
  const netHeightPx = 0.91 * scale // 91 cm net height
  const postH = 1.07 * scale

  // Net posts
  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x, groundY)
  ctx.lineTo(x, groundY - postH)
  ctx.stroke()

  // Net mesh (simplified)
  ctx.strokeStyle = '#ffffff40'
  ctx.lineWidth = 1
  // Horizontal band
  ctx.beginPath()
  ctx.moveTo(x - 5, groundY - netHeightPx)
  ctx.lineTo(x + 5, groundY - netHeightPx)
  ctx.stroke()

  // Net cord
  ctx.strokeStyle = '#ffffff80'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x - 8, groundY - postH)
  ctx.lineTo(x + 8, groundY - postH)
  ctx.stroke()

  // Vertical net lines
  ctx.strokeStyle = '#ffffff18'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const lx = x - 6 + i * 3
    ctx.beginPath()
    ctx.moveTo(lx, groundY)
    ctx.lineTo(lx, groundY - netHeightPx)
    ctx.stroke()
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, x: number, groundY: number) {
  // Coordinates matched to drawRacquetScene (shoulderX = x-10, shoulderY = groundY-145)
  const hipX      = x - 1
  const hipY      = groundY - 88
  const shoulderY = groundY - 145
  const rShoulderX = x - 10   // right shoulder (hitting arm pivot)
  const lShoulderX = x - 32   // left shoulder (balance arm)
  const headY     = groundY - 163

  ctx.lineCap  = 'round'
  ctx.lineJoin = 'round'

  // ── Legs: semi-open forehand stance ─────────────────────────────────────
  ctx.strokeStyle = '#1e3a5f'
  ctx.lineWidth = 7
  // Back leg (right foot further back / wider for weight)
  ctx.beginPath()
  ctx.moveTo(x + 20, groundY)
  ctx.lineTo(x + 13, groundY - 50)
  ctx.lineTo(x + 6,  hipY)
  ctx.stroke()
  // Front leg (left foot, slightly forward)
  ctx.beginPath()
  ctx.moveTo(x - 14, groundY)
  ctx.lineTo(x - 9,  groundY - 50)
  ctx.lineTo(x - 5,  hipY)
  ctx.stroke()

  // ── Shorts ──────────────────────────────────────────────────────────────
  ctx.fillStyle = '#1e3a5f'
  ctx.beginPath()
  ctx.ellipse(x + 1, hipY + 10, 16, 12, 0, 0, Math.PI * 2)
  ctx.fill()

  // ── Torso (tennis shirt) ────────────────────────────────────────────────
  ctx.strokeStyle = '#1a5c38'
  ctx.lineWidth = 13
  ctx.beginPath()
  ctx.moveTo(hipX, hipY)
  ctx.lineTo(rShoulderX, shoulderY)
  ctx.stroke()

  // Shoulder cross-bar
  ctx.strokeStyle = '#1a5c38'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(lShoulderX, shoulderY)
  ctx.lineTo(rShoulderX + 6, shoulderY)
  ctx.stroke()

  // ── Left arm (non-dominant, outstretched for balance) ───────────────────
  // Upper arm goes slightly back-and-down, forearm extends forward toward net
  ctx.strokeStyle = '#7a9bbf'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(lShoulderX, shoulderY)
  ctx.lineTo(lShoulderX - 12, shoulderY + 26)   // upper arm: down-and-back
  ctx.lineTo(lShoulderX + 4,  shoulderY + 52)   // forearm: angles forward
  ctx.stroke()

  // ── Head ────────────────────────────────────────────────────────────────
  ctx.fillStyle = '#4a5568'
  ctx.beginPath()
  ctx.arc(x - 3, headY, 14, 0, Math.PI * 2)
  ctx.fill()

  // Cap (top half) + brim
  ctx.fillStyle = '#2d3748'
  ctx.beginPath()
  ctx.arc(x - 3, headY, 14, -Math.PI, 0)
  ctx.fill()
  ctx.strokeStyle = '#2d3748'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(x - 18, headY)
  ctx.lineTo(x + 12, headY)
  ctx.stroke()
}

/**
 * Quadratic Bezier point helper.
 */
function quadBez(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  t: number
): [number, number] {
  const mt = 1 - t
  return [
    mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0],
    mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1],
  ]
}

// ─── per-racquet draw function ────────────────────────────────────────────────

function drawRacquetScene(
  ctx: CanvasRenderingContext2D,
  phase: number, // 0→1 (animation progress within cycle)
  physics: PhysicsProfile,
  color: string,
  cx: number,    // horizontal centre of the "player zone" for this panel
  groundY: number,
  scale: number, // px per metre
  labelOffset = 0 // vertical offset for annotation label (px) to avoid overlap
) {
  const shoulderX = cx - 10
  const shoulderY = groundY - 145 // approx shoulder height

  // Swing phase breakdown:
  // 0.00–0.25  backswing (drop below, racquet goes back)
  // 0.25–0.60  forward swing (low-to-high through contact)
  // 0.60–0.72  contact flash + ball launches
  // 0.72–1.00  follow-through + ball arc

  // Convert swing angle deg → what angle on the circular arc we hit contact
  // swing path goes from ~210° → 80° (clockwise on screen canvas coords)
  // contact angle on arm arc ≈ 180° - physics.swingAngleDeg
  const contactArmAngle = (190 - physics.swingAngleDeg) * (Math.PI / 180)
  const backswingAngle  = 220 * (Math.PI / 180)
  const followThruAngle = 75  * (Math.PI / 180)
  const readyAngle      = 165 * (Math.PI / 180)

  // Extended follow-through finishes slightly past the initial followThruAngle
  // so the racquet wraps further around before the arm returns to ready.
  const finishAngle = 45 * (Math.PI / 180)

  let armAngle: number
  if (phase < 0.20) {
    // Ready → backswing
    armAngle = lerp(readyAngle, backswingAngle, easeInOut(phase / 0.20))
  } else if (phase < 0.62) {
    // Backswing → through contact → follow-through peak
    const p = (phase - 0.20) / 0.42
    armAngle = lerp(backswingAngle, followThruAngle, easeOut(p))
  } else if (phase < 0.72) {
    // Follow-through continues — racquet wraps to finish position
    const p = (phase - 0.62) / 0.10
    armAngle = lerp(followThruAngle, finishAngle, easeOut(p))
  } else {
    // Recovery: arm smoothly returns to ready for next cycle
    const p = (phase - 0.72) / 0.28
    armAngle = lerp(finishAngle, readyAngle, easeInOut(p))
  }

  const armLen = 115
  const racquetX = shoulderX + Math.cos(armAngle) * armLen
  const racquetY = shoulderY + Math.sin(armAngle) * armLen

  // Draw swing arc guide (dotted)
  ctx.save()
  ctx.setLineDash([4, 6])
  ctx.strokeStyle = color + '30'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(shoulderX, shoulderY, armLen, backswingAngle, finishAngle, true) // ccw arc through full follow-through
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  // Draw contact zone marker
  const contactX = shoulderX + Math.cos(contactArmAngle) * armLen
  const contactY = shoulderY + Math.sin(contactArmAngle) * armLen
  ctx.save()
  ctx.strokeStyle = color + '50'
  ctx.lineWidth = 1
  ctx.setLineDash([3, 5])
  ctx.beginPath()
  ctx.moveTo(contactX, groundY)
  ctx.lineTo(contactX, contactY - 8)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  // Contact height label
  const contactHeightLabel = `${Math.round(physics.contactHeightCm)} cm`
  ctx.fillStyle = color + '80'
  ctx.font = '10px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(contactHeightLabel, contactX, groundY + 14)

  // ── Two-segment arm: shoulder → elbow → wrist/racquet ───────────────────
  // Split arm into upper arm (55 %) + forearm (45 %) of total arm length.
  // The elbow deviates perpendicularly from the straight-arm midpoint to
  // simulate the natural bend:
  //   • backswing  → elbow bows out/upward (arm loaded)
  //   • contact    → arm extends, elbow nearly straight
  //   • follow-thru → elbow rises as arm wraps over shoulder

  const upperRatio = 0.50            // fraction of armLen to elbow
  const perpAngle  = armAngle + Math.PI / 2   // 90° clockwise from arm dir
  const perpX = Math.cos(perpAngle)
  const perpY = Math.sin(perpAngle)

  // Straight-line elbow position (before applying bend)
  const elbowBaseX = shoulderX + Math.cos(armAngle) * armLen * upperRatio
  const elbowBaseY = shoulderY + Math.sin(armAngle) * armLen * upperRatio

  // How much to deviate perpendicular to the arm at the elbow
  let elbowDev: number
  if (phase < 0.22) {
    elbowDev = lerp(10, 24, easeInOut(phase / 0.22))          // loading up
  } else if (phase < 0.58) {
    const p = (phase - 0.22) / 0.36
    elbowDev = lerp(24, -4, easeOut(p))                        // drives through, slight hyper-extend feel
  } else {
    const p = (phase - 0.58) / 0.42
    elbowDev = lerp(-4, 32, easeOut(p))                        // elbow rises in follow-through
  }

  const elbowX = elbowBaseX + perpX * elbowDev
  const elbowY = elbowBaseY + perpY * elbowDev

  // Forearm direction from elbow → racquet (for orienting the racquet head)
  const forearmAngle = Math.atan2(racquetY - elbowY, racquetX - elbowX)

  ctx.strokeStyle = '#64748b'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(shoulderX, shoulderY)
  ctx.lineTo(elbowX, elbowY)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(elbowX, elbowY)
  ctx.lineTo(racquetX, racquetY)
  ctx.stroke()

  // ── Racquet head ─────────────────────────────────────────────────────────
  const headW = 14
  const headH = 20
  ctx.save()
  ctx.translate(racquetX, racquetY)
  ctx.rotate(forearmAngle - Math.PI / 2)   // orient racquet along forearm, not whole arm

  // Glow when near contact
  const contactPhase = 0.40
  const distToContact = Math.abs((phase < 0.60 ? (phase - 0.20) / 0.40 : 1) - contactPhase / 0.40)
  const glowAlpha = Math.max(0, 1 - distToContact * 4)

  if (glowAlpha > 0) {
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, headH * 1.8)
    glow.addColorStop(0, color + Math.round(glowAlpha * 80).toString(16).padStart(2, '0'))
    glow.addColorStop(1, color + '00')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.ellipse(0, 0, headW * 2, headH * 2, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Frame
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.shadowColor = color
  ctx.shadowBlur = 6
  ctx.beginPath()
  ctx.ellipse(0, 0, headW, headH, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.shadowBlur = 0

  // String bed (3 vertical, 2 horizontal lines)
  ctx.strokeStyle = color + '60'
  ctx.lineWidth = 1
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.moveTo(i * 5, -headH + 4)
    ctx.lineTo(i * 5,  headH - 4)
    ctx.stroke()
  }
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.moveTo(-headW + 4, i * 7)
    ctx.lineTo( headW - 4, i * 7)
    ctx.stroke()
  }

  ctx.restore()

  // ── Ball ─────────────────────────────────────────────────────────────────
  // Ball appears just before contact and then launches
  if (phase >= 0.50) {
    const ballPhase = (phase - 0.50) / 0.50  // 0→1 during second half

    // Ball launch trajectory: quadratic Bezier from contact to landing
    const p0: [number, number] = [contactX, contactY]

    // Net position in canvas coords
    const netX = cx + (11.89 / 2) * scale  // half the court distance to net
    const netPx = netX
    const netHeightPx = groundY - 0.91 * scale

    // Control point: slightly past net, at apex height
    const apexY = groundY - (0.91 + physics.netClearanceM) * scale
    const p1: [number, number] = [netPx, apexY]

    // Landing point
    const landX = cx + physics.landingFromNetM * scale
    const p2: [number, number] = [landX, groundY - 3]

    const [bx, by] = quadBez(p0, p1, p2, easeOut(ballPhase))

    // Ball size (slightly larger at contact, smaller at distance for depth illusion)
    const ballR = lerp(7, 5, ballPhase)

    // Ball
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

    // Ball trail
    for (let i = 1; i <= 4; i++) {
      const trailT = Math.max(0, easeOut(ballPhase) - i * 0.06)
      const [tx, ty] = quadBez(p0, p1, p2, trailT)
      ctx.fillStyle = `rgba(253,224,71,${0.15 - i * 0.03})`
      ctx.beginPath()
      ctx.arc(tx, ty, ballR - i, 0, Math.PI * 2)
      ctx.fill()
    }

    // Landing ripple
    if (ballPhase > 0.9) {
      const rippleAlpha = (ballPhase - 0.9) / 0.1
      ctx.strokeStyle = `rgba(253,224,71,${1 - rippleAlpha})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(p2[0], p2[1], 14 * rippleAlpha, 5 * rippleAlpha, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // ── Swing angle annotation (offset per racquet to avoid overlap) ─────────
  if (phase >= 0.30 && phase <= 0.65) {
    const annX = shoulderX + 30
    const annY = shoulderY + 30 + labelOffset
    ctx.fillStyle = color + 'cc'
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`${Math.round(physics.swingAngleDeg)}° low-to-high`, annX, annY)
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

    const CYCLE_MS = 3200 // ms for one full swing cycle
    const w = canvas.width
    const h = canvas.height
    const groundY = h - 60

    // Single shared court — player at left, full width
    const playerX = w * 0.13
    const scale   = (w * 0.82) / 14

    function draw(ts: number) {
      if (!startRef.current) startRef.current = ts
      const elapsed = ts - startRef.current
      const phase = (elapsed % CYCLE_MS) / CYCLE_MS

      ctx!.clearRect(0, 0, w, h)
      drawBackground(ctx!, w, h, groundY)

      // Draw court furniture once
      drawPlayer(ctx!, playerX, groundY)
      drawNet(ctx!, playerX + 11.89 / 2 * scale, groundY, scale)

      // Opponent baseline marker
      ctx!.strokeStyle = '#ffffff20'
      ctx!.lineWidth = 1
      const oppBaseX = playerX + 11.89 * scale
      ctx!.beginPath()
      ctx!.moveTo(oppBaseX, groundY - 6)
      ctx!.lineTo(oppBaseX, groundY + 6)
      ctx!.stroke()

      // Overlay all racquet swing paths on the same court
      entries.forEach((entry, i) => {
        // Stagger phase slightly so balls don't perfectly overlap
        const staggeredPhase = (phase + i * 0.12) % 1
        drawRacquetScene(
          ctx!,
          staggeredPhase,
          entry.physics,
          COMPARISON_COLORS[i] ?? '#ffffff',
          playerX,
          groundY,
          scale,
          i * 16  // stagger annotation labels vertically
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
      {/* Legend grid — wraps at 3 per row for larger comparisons */}
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
                <Stat label="Swing style" value={swingLabel(p.swingAngleDeg)} color={color} />
                <Stat label="Low-to-high" value={`${Math.round(p.swingAngleDeg)}°`} color={color} />
                <Stat label="Contact height" value={`${Math.round(p.contactHeightCm)} cm`} color={color} />
                <Stat label="Est. spin" value={`${p.spinRPM.toLocaleString()} RPM`} color={color} />
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
