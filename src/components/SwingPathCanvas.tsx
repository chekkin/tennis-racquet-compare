'use client'

import { useEffect, useRef } from 'react'
import { PhysicsProfile, lerp, easeOut, easeInOut } from '@/lib/physics'
import { Racquet, COMPARISON_COLORS } from '@/data/racquets'

interface RacquetEntry { racquet: Racquet; physics: PhysicsProfile }
interface Props { entries: RacquetEntry[] }

// ── palette ───────────────────────────────────────────────────────────────────
const SKIN   = '#d4a574'
const SKIN_S = '#b8876a'
const SHIRT  = '#1a5c38'
const SHORTS = '#1e3a5f'
const SOCK   = '#dde3ec'
const SHOE   = '#f0ece0'
const CAP    = '#1a2538'
const OL     = '#0f1117'   // dark outline

// ── keyframe skeleton ─────────────────────────────────────────────────────────
// Joint positions [dx, dy] relative to [playerX, groundY].
// +x = right (toward net),  -y = up (away from ground).
//
// Five poses covering one full forehand cycle:
//   KF0  Ready        – neutral two-handed guard
//   KF1  Backswing    – unit-turn, racquet dropped low-and-behind
//   KF2  Contact      – arm fully extended, weight into ball
//   KF3  Follow-thru  – arm sweeps up high
//   KF4  Finish       – racquet wrapped over left shoulder

type Pt = [number, number]
interface Pose {
  hip: Pt
  rSh: Pt; rEl: Pt; rWr: Pt  // dominant (right) arm
  lSh: Pt; lEl: Pt; lHd: Pt  // balance (left) arm
  head: Pt
  stance: number              // 0=neutral  1=wide  2=weight-forward
}

const KF: Pose[] = [
  // KF0 – Ready
  {
    hip:  [ -2, -90 ],
    rSh:  [  2, -152], rEl: [ 16, -126], rWr: [ 26, -106],
    lSh:  [-24, -152], lEl: [-18, -126], lHd: [-10, -104],
    head: [ -4, -174], stance: 0,
  },
  // KF1 – Backswing  (racquet dropped low-left, body turned)
  {
    hip:  [ -2, -84 ],
    rSh:  [  6, -150], rEl: [ -8, -112], rWr: [-30, -76 ],
    lSh:  [-18, -150], lEl: [-10, -122], lHd: [ 22, -104],
    head: [  0, -171], stance: 1,
  },
  // KF2 – Contact  (arm extended toward net)
  {
    hip:  [  4, -90 ],
    rSh:  [  2, -152], rEl: [ 28, -126], rWr: [ 64, -96 ],
    lSh:  [-26, -152], lEl: [-20, -128], lHd: [-16, -116],
    head: [  2, -175], stance: 1.5,
  },
  // KF3 – Follow-through high
  {
    hip:  [  6, -92 ],
    rSh:  [  4, -152], rEl: [ 20, -170], rWr: [ -4, -194],
    lSh:  [-24, -150], lEl: [-18, -126], lHd: [-12, -110],
    head: [  2, -175], stance: 2,
  },
  // KF4 – Finish  (racquet over left shoulder)
  {
    hip:  [  6, -90 ],
    rSh:  [  4, -150], rEl: [ -4, -174], rWr: [-26, -180],
    lSh:  [-24, -150], lEl: [-16, -128], lHd: [ -8, -108],
    head: [ -2, -173], stance: 2,
  },
]

// Phase at which each keyframe STARTS (last segment 0.80→1.0 = recovery back to KF0)
const KF_T = [0, 0.22, 0.50, 0.68, 0.80] as const

function lerpPt(a: Pt, b: Pt, t: number): Pt {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]
}
function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    hip:  lerpPt(a.hip,  b.hip,  t),
    rSh:  lerpPt(a.rSh,  b.rSh,  t),
    rEl:  lerpPt(a.rEl,  b.rEl,  t),
    rWr:  lerpPt(a.rWr,  b.rWr,  t),
    lSh:  lerpPt(a.lSh,  b.lSh,  t),
    lEl:  lerpPt(a.lEl,  b.lEl,  t),
    lHd:  lerpPt(a.lHd,  b.lHd,  t),
    head: lerpPt(a.head, b.head, t),
    stance: lerp(a.stance, b.stance, t),
  }
}

