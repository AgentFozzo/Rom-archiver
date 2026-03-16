import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getGames } from '../api/client'
import GameCard from './GameCard'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  platformId?: number
  search?: string
  title?: string
}

type SortKey = 'title' | 'rating' | 'release_date' | 'file_size'

export default function GameGrid({ platformId, search, title }: Props) {
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortKey>('title')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const limit = 48

  const { data, isLoading, isError } = useQuery({
    queryKey: ['games', { platformId, search, sort, order, page, limit }],
    queryFn: () => getGames({ platform_id: platformId, search, sort, order, page, limit }),
  })

  const totalPages = data ? Math.ceil(data.total / limit) : 0

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
            </p>
          )}
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2">
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
          <div className="text-5xl mb-3 opacity-30">🎮</div>
          <p className="text-steam-muted text-sm">
            {search ? `No results for "${search}"` : 'No games found'}
          </p>
        </div>
      )}

      {data && data.games.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {data.games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
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
    </div>
  )
}
