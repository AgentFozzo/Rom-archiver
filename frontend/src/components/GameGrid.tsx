import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getGames } from '../api/client'
import GameCard from './GameCard'
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
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

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'title', label: 'Title' },
    { key: 'rating', label: 'Rating' },
    { key: 'release_date', label: 'Release Year' },
    { key: 'file_size', label: 'File Size' },
  ]

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-steam-text">{title || 'All Games'}</h2>
          {data && (
            <p className="text-steam-muted text-sm mt-0.5">
              {data.total.toLocaleString()} game{data.total !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={15} className="text-steam-muted" />
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value as SortKey); setPage(1) }}
            className="bg-steam-card border border-steam-border text-steam-text text-sm
                       rounded-lg px-3 py-1.5 focus:outline-none focus:border-steam-accent"
          >
            {sortOptions.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={() => setOrder(o => o === 'asc' ? 'desc' : 'asc')}
            className="bg-steam-card border border-steam-border text-steam-muted hover:text-steam-text
                       px-3 py-1.5 rounded-lg text-sm transition-colors"
            title={order === 'asc' ? 'Ascending' : 'Descending'}
          >
            {order === 'asc' ? '↑ A–Z' : '↓ Z–A'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-steam-card border border-steam-border rounded-xl overflow-hidden animate-pulse">
              <div className="aspect-[3/4] bg-steam-surface" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-steam-surface rounded w-3/4" />
                <div className="h-2 bg-steam-surface rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="text-center py-20">
          <p className="text-steam-danger text-lg font-medium">Failed to load games</p>
          <p className="text-steam-muted text-sm mt-1">Check that the backend is running</p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && data?.games.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🎮</div>
          <p className="text-steam-text text-lg font-medium">
            {search ? 'No games found' : 'No ROMs scanned yet'}
          </p>
          <p className="text-steam-muted text-sm mt-1">
            {search
              ? `No results for "${search}"`
              : 'Click "Scan Library" in the top bar to get started'}
          </p>
        </div>
      )}

      {/* Grid */}
      {data && data.games.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {data.games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className={clsx(
              'p-2 rounded-lg border transition-colors',
              page === 1
                ? 'border-steam-border text-steam-muted cursor-not-allowed'
                : 'border-steam-border text-steam-text hover:border-steam-accent hover:text-steam-accent'
            )}
          >
            <ChevronLeft size={16} />
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
                'w-9 h-9 rounded-lg text-sm font-medium border transition-colors',
                p === page
                  ? 'bg-steam-accent text-steam-bg border-steam-accent'
                  : 'border-steam-border text-steam-muted hover:border-steam-accent hover:text-steam-text'
              )}
            >
              {p}
            </button>
          ))}

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className={clsx(
              'p-2 rounded-lg border transition-colors',
              page === totalPages
                ? 'border-steam-border text-steam-muted cursor-not-allowed'
                : 'border-steam-border text-steam-text hover:border-steam-accent hover:text-steam-accent'
            )}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
