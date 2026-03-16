import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { downloadGameFile } from '../api/client'
import type { Game } from '../types'
import clsx from 'clsx'

interface Props {
  title: string
  games: Game[]
  large?: boolean
}

export default function GameShelf({ title, games, large }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  if (games.length === 0) return null

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return
    const amount = scrollRef.current.clientWidth * 0.7
    scrollRef.current.scrollBy({
      left: dir === 'left' ? -amount : amount,
      behavior: 'smooth',
    })
  }

  return (
    <div className="mb-8 group/shelf">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-6">
        <h2 className="text-sm font-bold text-steam-text uppercase tracking-wider">{title}</h2>
        <div className="flex gap-1 opacity-0 group-hover/shelf:opacity-100 transition-opacity">
          <button
            onClick={() => scroll('left')}
            className="p-1 rounded bg-white/5 hover:bg-white/10 text-steam-muted hover:text-white transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-1 rounded bg-white/5 hover:bg-white/10 text-steam-muted hover:text-white transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto no-scrollbar px-6 scroll-smooth"
      >
        {games.map((game, i) => (
          <ShelfCard key={game.id} game={game} large={large && i === 0} />
        ))}
      </div>
    </div>
  )
}

function ShelfCard({ game, large }: { game: Game; large?: boolean }) {
  return (
    <Link
      to={`/game/${game.id}`}
      className={clsx(
        'flex-shrink-0 rounded-lg overflow-hidden relative group cursor-pointer',
        'transition-all duration-200 hover:-translate-y-0.5',
        large ? 'w-72 h-40' : 'w-36 h-48'
      )}
    >
      {/* Cover image */}
      {game.cover_url ? (
        <img
          src={game.cover_url}
          alt={game.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-steam-surface to-steam-card
                        flex flex-col items-center justify-center gap-2 p-3">
          <span className="text-3xl opacity-30">🎮</span>
          <p className="text-steam-muted text-[10px] text-center line-clamp-2">{game.title}</p>
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent
                      opacity-0 group-hover:opacity-100 transition-opacity duration-200
                      flex flex-col justify-end p-3">
        <p className="text-white text-xs font-semibold line-clamp-1 mb-1">{game.title}</p>
        <div className="flex items-center justify-between">
          <span className="text-steam-muted text-[10px]">
            {game.release_date ? new Date(game.release_date * 1000).getFullYear() : game.platform?.name}
          </span>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              downloadGameFile(game.id)
            }}
            className="bg-steam-blue hover:bg-blue-500 text-white px-2 py-0.5 rounded text-[10px]
                       font-medium flex items-center gap-1 active:scale-95 transition-all"
          >
            <Download size={10} />
            DL
          </button>
        </div>
      </div>

      {/* DAT verified badge */}
      {game.dat_verified && (
        <div className="absolute top-1.5 right-1.5 w-3 h-3 bg-steam-verified rounded-full
                        border border-white/20" title="DAT Verified" />
      )}
    </Link>
  )
}
