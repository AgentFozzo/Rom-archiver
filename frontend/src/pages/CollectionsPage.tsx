import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPlatforms } from '../api/client'
import type { Platform } from '../types'
import { getPlatformLogoUrl, getPlatformAccent } from '../utils/platformLogos'

const PLATFORM_COLORS: Record<string, string> = {
  nes: 'from-red-900/40 to-red-950/40',
  snes: 'from-purple-900/40 to-purple-950/40',
  n64: 'from-blue-900/40 to-blue-950/40',
  gb: 'from-green-900/40 to-green-950/40',
  gbc: 'from-yellow-900/40 to-yellow-950/40',
  gba: 'from-indigo-900/40 to-indigo-950/40',
  nds: 'from-gray-800/40 to-gray-900/40',
  '3ds': 'from-red-800/40 to-red-950/40',
  gamecube: 'from-purple-900/40 to-violet-950/40',
  wii: 'from-cyan-900/40 to-cyan-950/40',
  wiiu: 'from-sky-900/40 to-sky-950/40',
  switch: 'from-red-800/40 to-gray-950/40',
  genesis: 'from-gray-900/40 to-gray-950/40',
  mastersystem: 'from-gray-800/40 to-gray-950/40',
  gamegear: 'from-blue-900/40 to-gray-950/40',
  dreamcast: 'from-orange-900/40 to-orange-950/40',
  saturn: 'from-gray-800/40 to-gray-900/40',
  sega32x: 'from-zinc-800/40 to-zinc-950/40',
  segacd: 'from-zinc-900/40 to-gray-950/40',
  ps1: 'from-blue-900/40 to-slate-950/40',
  ps2: 'from-blue-800/40 to-blue-950/40',
  ps3: 'from-slate-700/40 to-slate-950/40',
  ps4: 'from-blue-700/40 to-blue-950/40',
  psp: 'from-slate-800/40 to-slate-950/40',
  psvita: 'from-indigo-800/40 to-slate-950/40',
  xbox: 'from-green-900/40 to-green-950/40',
  xbox360: 'from-green-800/40 to-green-950/40',
  atari2600: 'from-amber-900/40 to-yellow-950/40',
  atari7800: 'from-amber-800/40 to-yellow-950/40',
  jaguar: 'from-orange-900/40 to-amber-950/40',
  ngpc: 'from-teal-900/40 to-teal-950/40',
  ngp: 'from-teal-800/40 to-teal-950/40',
  wsc: 'from-stone-800/40 to-stone-950/40',
  ws: 'from-stone-700/40 to-stone-950/40',
  arcade: 'from-amber-900/40 to-amber-950/40',
}

export default function CollectionsPage() {
  const { data: platforms = [], isLoading } = useQuery({
    queryKey: ['platforms'],
    queryFn: getPlatforms,
  })

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 animate-fade-in">
      <h1 className="text-sm font-bold text-steam-text uppercase tracking-wider mb-6">
        Collections
      </h1>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 bg-steam-card rounded-lg animate-pulse" />
          ))}
        </div>
      ) : platforms.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-steam-dim text-sm">No platforms found. Scan your library first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {platforms.map((p) => (
            <PlatformCard key={p.id} platform={p} />
          ))}
        </div>
      )}
    </div>
  )
}

function PlatformCard({ platform }: { platform: Platform }) {
  const gradient = PLATFORM_COLORS[platform.slug] || 'from-steam-card to-steam-surface'
  const logoUrl = getPlatformLogoUrl(platform.slug)
  const accent = getPlatformAccent(platform.slug)

  return (
    <Link to={`/platform/${platform.id}`} className="block group">
      <div className={`bg-gradient-to-br ${gradient} border border-steam-border rounded-lg
                       p-4 sm:p-5 transition-all duration-200 hover:border-steam-blue/40
                       hover:-translate-y-0.5 hover:shadow-card`}>
        <div className="flex items-center justify-between mb-3">
          {/* Brand logo with fallback */}
          <div className="w-9 h-9 flex items-center justify-center">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={platform.name}
                className="w-8 h-8 object-contain opacity-50 group-hover:opacity-90
                           transition-opacity duration-200"
                onError={(e) => {
                  // Fallback to platform cover or emoji on load error
                  const target = e.currentTarget
                  if (platform.cover_url) {
                    target.src = platform.cover_url
                  } else {
                    target.style.display = 'none'
                    const parent = target.parentElement
                    if (parent) {
                      const fb = document.createElement('span')
                      fb.className = 'text-2xl opacity-40 group-hover:opacity-70'
                      fb.textContent = '🎮'
                      parent.appendChild(fb)
                    }
                  }
                }}
              />
            ) : platform.cover_url ? (
              <img src={platform.cover_url} alt="" className="w-8 h-8 object-contain opacity-60
                       group-hover:opacity-100 transition-opacity" />
            ) : (
              <span className="text-2xl opacity-40 group-hover:opacity-70 transition-opacity">🎮</span>
            )}
          </div>

          <span className={`text-lg font-bold ${accent}`}>{platform.game_count}</span>
        </div>
        <h3 className="text-steam-text text-sm font-semibold group-hover:text-white transition-colors leading-tight">
          {platform.name}
        </h3>
        <p className="text-steam-dim text-xs mt-0.5">
          {platform.game_count} game{platform.game_count !== 1 ? 's' : ''}
        </p>
      </div>
    </Link>
  )
}

