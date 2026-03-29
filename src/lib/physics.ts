import { Racquet } from '@/data/racquets'

export interface PhysicsProfile {
  /** 0–1: higher = more topspin available from this setup */
  spinPotential: number
  /** 0–1: higher = more natural power / depth from the frame */
  powerLevel: number
  /** 0–1: higher = easier to swing fast and redirect */
  maneuverability: number
  /** 0–1: dense pattern + flex = more control */
  control: number
  /** 0–1: swing weight + weight = plow-through on contact */
  stability: number
  /** degrees above horizontal for optimal topspin swing at contact */
  swingAngleDeg: number
  /** ideal contact height in cm above the ground */
  contactHeightCm: number
  /** estimated spin RPM on a typical medium-pace groundstroke */
  spinRPM: number
  /** metres the ball clears the net at the midpoint of its arc */
  netClearanceM: number
  /** metres from the opponent's baseline where the ball lands (0 = on baseline) */
  depthFromBaselineM: number
  /** metres from the net where the ball lands in the opponent's court */
  landingFromNetM: number
}

// ─── helpers ────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

/**
 * Return an openness factor 0–1 for a given string pattern.
 * 16×18 = 0.98 (very open), 18×20 = 0.0 (densest common pattern).
 */
function stringOpenness(pattern: string): number {
  const parts = pattern.split('x').map(Number)
  const mains = parts[0] ?? 16
  const crosses = parts[1] ?? 19
  const intersections = mains * crosses // 288 = 16×18 (open), 360 = 18×20 (dense)
  return clamp(1 - (intersections - 288) / 72, 0, 1)
}

// ─── main compute ────────────────────────────────────────────────────────────

export function computePhysics(r: Racquet): PhysicsProfile {
  const openness = stringOpenness(r.stringPattern)

  // ── Spin potential ──────────────────────────────────────────────────────
  // Drivers: open string bed, low tension, flexible frame, larger head
  const tensionFactor = clamp(1 - (r.tension[0] - 40) / 35, 0, 1)
  const flexFactor = clamp(1 - (r.stiffness - 55) / 30, 0, 1)
  const headFactor = clamp((r.headSize - 85) / 30, 0, 1)
  const spinPotential = clamp(
    0.45 * openness + 0.25 * flexFactor + 0.2 * tensionFactor + 0.1 * headFactor,
    0.08, 0.95
  )

  // ── Power level ─────────────────────────────────────────────────────────
  // Drivers: frame stiffness, head size, swing weight (plow-through)
  const stiffP = clamp((r.stiffness - 55) / 25, 0, 1)
  const hsP    = clamp((r.headSize - 85) / 35, 0, 1)
  const swP    = clamp((r.swingWeight - 295) / 80, 0, 1)
  const powerLevel = clamp(0.4 * stiffP + 0.35 * hsP + 0.25 * swP, 0.08, 0.95)

  // ── Maneuverability ─────────────────────────────────────────────────────
  // Inverse of swing weight + head-heavy penalty
  const swM  = clamp(1 - (r.swingWeight - 290) / 90, 0, 1)
  const balM = clamp(1 - (r.balance - 295) / 55, 0, 1)
  const maneuverability = clamp(0.65 * swM + 0.35 * balM, 0.08, 0.95)

  // ── Control ─────────────────────────────────────────────────────────────
  // Dense pattern + flex frame + head-light = better control/feel
  const patternCtrl   = 1 - openness
  const stiffnessCtrl = clamp(1 - stiffP, 0, 1)
  const control = clamp(0.4 * patternCtrl + 0.35 * stiffnessCtrl + 0.25 * balM, 0.08, 0.95)

  // ── Stability ───────────────────────────────────────────────────────────
  // High swing weight + heavy overall = plow-through on off-centre hits
  const weightS = clamp((r.weight - 280) / 90, 0, 1)
  const stability = clamp(0.6 * swP + 0.4 * weightS, 0.08, 0.95)

  // ── Optimal swing angle ─────────────────────────────────────────────────
  // More spin potential → steeper low-to-high arc
  // Head-heavy balance → more natural leverage for brushing motion
  const headHeavyDeg = (r.balance - 318) * 0.38 // +ve for head-heavy
  const swingAngleDeg = clamp(13 + headHeavyDeg + spinPotential * 20, 8, 45)

  // ── Optimal contact height ──────────────────────────────────────────────
  // Heavier/stiffer → take it higher (shoulder–chest zone)
  // Light/flexible → hip–waist zone
  const contactHeightCm = clamp(
    70 + (r.swingWeight - 310) * 0.28 + (r.stiffness - 58) * 0.55,
    62, 118
  )

  // ── Spin RPM ────────────────────────────────────────────────────────────
  const spinRPM = Math.round(1400 + spinPotential * 3000)

  // ── Ball trajectory / depth ─────────────────────────────────────────────
  // Net clearance (metres above net height at midpoint)
  // High spin → higher arc over net (safer margin), then drops sharply
  const netClearanceM = clamp(0.3 + spinPotential * 1.8, 0.25, 2.0)

  // Landing distance from the net in opponent's court (court half = 11.89 m)
  // Power → penetrates deeper; spin → drops near baseline; maneuverability
  // penalty (heavier, harder to swing = slightly less depth for the same effort)
  const landingFromNetM = clamp(
    5.8 + powerLevel * 3.6 + spinPotential * 2.2 - (1 - maneuverability) * 0.8,
    4.0, 11.6
  )

  const depthFromBaselineM = clamp(11.89 - landingFromNetM, 0.3, 7.9)

  return {
    spinPotential,
    powerLevel,
    maneuverability,
    control,
    stability,
    swingAngleDeg,
    contactHeightCm,
    spinRPM,
    netClearanceM,
    depthFromBaselineM,
    landingFromNetM,
  }
}

// ─── derived labels ──────────────────────────────────────────────────────────

export function depthLabel(depthFromBaseline: number): { text: string; color: string } {
  if (depthFromBaseline <= 1.0) return { text: 'Baseline depth', color: '#10b981' }
  if (depthFromBaseline <= 2.5) return { text: 'Deep',           color: '#34d399' }
  if (depthFromBaseline <= 4.5) return { text: 'Mid-deep',       color: '#fbbf24' }
  return                                { text: 'Short',          color: '#f87171' }
}

export function swingStyleLabel(angleDeg: number): string {
  if (angleDeg >= 35) return 'Extreme topspin'
  if (angleDeg >= 25) return 'Heavy topspin'
  if (angleDeg >= 18) return 'Moderate topspin'
  if (angleDeg >= 12) return 'Flat with topspin'
  return 'Flat / drive'
}

/**
 * Linear interpolation helper used in canvas animation code.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}
