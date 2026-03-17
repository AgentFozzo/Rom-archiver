import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getGames, batchGames, getPlatformOptions } from '../api/client'
import GameCard from './GameCard'
import { ChevronLeft, ChevronRight, CheckSquare, Trash2, RefreshCw, HardDrive, X, Star } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  platformId?: number
  search?: string
  title?: string
  favoritesOnly?: boolean
}

type SortKey = 'title' | 'rating' | 'release_date' | 'file_size'

export default function GameGrid({ platformId, search, title, favoritesOnly }: Props) {
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortKey>('title')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [showMovePlatform, setShowMovePlatform] = useState(false)
  const [movePlatformSlug, setMovePlatformSlug] = useState('')
  const limit = 48
  const qc = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['games', { platformId, search, sort, order, page, limit, favoritesOnly }],
    queryFn: () => getGames({ platform_id: platformId, search, sort, order, page, limit, favorites_only: favoritesOnly }),
  })

  const { data: platformOptions = [] } = useQuery({
    queryKey: ['platform-options'],
    queryFn: getPlatformOptions,
    enabled: showMovePlatform,
  })

  const batchMutation = useMutation({
    mutationFn: ({ action, platform_slug }: { action: 'delete' | 'refresh-metadata' | 'reassign-platform'; platform_slug?: string }) =>
      batchGames(Array.from(selected), action, platform_slug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['games'] })
      qc.invalidateQueries({ queryKey: ['platforms'] })
      setSelected(new Set())
      setSelectMode(false)
      setShowMovePlatform(false)
    },
  })

  const totalPages = data ? Math.ceil(data.total / limit) : 0

  const toggleSelect = (id: number) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const selectAll = () =>
    setSelected(new Set(data?.games.map(g => g.id) ?? []))

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelected(new Set())
    setShowMovePlatform(false)
  }

  return (
    <div className="px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-bold text-steam-text uppercase tracking-wider">
            {title || 'All Games'}
          </h2>
          {data && (
            <p className="text-steam-dim text-xs mt-0.5">
              {data.total.toLocaleString()} game{data.total !== 1 ? 's' : ''}
              {selectMode && selected.size > 0 && (
                <span className="ml-2 text-steam-blue">{selected.size} selected</span>
              )}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Select mode toggle */}
          <button
            onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border transition-colors',
              selectMode
                ? 'bg-steam-blue/10 border-steam-blue/40 text-steam-blue'
                : 'bg-steam-bg-deep border-steam-border text-steam-muted hover:text-white'
            )}
          >
            <CheckSquare size={12} />
            {selectMode ? 'Cancel' : 'Select'}
          </button>

          {/* Sort */}
          {!selectMode && (
            <>
              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value as SortKey); setPage(1) }}
                className="bg-steam-bg-deep border border-steam-border text-steam-muted text-xs
                           rounded px-2 py-1 focus:outline-none focus:border-steam-blue/50"
              >
                <option value="title">Title</option>
                <option value="rating">Rating</option>
                <option value="release_date">Year</option>
                <option value="file_size">Size</option>
              </select>
              <button
                onClick={() => setOrder(o => o === 'asc' ? 'desc' : 'asc')}
                className="bg-steam-bg-deep border border-steam-border text-steam-dim
                           px-2 py-1 rounded text-xs hover:text-steam-text transition-colors"
              >
                {order === 'asc' ? '↑' : '↓'}
              </button>
            </>
          )}

          {/* Select-mode helpers */}
          {selectMode && data && data.games.length > 0 && (
            <button
              onClick={selectAll}
              className="text-steam-muted hover:text-white text-xs transition-colors"
            >
              Select all
            </button>
          )}
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/4] bg-steam-card rounded-lg" />
              <div className="mt-2 h-3 bg-steam-card rounded w-3/4" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="text-center py-16">
          <p className="text-steam-danger text-sm">Failed to load games</p>
        </div>
      )}

      {!isLoading && !isError && data?.games.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-3 opacity-30">{favoritesOnly ? '⭐' : '🎮'}</div>
          <p className="text-steam-muted text-sm">
            {favoritesOnly
              ? 'No favorites yet — star a game to add it here'
              : search
                ? `No results for "${search}"`
                : 'No games found'}
          </p>
        </div>
      )}

      {data && data.games.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {data.games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              selectMode={selectMode}
              selected={selected.has(game.id)}
              onSelect={() => toggleSelect(game.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!selectMode && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className={clsx(
              'p-1.5 rounded text-xs transition-colors',
              page === 1 ? 'text-steam-dim' : 'text-steam-muted hover:text-white hover:bg-white/5'
            )}
          >
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            let p: number
            if (totalPages <= 7) p = i + 1
            else if (page <= 4) p = i + 1
            else if (page >= totalPages - 3) p = totalPages - 6 + i
            else p = page - 3 + i
            return p
          }).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={clsx(
                'w-7 h-7 rounded text-xs font-medium transition-colors',
                p === page
                  ? 'bg-steam-blue text-white'
                  : 'text-steam-muted hover:text-white hover:bg-white/5'
              )}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className={clsx(
              'p-1.5 rounded text-xs transition-colors',
              page === totalPages ? 'text-steam-dim' : 'text-steam-muted hover:text-white hover:bg-white/5'
            )}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Batch floating action bar */}
      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="flex items-center gap-2 bg-steam-surface border border-steam-border
                          rounded-xl px-4 py-3 shadow-card backdrop-blur-sm">
            <span className="text-steam-text text-sm font-semibold mr-1">
              {selected.size} selected
            </span>

            <div className="w-px h-5 bg-steam-border mx-1" />

            {/* Refresh metadata */}
            <button
              onClick={() => batchMutation.mutate({ action: 'refresh-metadata' })}
              disabled={batchMutation.isPending}
              className="flex items-center gap-1.5 bg-steam-bg-deep border border-steam-border
                         text-steam-muted hover:text-white px-3 py-1.5 rounded text-xs
                         transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={clsx(batchMutation.isPending && 'animate-spin')} />
              Refresh Metadata
            </button>

            {/* Move to platform */}
            {showMovePlatform ? (
              <div className="flex items-center gap-1.5">
                <select
                  value={movePlatformSlug}
                  onChange={e => setMovePlatformSlug(e.target.value)}
                  className="bg-steam-bg-deep border border-steam-border text-steam-text text-xs
                             rounded px-2 py-1.5 focus:outline-none focus:border-steam-blue/50"
                  autoFocus
                >
                  <option value="">Select platform...</option>
                  {platformOptions.map(p => (
                    <option key={p.slug} value={p.slug}>{p.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => movePlatformSlug && batchMutation.mutate({ action: 'reassign-platform', platform_slug: movePlatformSlug })}
                  disabled={!movePlatformSlug || batchMutation.isPending}
                  className="bg-steam-blue text-white px-3 py-1.5 rounded text-xs font-medium
                             hover:bg-blue-500 disabled:opacity-50 transition-all"
                >
                  Move
                </button>
                <button onClick={() => setShowMovePlatform(false)} className="text-steam-dim hover:text-white p-1">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowMovePlatform(true)}
                className="flex items-center gap-1.5 bg-steam-bg-deep border border-steam-border
                           text-steam-muted hover:text-white px-3 py-1.5 rounded text-xs
                           transition-colors"
              >
                <HardDrive size={12} />
                Move Platform
              </button>
            )}

            {/* Delete */}
            <button
              onClick={() => {
                if (confirm(`Delete ${selected.size} game${selected.size !== 1 ? 's' : ''} and their files?`))
                  batchMutation.mutate({ action: 'delete' })
              }}
              disabled={batchMutation.isPending}
              className="flex items-center gap-1.5 bg-steam-danger/10 border border-steam-danger/30
                         text-steam-danger hover:bg-steam-danger/20 px-3 py-1.5 rounded text-xs
                         transition-colors disabled:opacity-50"
            >
              <Trash2 size={12} />
              Delete
            </button>

            <div className="w-px h-5 bg-steam-border mx-1" />

            <button
              onClick={exitSelectMode}
              className="text-steam-dim hover:text-white transition-colors p-1"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