function getPose(phase: number): Pose {
  // Recovery: KF4 → KF0
  if (phase >= 0.80) {
    return lerpPose(KF[4], KF[0], easeInOut((phase - 0.80) / 0.20))
  }
  // Find segment
  for (let i = KF_T.length - 2; i >= 0; i--) {
    if (phase >= KF_T[i]) {
      const segLen = KF_T[i + 1] - KF_T[i]
      const t = (phase - KF_T[i]) / segLen
      // Easing per segment: setup=easeInOut, swing=easeOut, others=easeInOut
      const ease = (i === 1 || i === 2) ? easeOut : easeInOut
      return lerpPose(KF[i], KF[i + 1], ease(t))
    }
  }
  return KF[0]
}

// ── drawing helpers ───────────────────────────────────────────────────────────

/** Capsule (thick rounded stroke). Outline version: dark border then fill. */
function capsule(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  w: number, color: string,
) {
  ctx.save()
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  ctx.restore()
}
function capsuleOL(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  w: number, fill: string,
) {
  capsule(ctx, x1, y1, x2, y2, w + 3, OL)
  capsule(ctx, x1, y1, x2, y2, w, fill)
}

/** Filled circle with optional outline. */
function circ(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number, fill: string, stroke?: string, sw = 2,
) {
  ctx.save()
  ctx.fillStyle = fill
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw; ctx.stroke() }
  ctx.restore()
}

// ── background & net ──────────────────────────────────────────────────────────

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, groundY: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#0f172a')
  grad.addColorStop(1, '#1e293b')
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#1a4d2e'; ctx.fillRect(0, groundY, w, h - groundY)
  ctx.strokeStyle = '#ffffff30'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(w, groundY); ctx.stroke()
}

