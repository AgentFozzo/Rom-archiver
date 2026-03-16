import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPlatforms } from '../api/client'
import { Gamepad2, Library, Settings, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

const PLATFORM_ICONS: Record<string, string> = {
  nes: '🎮', snes: '🕹️', n64: '🟦', gb: '🟩', gbc: '🌈', gba: '💜',
  nds: '📱', '3ds': '📱', gamecube: '🟣', wii: '⬜', genesis: '⬛',
  mastersystem: '⬛', gamegear: '🟡', saturn: '⬜', dreamcast: '🌀',
  ps1: '🔵', ps2: '🔵', psp: '🔷', atari2600: '🟠', atari7800: '🟠',
  arcade: '🕹️', other: '📁',
}

export default function Sidebar() {
  const location = useLocation()
  const { platformId } = useParams()

  const { data: platforms = [] } = useQuery({
    queryKey: ['platforms'],
    queryFn: getPlatforms,
    staleTime: 60_000,
  })

  const isActive = (path: string) => location.pathname === path

  return (
    <aside className="w-64 bg-steam-surface border-r border-steam-border flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-steam-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-steam-accent to-steam-accent-dark flex items-center justify-center shadow-glow">
            <Gamepad2 size={20} className="text-steam-bg" />
          </div>
          <div>
            <h1 className="text-steam-text font-bold text-base leading-tight">ROM Archiver</h1>
            <p className="text-steam-muted text-xs">Game Library</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="p-3 border-b border-steam-border">
        <Link
          to="/"
          className={clsx(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
            isActive('/')
              ? 'bg-steam-accent text-steam-bg'
              : 'text-steam-muted hover:text-steam-text hover:bg-steam-card'
          )}
        >
          <Library size={16} />
          All Games
        </Link>
      </nav>

      {/* Platforms */}
      <div className="flex-1 overflow-y-auto p-3">
        <p className="text-xs font-semibold text-steam-muted uppercase tracking-wider px-3 mb-2">
          Platforms
        </p>
        <div className="space-y-0.5">
          {platforms.map((p) => (
            <Link
              key={p.id}
              to={`/platform/${p.id}`}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group',
                String(p.id) === platformId
                  ? 'bg-steam-accent/20 text-steam-accent border border-steam-accent/30'
                  : 'text-steam-muted hover:text-steam-text hover:bg-steam-card'
              )}
            >
              <span className="text-base w-5 text-center flex-shrink-0">
                {PLATFORM_ICONS[p.slug] ?? '🎮'}
              </span>
              <span className="flex-1 truncate">{p.name}</span>
              <span className={clsx(
                'text-xs px-1.5 py-0.5 rounded-full flex-shrink-0',
                String(p.id) === platformId
                  ? 'bg-steam-accent/20 text-steam-accent'
                  : 'bg-steam-border text-steam-muted group-hover:bg-steam-card-hover'
              )}>
                {p.game_count}
              </span>
            </Link>
          ))}
          {platforms.length === 0 && (
            <p className="text-steam-muted text-xs px-3 py-4 text-center">
              No ROMs scanned yet.<br />Go to Settings → Start Scan.
            </p>
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="p-3 border-t border-steam-border">
        <Link
          to="/settings"
          className={clsx(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
            isActive('/settings')
              ? 'bg-steam-card text-steam-text'
              : 'text-steam-muted hover:text-steam-text hover:bg-steam-card'
          )}
        >
          <Settings size={16} />
          Settings
          <ChevronRight size={14} className="ml-auto" />
        </Link>
      </div>
    </aside>
  )
}
