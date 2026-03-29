'use client'

import { useState, useMemo } from 'react'
import { Racquet, COMPARISON_COLORS } from '@/data/racquets'
import { computePhysics, PhysicsProfile } from '@/lib/physics'
import RacquetSelector from '@/components/RacquetSelector'
import SwingPathCanvas from '@/components/SwingPathCanvas'
import CourtDepthCanvas from '@/components/CourtDepthCanvas'
import SpecsComparison from '@/components/SpecsComparison'

type Tab = 'swing' | 'depth' | 'specs'

const TABS: { id: Tab; label: string; icon: string; desc: string }[] = [
  {
    id: 'swing',
    label: 'Swing Path',
    icon: '🎾',
    desc: 'Optimal swing arc, contact height, low-to-high angle, and spin RPM',
  },
  {
    id: 'depth',
    label: 'Court Depth',
    icon: '📐',
    desc: 'Ball trajectory, net clearance, and landing depth for each racquet',
  },
  {
    id: 'specs',
    label: 'Spec Comparison',
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
    <div className="flex h-screen overflow-hidden bg-gray-950 text-white">
      { /* ── Sidebar */}
      <RacquetSelector selected={selected} onAdd={handleAdd} onRemove={handleRemove} />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900">
          <div>
            <h1 className="text-xl font-bold tracking-tight">🎾 Tennis Racquet Analyser</h1>
            <p className="text-xs text-gray-500 mt-0.5">Compare swing paths, ball trajectories &amp; specs for {selected.length} of 3 racquets</p>
          </div>
        </header>
        <div className="flex-shrink-0 flex border-b border-gray-800 bg-gray-900">
          {TABS.map(tab => (<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab===tab.id?'border-emerald-500 text-emerald-400':'border-transparent text-gray-500 hover:text-gray-300'}`}><span>{tab.icon}</span><span>{tab.label}</span></button>))}
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {selected.length===0?(<div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto"><div className="text-6xl mb-6">🎾</div><h2 className="text-2xl font-bold text-white mb-3">Select racquets to compare</h2><p className="text-gray-400 leading-relaxed">Choose up to 3 racquets from the sidebar.</p></div>):(<div className="max-w-5xl mx-auto space-y-4"><p className="text-sm text-gray-500">{currentTab.desc}</p>{activeTab==='swing'&&<SwingPathCanvas entries={entries}/>}{activeTab==='depth'&&<CourtDepthCanvas entries={entries}/>}{activeTab==='specs'&&<SpecsComparison entries={entries}/>}</div>)}
        </div>
      </main>
    </div>
  )
}
