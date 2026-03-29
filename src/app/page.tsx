'use client'

import { useState, useMemo } from 'react'
import { Racquet, COMPARISON_COLORS } from '@/data/racquets'
import { computePhysics, PhysicsProfile } from '@/lib/physics'
import RacquetSelector from '@/components/RacquetSelector'
import SwingPathCanvas from '@/components/SwingPathCanvas'
import CourtDepthCanvas from '@/components/CourtDepthCanvas'
import SpecsComparison from '@/components/SpecsComparison'

type Tab = 'swing' | 'depth' | 'specs'

const TABS: { id: Tab; label: string; shortLabel: string; icon: string; desc: string }[] = [
  {
    id: 'swing',
    label: 'Swing Path',
    shortLabel: 'Swing',
    icon: '🎾',
    desc: 'Optimal swing arc, contact height, low-to-high angle, and spin RPM',
  },
  {
    id: 'depth',
    label: 'Court Depth',
    shortLabel: 'Depth',
    icon: '📐',
    desc: 'Ball trajectory, net clearance, and landing depth for each racquet',
  },
  {
    id: 'specs',
    label: 'Spec Comparison',
    shortLabel: 'Specs',
    icon: '📊',
    desc: 'Radar performance profile, frame specs, and full spec table',
  },
]

interface Entry {
  racquet: Racquet
  physics: PhysicsProfile
}

export default function Home() {
  const [selected, setSelected] = useState<Racquet[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('swing')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const entries: Entry[] = useMemo(
    () => selected.map(r => ({ racquet: r, physics: computePhysics(r) })),
    [selected]
  )

  function handleAdd(r: Racquet) {
    if (selected.length < 3) setSelected(prev => [...prev, r])
  }

  function handleRemove(id: string) {
    setSelected(prev => prev.filter(r => r.id !== id))
  }

  const currentTab = TABS.find(t => t.id === activeTab)!

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-gray-950 text-white">

      {/* ── Mobile backdrop ───────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <div className={`
        fixed inset-y-0 left-0 z-30 flex-shrink-0
        lg:relative lg:z-auto lg:translate-x-0
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <RacquetSelector
          selected={selected}
          onAdd={r => { handleAdd(r); if (selected.length >= 2) setSidebarOpen(false) }}
          onRemove={handleRemove}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* ── Main area ──────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900">
          {/* Hamburger */}
          <button
            className="lg:hidden flex-shrink-0 p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open racquet selector"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-bold tracking-tight truncate">
              🎾 Tennis Racquet Analyser
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              <span className="text-emerald-500 font-medium">{selected.length}</span>
              <span className="text-gray-600"> / 3 racquets selected</span>
            </p>
          </div>

          {/* Selected badges — shown only on larger screens */}
          {selected.length > 0 && (
            <div className="hidden sm:flex gap-1.5 flex-wrap justify-end">
              {selected.map((r, i) => (
                <div
                  key={r.id}
                  className="flex items-center gap-1.5 bg-gray-800 rounded-full px-2.5 py-1"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COMPARISON_COLORS[i] }}
                  />
                  <span className="text-xs font-medium truncate max-w-[120px]">{r.brand} {r.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Mobile: colour dots only */}
          {selected.length > 0 && (
            <div className="flex sm:hidden gap-1.5">
              {selected.map((r, i) => (
                <span
                  key={r.id}
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COMPARISON_COLORS[i] }}
                />
              ))}
            </div>
          )}
        </header>

        {/* Tab bar */}
        <div className="flex-shrink-0 flex border-b border-gray-800 bg-gray-900 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 sm:px-6 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span className="hidden xs:inline sm:inline">{tab.shortLabel}</span>
              <span className="hidden md:inline"> {tab.label.split(' ')[1] ?? ''}</span>
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          {selected.length === 0 ? (
            /* Empty state */
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto px-4">
              <div className="text-5xl sm:text-6xl mb-4 sm:mb-6">🎾</div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">
                Select racquets to compare
              </h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                Tap the <span className="text-gray-300 font-medium">☰ menu</span> to choose up to 3 racquets.
                The app will animate their swing paths, visualise ball depth, and compare every spec side by side.
              </p>
              {/* CTA button on mobile */}
              <button
                className="mt-6 lg:hidden bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
                onClick={() => setSidebarOpen(true)}
              >
                Choose Racquets
              </button>
              <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-gray-500 w-full">
                {TABS.map(t => (
                  <div key={t.id} className="bg-gray-900 rounded-xl p-4 text-left">
                    <div className="text-2xl mb-2">{t.icon}</div>
                    <p className="font-medium text-gray-300">{t.label}</p>
                    <p className="text-xs mt-1">{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto space-y-4">
              {/* Tab description */}
              <p className="text-xs sm:text-sm text-gray-500">{currentTab.desc}</p>

              {/* Visualisation */}
              {activeTab === 'swing' && <SwingPathCanvas entries={entries} />}
              {activeTab === 'depth' && <CourtDepthCanvas entries={entries} />}
              {activeTab === 'specs' && <SpecsComparison entries={entries} />}

              {/* Tip banner */}
              <div className="mt-4 sm:mt-6 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-xs text-gray-500 leading-relaxed">
                <strong className="text-gray-300">💡 How to read this: </strong>
                {activeTab === 'swing' && (
                  <>
                    The swing arc angle shown is the <em>optimal low-to-high angle</em> for generating
                    topspin on a typical baseline groundstroke. Head-heavy racquets favour a steeper
                    brushing motion; head-light control racquets reward a flatter, more compact swing.
                  </>
                )}
                {activeTab === 'depth' && (
                  <>
                    Ball landing positions are computed from a physics model using swing weight, string
                    pattern, stiffness, and balance. The side view shows net clearance — higher-spin
                    setups clear the net with more margin, then drop sharply.
                  </>
                )}
                {activeTab === 'specs' && (
                  <>
                    The radar chart maps five computed performance dimensions. Spin, power, and
                    maneuverability are derived from frame stiffness, head size, swing weight, balance,
                    and string pattern. Higher isn&apos;t always better — match the racquet to your swing style.
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile bottom bar — quick racquet count + tab picker */}
        <div className="lg:hidden flex-shrink-0 border-t border-gray-800 bg-gray-900 px-4 py-2 flex items-center justify-between">
          <button
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>
              {selected.length === 0 ? 'Add racquets' : `${selected.length}/3 selected`}
            </span>
          </button>
          {selected.length > 0 && (
            <div className="flex gap-1">
              {selected.map((r, i) => (
                <span
                  key={r.id}
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: COMPARISON_COLORS[i] + '33', color: COMPARISON_COLORS[i] }}
                >
                  {r.name.split(' ')[0]}
                </span>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
