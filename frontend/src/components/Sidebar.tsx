import { useState, useMemo } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPlatforms, getGames } from '../api/client'
import { Search, ChevronDown, ChevronRight, Filter } from 'lucide-react'
import clsx from 'clsx'
import type { Game } from '../types'

export default function Sidebar() {
  const location = useLocation()
  const { gameId } = useParams()
  const [search, setSearch] = useState('')
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<number>>(new Set())

  const { data: platforms = [] } = useQuery({
    queryKey: ['platforms'],
    queryFn: getPlatforms,
    staleTime: 60_000,
  })

  // Load all games for sidebar list
  const { data: allGames } = useQuery({
    queryKey: ['all-games-sidebar'],
    queryFn: () => getGames({ limit: 5000, sort: 'title', order: 'asc' }),
    staleTime: 30_000,
  })

  const games = allGames?.games ?? []

  // Group games by platform
  const grouped = useMemo(() => {
    const filtered = search
      ? games.filter(g => g.title.toLowerCase().includes(search.toLowerCase()))
      : games
    const map = new Map<number, Game[]>()
    for (const g of filtered) {
      const list = map.get(g.platform_id) || []
      list.push(g)
      map.set(g.platform_id, list)
    }
    return map
  }, [games, search])

  const togglePlatform = (id: number) => {
    setExpandedPlatforms(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Auto-expand all when searching
  const isExpanded = (id: number) => search ? true : expandedPlatforms.has(id)

  return (
    <aside className="w-56 bg-steam-bg flex flex-col flex-shrink-0 border-r border-steam-border">
      {/* Search */}
      <div className="p-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steam-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full bg-steam-bg-deep border border-steam-border rounded pl-8 pr-3 py-1.5
                       text-xs text-steam-text placeholder-steam-dim focus:outline-none
                       focus:border-steam-blue/50 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-steam-dim hover:text-steam-text text-xs"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Game list */}
      <div className="flex-1 overflow-y-auto">
        {platforms.map((platform) => {
          const platformGames = grouped.get(platform.id) || []
          if (search && platformGames.length === 0) return null
          const expanded = isExpanded(platform.id)

          return (
            <div key={platform.id}>
              {/* Platform header */}
              <button
                onClick={() => togglePlatform(platform.id)}
                className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold
                           text-steam-muted uppercase tracking-wider hover:text-steam-text
                           transition-colors"
              >
                {expanded
                  ? <ChevronDown size={10} className="flex-shrink-0" />
                  : <ChevronRight size={10} className="flex-shrink-0" />
                }
                <span className="truncate">{platform.name}</span>
                <span className="ml-auto text-steam-dim font-normal">
                  ({platformGames.length})
                </span>
              </button>

              {/* Game entries */}
              {expanded && (
                <div className="pb-1">
                  {platformGames.map((game) => (
                    <Link
                      key={game.id}
                      to={`/game/${game.id}`}
                      className={clsx(
                        'flex items-center gap-2 px-3 py-1 mx-1 rounded text-xs transition-all group',
                        String(game.id) === gameId
                          ? 'bg-steam-surface-light text-white'
                          : 'text-steam-muted hover:text-white hover:bg-white/5'
                      )}
                    >
                      {/* Mini cover */}
                      {game.cover_url ? (
                        <img
                          src={game.cover_url}
                          alt=""
                          className="w-4 h-5 object-cover rounded-sm flex-shrink-0 opacity-70
                                     group-hover:opacity-100 transition-opacity"
                        />
                      ) : (
                        <div className="w-4 h-5 bg-steam-surface rounded-sm flex-shrink-0
                                        flex items-center justify-center text-[8px] text-steam-dim">
                          🎮
                        </div>
                      )}
                      <span className="truncate">{game.title}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Empty state */}
        {platforms.length === 0 && (
          <div className="px-3 py-8 text-center">
            <p className="text-steam-dim text-xs">
              No games yet.<br />
              Scan your library to get started.
            </p>
          </div>
        )}
      </div>

      {/* Bottom: Add ROM link */}
      <div className="p-2 border-t border-steam-border">
        <Link
          to="/downloads"
          className="flex items-center gap-2 px-3 py-2 rounded text-xs text-steam-muted
                     hover:text-white hover:bg-white/5 transition-colors"
        >
          <span className="text-steam-blue text-sm">+</span>
          Add a ROM
        </Link>
      </div>
    </aside>
  )
}