function drawNet(ctx: CanvasRenderingContext2D, x: number, groundY: number, scale: number) {
  const netH = 0.91 * scale, postH = 1.07 * scale
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

// ── bezier helper ─────────────────────────────────────────────────────────────

function qBez(
  p0: [number, number], p1: [number, number], p2: [number, number], t: number,
): [number, number] {
  const m = 1 - t
  return [
    m * m * p0[0] + 2 * m * t * p1[0] + t * t * p2[0],
    m * m * p0[1] + 2 * m * t * p1[1] + t * t * p2[1],
  ]
}

// ── player body (legs + torso + head + left arm) ──────────────────────────────
// The RIGHT arm is drawn separately by drawSwingArm so multiple racquets can overlay.

function drawPlayerBody(
  ctx: CanvasRenderingContext2D,
  pose: Pose,
  px: number,
  groundY: number,
) {
  const A = (pt: Pt): [number, number] => [px + pt[0], groundY + pt[1]]

  const [hipX, hipY] = A(pose.hip)
  const [rShX, rShY] = A(pose.rSh)
  const [lShX, lShY] = A(pose.lSh)
  const [lElX, lElY] = A(pose.lEl)
  const [lHdX, lHdY] = A(pose.lHd)
  const [hdX,  hdY]  = A(pose.head)

  // ── leg geometry (derived from hip + stance progress) ────────────────────
  const s = pose.stance
  const sw = Math.min(s, 1)       // 0→1: stance width
  const wf = Math.max(0, s - 1)   // 0→1: weight forward

  // Hip attachment points (split slightly)
  const bHX = hipX + 8, fHX = hipX - 6

  // Knee positions
  const bKnX = bHX + lerp(3,  6,  wf),   bKnY = groundY - lerp(52, 48, wf)
  const fKnX = fHX - lerp(2,  6,  wf),   fKnY = groundY - 50

  // Ankle positions
  const bAnX = bHX + lerp(lerp(14, 22, sw), 14, wf),  bAnY = groundY - 5
  const fAnX = fHX - lerp(lerp( 8, 16, sw), 20, wf),  fAnY = groundY - 5

  // ── ground shadow ─────────────────────────────────────────────────────────
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.20)'
  ctx.beginPath(); ctx.ellipse(px + 2, groundY, 30, 4.5, 0, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // ── back leg (right, further from camera) ─────────────────────────────────
  capsuleOL(ctx, bHX, hipY, bKnX, bKnY, 13, SHORTS)
  capsuleOL(ctx, bKnX, bKnY, bAnX, bAnY, 9, SOCK)
  ctx.save()
  ctx.fillStyle = SHOE; ctx.strokeStyle = OL; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.ellipse(bAnX + 8, groundY - 2, 14, 4.5, -0.08, 0, Math.PI * 2)
  ctx.fill(); ctx.stroke()
  ctx.restore()

  // ── front leg (left, closer to camera) ───────────────────────────────────
  capsuleOL(ctx, fHX, hipY, fKnX, fKnY, 13, SHORTS)
  capsuleOL(ctx, fKnX, fKnY, fAnX, fAnY, 9, SOCK)
  ctx.save()
  ctx.fillStyle = SHOE; ctx.strokeStyle = OL; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.ellipse(fAnX + 5, groundY - 2, 14, 4.5, 0.10, 0, Math.PI * 2)
  ctx.fill(); ctx.stroke()
  ctx.restore()

  // ── shorts band ───────────────────────────────────────────────────────────
  ctx.save()
  ctx.fillStyle = SHORTS; ctx.strokeStyle = OL; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.ellipse(hipX, hipY + 8, 16, 10, 0, 0, Math.PI * 2)
  ctx.fill(); ctx.stroke()
  ctx.restore()

  // ── shirt (filled polygon shoulder-to-hip) ────────────────────────────────
  ctx.save()
  ctx.fillStyle = SHIRT; ctx.strokeStyle = OL; ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.moveTo(hipX - 10, hipY + 2)
  ctx.lineTo(lShX,      lShY + 6)
  ctx.lineTo(rShX,      rShY + 6)
  ctx.lineTo(hipX + 12, hipY + 2)
  ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.restore()

  // shirt collar highlight
  ctx.save()
  ctx.strokeStyle = '#2d7a4a'; ctx.lineWidth = 2; ctx.lineCap = 'round'
  const nkX0 = (lShX + rShX) / 2 + 3
  ctx.beginPath()
  ctx.moveTo(nkX0 - 3, (lShY + rShY) / 2 + 2)
  ctx.lineTo(nkX0 + 2, (lShY + rShY) / 2 + 12)
  ctx.stroke()
  ctx.restore()

  // ── left arm (balance arm) ────────────────────────────────────────────────
  capsuleOL(ctx, lShX, lShY, lElX, lElY, 10, SKIN)
  capsuleOL(ctx, lElX, lElY, lHdX, lHdY,  8, SKIN)
  circ(ctx, lHdX, lHdY, 5, SKIN, OL, 1.5)

  // ── neck ──────────────────────────────────────────────────────────────────
  const nkX = (lShX + rShX) / 2 + 4
  const nkY = (lShY + rShY) / 2 + 2
  capsuleOL(ctx, nkX, nkY, hdX, hdY + 13, 8, SKIN)

  // ── head ──────────────────────────────────────────────────────────────────
  circ(ctx, hdX, hdY, 16, SKIN, OL, 1.8)

  // cap (top half)
  ctx.save()
  ctx.fillStyle = CAP; ctx.strokeStyle = OL; ctx.lineWidth = 1.8
  ctx.beginPath(); ctx.arc(hdX, hdY, 17, -Math.PI, 0.06); ctx.closePath()
  ctx.fill(); ctx.stroke()
  // brim
  ctx.strokeStyle = CAP; ctx.lineWidth = 6; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(hdX - 18, hdY + 1); ctx.lineTo(hdX + 22, hdY + 1); ctx.stroke()
  ctx.strokeStyle = OL; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(hdX - 18, hdY + 1); ctx.lineTo(hdX + 22, hdY + 1); ctx.stroke()
  ctx.restore()

  // ear
  circ(ctx, hdX - 11, hdY + 4, 4, SKIN_S, OL, 1)

  // face: eye + smile
  circ(ctx, hdX + 4, hdY - 2, 2.5, '#1a1a2e')
  ctx.save()
  ctx.strokeStyle = '#7a4f30'; ctx.lineWidth = 1.5; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(hdX + 3, hdY + 3, 4, 0.1, Math.PI - 0.1); ctx.stroke()
  ctx.restore()
}

// ── hitting arm + racquet + ball ──────────────────────────────────────────────

function drawSwingArm(
  ctx: CanvasRenderingContext2D,
  pose: Pose,
  px: number,
  groundY: number,
  color: string,
  physics: PhysicsProfile,
  scale: number,
  phase: number,
  labelOffset: number,
) {
  const A = (pt: Pt): [number, number] => [px + pt[0], groundY + pt[1]]

  const [rShX, rShY] = A(pose.rSh)
  const [rElX, rElY] = A(pose.rEl)
  const [rWrX, rWrY] = A(pose.rWr)

  // Forearm direction (elbow → wrist)
  const foreA = Math.atan2(rWrY - rElY, rWrX - rElX)

  // ── swing path trail (wrist path over full cycle) ─────────────────────────
  ctx.save()
  ctx.setLineDash([3, 6]); ctx.strokeStyle = color + '22'; ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let i = 0; i <= 50; i++) {
    const p = getPose(i / 50)
    const wx = px + p.rWr[0], wy = groundY + p.rWr[1]
    i === 0 ? ctx.moveTo(wx, wy) : ctx.lineTo(wx, wy)
  }
  ctx.stroke(); ctx.setLineDash([]); ctx.restore()

  // ── upper arm ─────────────────────────────────────────────────────────────
  capsuleOL(ctx, rShX, rShY, rElX, rElY, 12, SKIN)

  // ── forearm ───────────────────────────────────────────────────────────────
  capsuleOL(ctx, rElX, rElY, rWrX, rWrY, 10, SKIN)

  // ── hand ──────────────────────────────────────────────────────────────────
  circ(ctx, rWrX, rWrY, 6, SKIN, OL, 1.5)

  // ── racquet ───────────────────────────────────────────────────────────────
  // Glow near contact (phase 0.48–0.58)
  const contactPhase = 0.50
  const glow = Math.max(0, 1 - Math.abs(phase - contactPhase) / 0.10)

  const HW = 14, HH = 19
  // Head center in local coords (local -y = forearm direction = away from body)
  const headCY = -(18 + HH)   // = -37

  ctx.save()
  ctx.translate(rWrX, rWrY)
  // rotate so local -y aligns with forearm direction (head beyond hand, grip toward elbow)
  ctx.rotate(foreA + Math.PI / 2)

  // Grip (local +y side = toward elbow)
  ctx.save()
  ctx.strokeStyle = '#3d2b1f'; ctx.lineWidth = 9; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 26); ctx.stroke()
  ctx.strokeStyle = '#5c3d28'; ctx.lineWidth = 7
  ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, 24); ctx.stroke()
  ctx.restore()
  // butt cap
  circ(ctx, 0, 29, 5, '#2a2a2a')

  // Throat lines (converge from grip end to head base)
  ctx.save()
  ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 2; ctx.lineCap = 'butt'
  ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-HW * 0.5, -18); ctx.stroke()
  ctx.beginPath(); ctx.moveTo( 3, 0); ctx.lineTo( HW * 0.5, -18); ctx.stroke()
  ctx.restore()

  // Glow halo on frame
  if (glow > 0) {
    const g = ctx.createRadialGradient(0, headCY, 0, 0, headCY, HH * 2.6)
    g.addColorStop(0, color + Math.round(glow * 80).toString(16).padStart(2, '0'))
    g.addColorStop(1, color + '00')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.ellipse(0, headCY, HW * 2.2, HH * 2.2, 0, 0, Math.PI * 2); ctx.fill()
  }

  // Frame outline then frame fill
  ctx.strokeStyle = OL; ctx.lineWidth = 5
  ctx.shadowColor = glow > 0.3 ? color : 'transparent'; ctx.shadowBlur = glow * 14
  ctx.beginPath(); ctx.ellipse(0, headCY, HW, HH, 0, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = color; ctx.lineWidth = 3
  ctx.beginPath(); ctx.ellipse(0, headCY, HW, HH, 0, 0, Math.PI * 2); ctx.stroke()
  ctx.shadowBlur = 0

  // Strings
  ctx.strokeStyle = color + '55'; ctx.lineWidth = 0.8
  for (let i = -2; i <= 2; i++) {
    const sx = i * (HW - 1) / 2.2
    ctx.beginPath(); ctx.moveTo(sx, headCY - HH + 4); ctx.lineTo(sx, headCY + HH - 4); ctx.stroke()
  }
  for (let i = -3; i <= 3; i++) {
    const sy = headCY + i * (HH - 3) / 3.2
    ctx.beginPath(); ctx.moveTo(-HW + 4, sy); ctx.lineTo(HW - 4, sy); ctx.stroke()
  }

  ctx.restore()

  // ── contact height marker ─────────────────────────────────────────────────
  // Fixed at the contact keyframe's wrist position
  const cX = px + KF[2].rWr[0]
  const cY = groundY + KF[2].rWr[1]
  ctx.save()
  ctx.strokeStyle = color + '40'; ctx.lineWidth = 1; ctx.setLineDash([3, 5])
  ctx.beginPath(); ctx.moveTo(cX, groundY); ctx.lineTo(cX, cY - 10); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = color + 'cc'
  ctx.font = '10px monospace'; ctx.textAlign = 'center'
  ctx.fillText(`${Math.round(physics.contactHeightCm)} cm`, cX, groundY + 14)
  ctx.restore()

  // ── ball ──────────────────────────────────────────────────────────────────
  // Launch from contact point just after contact phase
  const ballStart = 0.52
  if (phase >= ballStart) {
    const bp = Math.min((phase - ballStart) / (1 - ballStart), 1)
    const p0: [number, number] = [cX, cY]
    const netX = px + (11.89 / 2) * scale
    const p1: [number, number] = [netX, groundY - (0.91 + physics.netClearanceM) * scale]
    const p2: [number, number] = [px + physics.landingFromNetM * scale, groundY - 3]
    const [bx, by] = qBez(p0, p1, p2, easeOut(bp))
    const br = lerp(7, 5, bp)

    const bg = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, br)
    bg.addColorStop(0, '#fef08a'); bg.addColorStop(1, '#ca8a04')
    ctx.fillStyle = bg; ctx.shadowColor = '#fde047'; ctx.shadowBlur = 8
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0

    // motion trail
    for (let i = 1; i <= 3; i++) {
      const [tx, ty] = qBez(p0, p1, p2, Math.max(0, easeOut(bp) - i * 0.07))
      ctx.fillStyle = `rgba(253,224,71,${0.12 - i * 0.03})`
      ctx.beginPath(); ctx.arc(tx, ty, br - i, 0, Math.PI * 2); ctx.fill()
    }

    // bounce ring
    if (bp > 0.88) {
      const rp = (bp - 0.88) / 0.12
      ctx.strokeStyle = `rgba(253,224,71,${1 - rp})`; ctx.lineWidth = 2
      ctx.beginPath(); ctx.ellipse(p2[0], p2[1], 15 * rp, 5 * rp, 0, 0, Math.PI * 2); ctx.stroke()
    }
  }

  // ── swing angle label ─────────────────────────────────────────────────────
  if (phase >= 0.28 && phase <= 0.60) {
    ctx.fillStyle = color + 'cc'
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'
    ctx.fillText(
      `${Math.round(physics.swingAngleDeg)}° low-to-high`,
      px + 34, groundY - 150 + labelOffset,
    )
  }
}

