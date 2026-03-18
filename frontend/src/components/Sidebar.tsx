import { useState, useMemo } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPlatforms, getGames, deletePlatform } from '../api/client'
import { Search, ChevronDown, ChevronRight, Trash2, X } from 'lucide-react'
import clsx from 'clsx'
import type { Game } from '../types'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { gameId } = useParams()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<number>>(new Set())

  const deletePlatformMutation = useMutation({
    mutationFn: deletePlatform,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platforms'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  const { data: platforms = [] } = useQuery({
    queryKey: ['platforms'],
    queryFn: getPlatforms,
    staleTime: 60_000,
  })

  const { data: allGames } = useQuery({
    queryKey: ['all-games-sidebar'],
    queryFn: () => getGames({ limit: 5000, sort: 'title', order: 'asc' }),
    staleTime: 30_000,
  })

  const games = allGames?.games ?? []

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

  const isExpanded = (id: number) => search ? true : expandedPlatforms.has(id)

  const handleGameClick = () => {
    // Close drawer on mobile when navigating
    onClose()
  }

  return (
    <>
      {/* Desktop: static sidebar; Mobile: fixed drawer */}
      <aside
        className={clsx(
          'bg-steam-bg flex flex-col flex-shrink-0 border-r border-steam-border',
          // Mobile: drawer overlay
          'fixed lg:relative inset-y-0 left-0 z-40 w-72 lg:w-56',
          'transform transition-transform duration-200 ease-in-out lg:transform-none',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Mobile header with close button */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-steam-border lg:hidden">
          <span className="text-steam-text text-xs font-bold uppercase tracking-wider">Library</span>
          <button
            onClick={onClose}
            className="text-steam-muted hover:text-white transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>

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
              <div key={platform.id} className="group/platform">
                <div className="flex items-center">
                  <button
                    onClick={() => togglePlatform(platform.id)}
                    className="flex-1 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold
                               text-steam-muted uppercase tracking-wider hover:text-steam-text
                               transition-colors min-w-0"
                  >
                    {expanded
                      ? <ChevronDown size={10} className="flex-shrink-0" />
                      : <ChevronRight size={10} className="flex-shrink-0" />
                    }
                    <span className="truncate">{platform.name}</span>
                    <span className="ml-auto text-steam-dim font-normal flex-shrink-0">
                      ({platformGames.length})
                    </span>
                  </button>
                  {platform.game_count === 0 && (
                    <button
                      onClick={() => {
                        if (confirm(`Delete empty platform "${platform.name}"?`))
                          deletePlatformMutation.mutate(platform.id)
                      }}
                      title="Delete empty platform"
                      className="flex-shrink-0 opacity-0 group-hover/platform:opacity-100 pr-2
                                 text-steam-dim hover:text-steam-danger transition-all"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>

                {expanded && (
                  <div className="pb-1">
                    {platformGames.map((game) => (
                      <Link
                        key={game.id}
                        to={`/game/${game.id}`}
                        onClick={handleGameClick}
                        className={clsx(
                          'flex items-center gap-2 px-3 py-1.5 lg:py-1 mx-1 rounded text-xs transition-all group',
                          String(game.id) === gameId
                            ? 'bg-steam-surface-light text-white'
                            : 'text-steam-muted hover:text-white hover:bg-white/5'
                        )}
                      >
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
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 rounded text-xs text-steam-muted
                       hover:text-white hover:bg-white/5 transition-colors"
          >
            <span className="text-steam-blue text-sm">+</span>
            Add a ROM
          </Link>
        </div>
      </aside>
    </>
  )
}
