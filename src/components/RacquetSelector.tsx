'use client'

import { useState, useMemo } from 'react'
import { RACQUETS, Racquet, ERA_LABELS, Era, COMPARISON_COLORS } from '@/data/racquets'

interface Props {
  selected: Racquet[]
  onAdd: (r: Racquet) => void
  onRemove: (id: string) => void
  onClose?: () => void
}

const ERA_ORDER: Era[] = ['classic', 'control', 'spin', 'power', 'all-court']

// Deduplicated sorted brand list
const ALL_BRANDS = Array.from(new Set(RACQUETS.map(r => r.brand))).sort()

export default function RacquetSelector({ selected, onAdd, onRemove, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [eraFilter, setEraFilter] = useState<Era | 'all'>('all')
  const [brandFilter, setBrandFilter] = useState<string>('all')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return RACQUETS.filter(r => {
      const matchEra = eraFilter === 'all' || r.era === eraFilter
      const matchBrand = brandFilter === 'all' || r.brand === brandFilter
      const matchSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.brand.toLowerCase().includes(q) ||
        (r.famousUser ?? '').toLowerCase().includes(q)
      return matchEra && matchBrand && matchSearch
    })
  }, [search, eraFilter, brandFilter])

  const grouped = useMemo(() => {
    const map = new Map<Era, Racquet[]>()
    ERA_ORDER.forEach(e => map.set(e, []))
    filtered.forEach(r => map.get(r.era)!.push(r))
    return map
  }, [filtered])

  const MAX_RACQUETS = COMPARISON_COLORS.length
  const isSelected = (id: string) => selected.some(r => r.id === id)
  const selectionFull = selected.length >= MAX_RACQUETS

  return (
    <aside className="w-[85vw] sm:w-72 flex-shrink-0 flex flex-col h-full bg-gray-900 border-r border-gray-800">

      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">
            Select Racquets
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search name, brand, player…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-500 border border-gray-700 focus:outline-none focus:border-emerald-500 mb-2"
        />

        {/* Brand dropdown */}
        <select
          value={brandFilter}
          onChange={e => setBrandFilter(e.target.value)}
          className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-emerald-500 appearance-none"
        >
          <option value="all">All Brands ({RACQUETS.length.toLocaleString()} racquets)</option>
          {ALL_BRANDS.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      {/* Era filter pills */}
      <div className="px-4 py-2 flex flex-wrap gap-1 border-b border-gray-800">
        {(['all', ...ERA_ORDER] as const).map(era => (
          <button
            key={era}
            onClick={() => setEraFilter(era)}
            className={`text-xs px-2 py-1 rounded-full transition-colors ${
              eraFilter === era
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {era === 'all' ? 'All' : ERA_LABELS[era]}
          </button>
        ))}
      </div>

      {/* Selected badges */}
      {selected.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-800">
          <p className="text-xs text-gray-500 mb-2">Comparing ({selected.length}/{COMPARISON_COLORS.length})</p>
          <div className="flex flex-col gap-2">
            {selected.map((r, i) => (
              <div
                key={r.id}
                className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2"
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COMPARISON_COLORS[i] }}
                />
                <span className="text-xs text-white flex-1 truncate">{r.brand} {r.name}</span>
                <button
                  onClick={() => onRemove(r.id)}
                  className="text-gray-500 hover:text-red-400 text-sm leading-none p-1"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {onClose && selected.length > 0 && (
            <button
              onClick={onClose}
              className="lg:hidden mt-3 w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
            >
              View Comparison →
            </button>
          )}
        </div>
      )}

      {/* Result count */}
      <div className="px-4 py-2 border-b border-gray-800">
        <p className="text-xs text-gray-500">
          {filtered.length.toLocaleString()} racquet{filtered.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Racquet list */}
      <div className="flex-1 overflow-y-auto">
        {ERA_ORDER.map(era => {
          const racquets = grouped.get(era) ?? []
          if (racquets.length === 0) return null
          return (
            <div key={era}>
              <div className="px-4 py-2 sticky top-0 bg-gray-900 z-10">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                  {ERA_LABELS[era]} ({racquets.length})
                </span>
              </div>
              {racquets.map(r => {
                const sel = isSelected(r.id)
                const selIdx = selected.findIndex(s => s.id === r.id)
                const canAdd = !sel && !selectionFull
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      if (sel) onRemove(r.id)
                      else if (canAdd) onAdd(r)
                    }}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b border-gray-800/50 ${
                      sel
                        ? 'bg-gray-800'
                        : canAdd
                        ? 'hover:bg-gray-800/60 active:bg-gray-800'
                        : 'opacity-40 cursor-not-allowed'
                    }`}
                    disabled={!sel && selectionFull}
                  >
                    {/* Colour indicator / selection index */}
                    <div className="flex-shrink-0 mt-0.5">
                      {sel ? (
                        <span
                          className="flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: COMPARISON_COLORS[selIdx] }}
                        >
                          {selIdx + 1}
                        </span>
                      ) : (
                        <span
                          className="block w-5 h-5 rounded-full border-2 border-gray-700"
                          style={{ borderColor: r.uiColor + '80' }}
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white leading-tight truncate">
                        {r.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{r.brand} · {r.year}</p>
                      {r.famousUser && (
                        <p className="text-xs text-gray-600 mt-0.5 truncate">{r.famousUser}</p>
                      )}
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400">{r.headSize} in²</p>
                      <p className="text-xs text-gray-600">{r.weight}g</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-center text-gray-600 text-sm py-10">No racquets match your search.</p>
        )}
      </div>
    </aside>
  )
}
