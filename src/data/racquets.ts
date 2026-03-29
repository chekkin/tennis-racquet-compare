export type Era = 'classic' | 'control' | 'spin' | 'power' | 'all-court'

export interface Racquet {
  id: string
  name: string
  brand: string
  year: number
  /** sq inches */
  headSize: number
  /** grams unstrung */
  weight: number
  /** mm from butt end (320 = even balance on 27" racquet) */
  balance: number
  /** kg·cm² – higher = more momentum/stability, harder to swing */
  swingWeight: number
  /** e.g. "16x19" or "18x20" */
  stringPattern: string
  /** recommended tension range in lbs */
  tension: [number, number]
  /** RA stiffness rating – higher = stiffer = more power/less feel */
  stiffness: number
  famousUser?: string
  era: Era
  /** hex colour for UI identification */
  uiColor: string
  description: string
}

export const RACQUETS: Racquet[] = [
  /* ─── CLASSIC ERA ─── */
  {
    id: 'prince-graphite-110',
    name: 'Graphite 110',
    brand: 'Prince',
    year: 1976,
    headSize: 110,
    weight: 367,
    balance: 325,
    swingWeight: 370,
    stringPattern: '16x18',
    tension: [55, 70],
    stiffness: 62,
    famousUser: 'Howard Head era / Jimmy Connors',
    era: 'classic',
    uiColor: '#7c3aed',
    description:
      'The racquet that started the oversized revolution. Massive power from a 110 sq in head with a dense swing weight that rewards big, flat strokes.',
  },
  {
    id: 'wilson-pro-staff-85',
    name: 'Pro Staff 85',
    brand: 'Wilson',
    year: 1982,
    headSize: 85,
    weight: 357,
    balance: 310,
    swingWeight: 340,
    stringPattern: '16x18',
    tension: [55, 65],
    stiffness: 58,
    famousUser: 'Pete Sampras, Stefan Edberg, Roger Federer (early)',
    era: 'classic',
    uiColor: '#1e293b',
    description:
      'The gold standard of control racquets. Tiny 85 sq in head demands precision but rewards with unmatched feel and a flat, penetrating swing path.',
  },
  {
    id: 'head-prestige-classic',
    name: 'Prestige Classic 600',
    brand: 'Head',
    year: 1990,
    headSize: 93,
    weight: 340,
    balance: 305,
    swingWeight: 340,
    stringPattern: '18x20',
    tension: [55, 65],
    stiffness: 58,
    famousUser: 'Marat Safin, Thomas Muster, Gustavo Kuerten',
    era: 'classic',
    uiColor: '#b91c1c',
    description:
      'A player\'s racquet with exceptional feel. The dense 18x20 pattern and head-light balance rewards those who generate their own pace with compact swings.',
  },

  /* ─── MODERN CONTROL ─── */
  {
    id: 'wilson-pro-staff-rf97',
    name: 'Pro Staff RF97 Autograph',
    brand: 'Wilson',
    year: 2014,
    headSize: 97,
    weight: 340,
    balance: 310,
    swingWeight: 330,
    stringPattern: '16x19',
    tension: [50, 60],
    stiffness: 65,
    famousUser: 'Roger Federer',
    era: 'control',
    uiColor: '#1e293b',
    description:
      "Federer's weapon: heavy but head-light, rewarding a clean flat-to-topspin swing with laser precision and excellent depth from a controlled, compact arc.",
  },
  {
    id: 'wilson-blade-98',
    name: 'Blade 98 v8',
    brand: 'Wilson',
    year: 2021,
    headSize: 98,
    weight: 304,
    balance: 315,
    swingWeight: 317,
    stringPattern: '16x19',
    tension: [50, 60],
    stiffness: 62,
    famousUser: 'Various ATP/WTA tour players',
    era: 'control',
    uiColor: '#166534',
    description:
      'A versatile control racquet that suits a slightly steeper swing for moderate topspin with excellent depth. Its flex gives a planted, authoritative feel.',
  },
  {
    id: 'head-prestige-pro',
    name: 'Prestige Pro 99',
    brand: 'Head',
    year: 2021,
    headSize: 99,
    weight: 320,
    balance: 305,
    swingWeight: 325,
    stringPattern: '18x20',
    tension: [50, 59],
    stiffness: 63,
    famousUser: 'Various ATP tour players',
    era: 'control',
    uiColor: '#991b1b',
    description:
      'Dense 18x20 string bed and extreme head-light balance demand a compact, flat swing. Depth comes from swing speed and contact quality rather than spin.',
  },
  {
    id: 'tecnifibre-tf40',
    name: 'TF40 305',
    brand: 'Tecnifibre',
    year: 2022,
    headSize: 97,
    weight: 305,
    balance: 315,
    swingWeight: 325,
    stringPattern: '16x19',
    tension: [45, 59],
    stiffness: 63,
    famousUser: 'Control-oriented tour players',
    era: 'control',
    uiColor: '#1d4ed8',
    description:
      'A modern control classic blending a player-friendly swing weight with a flexible frame. Rewards a mid-height contact zone with excellent depth and feel.',
  },

  /* ─── MODERN SPIN ─── */
  {
    id: 'babolat-pure-aero',
    name: 'Pure Aero 2019',
    brand: 'Babolat',
    year: 2019,
    headSize: 100,
    weight: 300,
    balance: 330,
    swingWeight: 325,
    stringPattern: '16x19',
    tension: [50, 59],
    stiffness: 71,
    famousUser: 'Rafael Nadal, Carlos Alcaraz',
    era: 'spin',
    uiColor: '#d97706',
    description:
      'Built for topspin. The head-heavy balance naturally encourages a steep low-to-high brushing motion. High stiffness delivers the power to land deep despite heavy arc trajectories.',
  },
  {
    id: 'head-extreme-pro',
    name: 'Extreme Pro',
    brand: 'Head',
    year: 2022,
    headSize: 100,
    weight: 300,
    balance: 330,
    swingWeight: 335,
    stringPattern: '16x19',
    tension: [50, 59],
    stiffness: 68,
    famousUser: 'Alexei Popyrin',
    era: 'spin',
    uiColor: '#ea580c',
    description:
      'Extreme head-heavy balance and a large head size maximise spin potential. Ideal swing path is steep and brushing, with the ball clearing the net high before dropping deep.',
  },
  {
    id: 'yonex-vcore-pro-97',
    name: 'VCORE Pro 97',
    brand: 'Yonex',
    year: 2021,
    headSize: 97,
    weight: 310,
    balance: 310,
    swingWeight: 320,
    stringPattern: '16x19',
    tension: [45, 60],
    stiffness: 61,
    famousUser: 'Stan Wawrinka',
    era: 'control',
    uiColor: '#059669',
    description:
      "Wawrinka's racquet: a flexible player\'s frame that rewards a mid-high contact point. The slight flex adds spin while retaining excellent depth and feel.",
  },

  /* ─── MODERN POWER ─── */
  {
    id: 'babolat-pure-drive',
    name: 'Pure Drive 2021',
    brand: 'Babolat',
    year: 2021,
    headSize: 100,
    weight: 300,
    balance: 320,
    swingWeight: 323,
    stringPattern: '16x19',
    tension: [50, 59],
    stiffness: 72,
    famousUser: 'Various club & pro players',
    era: 'power',
    uiColor: '#2563eb',
    description:
      'The most popular racquet on tour. Extremely stiff frame returns energy efficiently for natural depth even on flatter swings. A slight forward swing angle maximises penetration.',
  },
  {
    id: 'head-speed-pro',
    name: 'Speed Pro 2022',
    brand: 'Head',
    year: 2022,
    headSize: 100,
    weight: 310,
    balance: 310,
    swingWeight: 315,
    stringPattern: '16x19',
    tension: [50, 59],
    stiffness: 68,
    famousUser: 'Novak Djokovic (inspiration)',
    era: 'power',
    uiColor: '#0891b2',
    description:
      "Djokovic's DNA: stiff and head-light, this racquet rewards an aggressive flat-to-moderate topspin swing at shoulder height. Outstanding natural depth from stiffness.",
  },
  {
    id: 'wilson-clash-100',
    name: 'Clash 100 v2',
    brand: 'Wilson',
    year: 2022,
    headSize: 100,
    weight: 295,
    balance: 330,
    swingWeight: 321,
    stringPattern: '16x19',
    tension: [50, 60],
    stiffness: 55,
    famousUser: 'Various tour players',
    era: 'all-court',
    uiColor: '#c2410c',
    description:
      'Uniquely flexible for a modern racquet (RA 55). The frame bends with the ball, allowing a wide range of swing paths. Forgives off-centre hits but requires more swing for depth.',
  },

  /* ─── ALL-COURT ─── */
  {
    id: 'head-radical-pro',
    name: 'Radical Pro 2021',
    brand: 'Head',
    year: 2021,
    headSize: 98,
    weight: 310,
    balance: 310,
    swingWeight: 320,
    stringPattern: '16x19',
    tension: [48, 57],
    stiffness: 63,
    famousUser: 'Andre Agassi (original), Andy Murray',
    era: 'all-court',
    uiColor: '#7e22ce',
    description:
      "Agassi's racquet: a balanced all-court weapon. Head-light balance meets open string pattern for a mix of spin and flat depth. Versatile across all swing shapes.",
  },
  {
    id: 'yonex-ezone-98',
    name: 'Ezone 98 2022',
    brand: 'Yonex',
    year: 2022,
    headSize: 98,
    weight: 305,
    balance: 320,
    swingWeight: 315,
    stringPattern: '16x19',
    tension: [45, 60],
    stiffness: 70,
    famousUser: 'Nick Kyrgios, Casper Ruud',
    era: 'all-court',
    uiColor: '#0d9488',
    description:
      'A comfortable power frame with enough stiffness for natural depth. Open string pattern offers good spin potential, making it forgiving across different swing paths.',
  },
  {
    id: 'dunlop-cx200',
    name: 'CX 200 2021',
    brand: 'Dunlop',
    year: 2021,
    headSize: 98,
    weight: 305,
    balance: 315,
    swingWeight: 315,
    stringPattern: '16x19',
    tension: [48, 58],
    stiffness: 62,
    famousUser: 'Kevin Anderson, Shuai Zhang',
    era: 'control',
    uiColor: '#b45309',
    description:
      'A classic player\'s feel in a modern package. Flexible enough for excellent feel but with a tight enough pattern to demand a clean, mid-height swing for depth.',
  },
]

export const ERA_LABELS: Record<Era, string> = {
  classic: 'Classic Era',
  control: 'Modern Control',
  spin: 'Spin Specialist',
  power: 'Power Frame',
  'all-court': 'All-Court',
}

export const COMPARISON_COLORS = ['#3b82f6', '#f59e0b', '#10b981']