// ── main component ────────────────────────────────────────────────────────────

export default function SwingPathCanvas({ entries }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)
  const startRef  = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const CYCLE_MS = 3600
    const w = canvas.width, h = canvas.height
    const groundY = h - 60
    const playerX = w * 0.18    // extra left margin for backswing
    const scale   = (w * 0.77) / 14

    function draw(ts: number) {
      if (!startRef.current) startRef.current = ts
      const phase = ((ts - startRef.current) % CYCLE_MS) / CYCLE_MS

      ctx!.clearRect(0, 0, w, h)
      drawBackground(ctx!, w, h, groundY)

      // Body uses first racquet's phase
      const bodyPose = getPose(phase)
      drawPlayerBody(ctx!, bodyPose, playerX, groundY)

      drawNet(ctx!, playerX + (11.89 / 2) * scale, groundY, scale)

      // Opponent baseline tick
      ctx!.strokeStyle = '#ffffff20'; ctx!.lineWidth = 1
      const oppX = playerX + 11.89 * scale
      ctx!.beginPath(); ctx!.moveTo(oppX, groundY - 6); ctx!.lineTo(oppX, groundY + 6); ctx!.stroke()

      // Each racquet: staggered arm + ball
      entries.forEach((entry, i) => {
        const p = (phase + i * 0.12) % 1
        drawSwingArm(
          ctx!, getPose(p), playerX, groundY,
          COMPARISON_COLORS[i] ?? '#ffffff',
          entry.physics, scale, p, i * 16,
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
      <div
        className="mt-4 grid gap-4"
        style={{ gridTemplateColumns: `repeat(${Math.min(entries.length, 3)}, 1fr)` }}
      >
        {entries.map((e, i) => {
          const color = COMPARISON_COLORS[i]
          const p = e.physics
          return (
            <div key={e.racquet.id} className="bg-gray-800/60 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-sm font-semibold text-white">
                  {e.racquet.brand} {e.racquet.name}
                </span>
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
